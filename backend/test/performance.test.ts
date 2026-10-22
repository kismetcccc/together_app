import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import type pg from "pg";
import { PostgresDatabase, qualifiedSql } from "../src/postgres.js";

test("fast reads remain in private schema; transactions roll back and rate buckets are atomic", async () => {
  const engine = new PGlite();
  const statements: string[] = [];
  await engine.exec(
    "CREATE SCHEMA together; CREATE TABLE together.users(id text PRIMARY KEY); CREATE TABLE together.rate_limits(key text PRIMARY KEY,count integer,expires_at bigint); SET search_path TO pg_catalog;",
  );
  const query = async (sql: string, values?: any[]) => {
    statements.push(sql);
    if (sql.includes("pg_advisory_xact_lock")) {
      await engine.exec(
        "BEGIN; SET LOCAL search_path TO together, pg_catalog;",
      );
      return {};
    }
    const result = await engine.query(sql, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  const pool = {
    query,
    connect: async () => ({ query, release() {} }),
    on() {},
    end: () => engine.close(),
  } as unknown as pg.Pool;
  const db = new PostgresDatabase("", pool);
  try {
    await db.run("INSERT INTO users VALUES(?)", "a");
    statements.length = 0;
    assert.deepEqual(await db.get("SELECT id FROM users WHERE id=?", "a"), {
      id: "a",
    });
    assert.equal(statements.length, 1);
    await assert.rejects(
      db.transaction(async () => {
        await db.run("INSERT INTO users VALUES(?)", "rollback");
        throw Error("abort");
      }),
    );
    assert.equal(
      await db.get("SELECT id FROM users WHERE id=?", "rollback"),
      undefined,
    );
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.consumeRateLimit("same-ip", 1000, 60000, 3),
      ),
    );
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal(await db.consumeRateLimit("other-ip", 1000, 60000, 3), true);
    assert.equal(await db.consumeRateLimit("same-ip", 61000, 60000, 3), true);
    assert.equal(
      qualifiedSql("SELECT 'FROM users ?' AS label FROM users WHERE id=?"),
      "SELECT 'FROM users ?' AS label FROM together.users WHERE id=$1",
    );
  } finally {
    await db.close();
  }
});
