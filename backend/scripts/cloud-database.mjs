import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rootCertificates } from "node:tls";

// Run only against the selected project's private transaction-pooler URL.
const url = process.env.DATABASE_URL;
if (!url)
  throw Error("Configure DATABASE_URL locally; never paste it into chat.");
const ca = process.env.DATABASE_CA_CERT_BASE64;
const client = new pg.Client({
  connectionString: url,
  ssl: {
    rejectUnauthorized: true,
    ...(ca
      ? {
          ca: [...rootCertificates, Buffer.from(ca, "base64").toString("utf8")],
        }
      : {}),
  },
  connectionTimeoutMillis: 10000,
});
let local;
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(74693821)");
  if (process.argv[2] === "--schema") {
    const sql = readFileSync(
      new URL("../postgres-migrations/001_initial.sql", import.meta.url),
      "utf8",
    );
    const hash = createHash("sha256").update(sql).digest("hex");
    const exists = await client.query(
      "SELECT to_regclass('together.cloud_migrations') AS name",
    );
    if (exists.rows[0].name) {
      const prior = await client.query(
        "SELECT checksum FROM together.cloud_migrations WHERE name='001_initial'",
      );
      if (prior.rows[0]?.checksum !== hash)
        throw Error("Schema checksum differs; use a new migration.");
    } else {
      await client.query(sql);
      await client.query(
        "CREATE TABLE together.cloud_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL)",
      );
      await client.query(
        "INSERT INTO together.cloud_migrations VALUES($1,$2)",
        ["001_initial", hash],
      );
    }
    console.log("Schema ready.");
  } else if (process.argv[2] === "--import" && process.argv[3]) {
    local = new DatabaseSync(process.argv[3], { readOnly: true });
    local.exec("BEGIN");
    const tables = [
      "users",
      "albums",
      "members",
      "photos",
      "favorites",
      "anniversaries",
    ];
    for (const table of tables) {
      if (
        Number(
          (await client.query(`SELECT COUNT(*) AS n FROM together.${table}`))
            .rows[0].n,
        ) !== 0
      )
        throw Error("Target must be empty; refusing to overwrite cloud data.");
    }
    for (const table of tables) {
      const rows = local.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map((v) =>
          v instanceof Uint8Array ? Buffer.from(v) : v,
        );
        await client.query(
          `INSERT INTO together.${table} (${columns.join(",")}) VALUES (${values.map((_, i) => "$" + (i + 1)).join(",")})`,
          values,
        );
      }
      const count = Number(
        (await client.query(`SELECT COUNT(*) AS n FROM together.${table}`))
          .rows[0].n,
      );
      if (count !== rows.length) throw Error("Import count mismatch");
      console.log(`${table}: ${count} verified`);
    }
    local.exec("COMMIT");
    console.log(
      "Accounts, password hashes and albums imported. Old sessions and pending email links were not transferred.",
    );
  } else
    throw Error("Usage: --schema OR --import <consistent-sqlite-snapshot>");
  await client.query("COMMIT");
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Cloud database operation failed and was rolled back. Check connection, schema and empty target; no secrets are printed.",
  );
  process.exitCode = 1;
} finally {
  local?.close();
  await client.end();
}
