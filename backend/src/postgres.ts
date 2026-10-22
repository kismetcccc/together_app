import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { rootCertificates } from "node:tls";
import type { Database } from "./database.js";

// Application-generated SQL only; values always remain bound parameters.
export function postgresSql(sql: string) {
  let index = 0;
  let result = sql.replace(/'(?:''|[^'])*'|\?/g, (part) =>
    part === "?" ? `$${++index}` : part,
  );
  if (/INSERT OR IGNORE/i.test(result))
    result =
      result.replace(/INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING";
  return result;
}
// Only application-owned table identifiers, never values or quoted literals.
export function qualifiedSql(sql: string) {
  return postgresSql(sql).replace(
    /'(?:''|[^'])*'|\b(FROM|JOIN|INTO|UPDATE)\s+(users|sessions|albums|members|photos|favorites|invitations|anniversaries|verifications|password_resets|rate_limits)\b/gi,
    (part, keyword, table) => (keyword ? `${keyword} together.${table}` : part),
  );
}
export class PostgresDatabase implements Database {
  private pool: pg.Pool;
  private nextRateCleanup = 0;
  private active = new AsyncLocalStorage<pg.PoolClient>();
  constructor(url: string, pool?: pg.Pool) {
    const ca = process.env.DATABASE_CA_CERT_BASE64;
    this.pool =
      pool ||
      new pg.Pool({
        connectionString: url,
        max: 2,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
        ssl: {
          rejectUnauthorized: true,
          ...(ca
            ? {
                ca: [
                  ...rootCertificates,
                  Buffer.from(ca, "base64").toString("utf8"),
                ],
              }
            : {}),
        },
      });
    this.pool.on("error", () => console.error("Database connection lost"));
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active.getStore()) return fn();
    const client = await this.pool.connect();
    try {
      // Small friend-test deployment: serialize writes across function instances.
      await client.query(
        "BEGIN; SET LOCAL search_path TO together, pg_catalog; SELECT pg_advisory_xact_lock(74693821)",
      );
      const result = await this.active.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private query(sql: string, params: any[]) {
    const values = params.map((p) =>
        p instanceof Uint8Array ? Buffer.from(p) : p,
      ),
      client = this.active.getStore();
    if (client) return client.query(qualifiedSql(sql), values);
    // Reads use one round trip and never wait for the application write lock.
    if (/^\s*SELECT\b/i.test(sql))
      return this.pool.query(qualifiedSql(sql), values);
    return this.transaction(async () =>
      this.active.getStore()!.query(qualifiedSql(sql), values),
    );
  }
  async consumeRateLimit(
    key: string,
    now: number,
    windowMs: number,
    max: number,
  ) {
    if (now >= this.nextRateCleanup) {
      this.nextRateCleanup = now + 300000;
      await this.pool.query(
        "DELETE FROM together.rate_limits WHERE key IN (SELECT key FROM together.rate_limits WHERE expires_at<=$1 ORDER BY key LIMIT 1000)",
        [now],
      );
    }
    // ON CONFLICT locks only this IP/bucket; concurrent requests cannot exceed max.
    const result = await this.pool.query(
      `INSERT INTO together.rate_limits AS limits (key,count,expires_at) VALUES($1,1,$2)
      ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN limits.expires_at<=$3 THEN 1 ELSE limits.count+1 END,
      expires_at=CASE WHEN limits.expires_at<=$3 THEN $2 ELSE limits.expires_at END
      WHERE limits.expires_at<=$3 OR limits.count<$4 RETURNING count`,
      [key, now + windowMs, now, max],
    );
    return !!result.rowCount;
  }
  async all(sql: string, ...params: any[]) {
    const r = await this.query(sql, params);
    return r.rows.map((row) => {
      for (const field of r.fields)
        if (field.dataTypeID === 20 && row[field.name] !== null)
          row[field.name] = Number(row[field.name]);
      return row;
    });
  }
  async get(sql: string, ...params: any[]) {
    return (await this.all(sql, ...params))[0];
  }
  async run(sql: string, ...params: any[]) {
    return { changes: (await this.query(sql, params)).rowCount || 0 };
  }
  async close() {
    await this.pool.end();
  }
}
