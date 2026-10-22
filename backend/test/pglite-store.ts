import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { qualifiedSql as postgresSql } from "../src/postgres.js";
import type { Database } from "../src/database.js";
export async function testPostgres(): Promise<Database> {
  const pg = new PGlite();
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await pg.exec(
    readFileSync(
      new URL("../postgres-migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec("SET search_path TO pg_catalog");
  const active = new AsyncLocalStorage<boolean>(),
    inTransaction = new AsyncLocalStorage<boolean>();
  let tail: Promise<unknown> = Promise.resolve();
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    if (active.getStore()) return fn();
    const next = tail.then(() => active.run(true, fn));
    tail = next.catch(() => {});
    return next;
  };
  const all = async (sql: string, ...params: any[]) =>
    lock(async () => {
      const result = await pg.query<any>(postgresSql(sql), params);
      return result.rows.map((row) => {
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === "bigint") row[key] = Number(value);
          if (value instanceof Uint8Array) row[key] = Buffer.from(value);
        }
        return row;
      });
    });
  return {
    all,
    get: async (sql, ...params) => (await all(sql, ...params))[0],
    run: async (sql, ...params) =>
      lock(async () => ({
        changes: (await pg.query(postgresSql(sql), params)).affectedRows || 0,
      })),
    transaction: async (fn) =>
      inTransaction.getStore()
        ? fn()
        : lock(async () => {
            await pg.exec("BEGIN");
            try {
              const result = await inTransaction.run(true, fn);
              await pg.exec("COMMIT");
              return result;
            } catch (e) {
              await pg.exec("ROLLBACK");
              throw e;
            }
          }),
    close: async () => {
      await tail;
      await pg.close();
    },
  };
}
