import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)",
    );
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of readdirSync(dir)
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(name, dir), "utf8"),
        checksum = createHash("sha256").update(sql).digest("hex");
      const prior = this.get(
        "SELECT checksum FROM migrations WHERE name=?",
        name,
      );
      if (prior) {
        if (prior.checksum !== checksum)
          throw Error(`Applied migration modified: ${name}`);
        continue;
      }
      this.transaction(() => {
        this.db.exec(sql);
        this.run("INSERT INTO migrations VALUES(?,?)", name, checksum);
      });
    }
  }
  get(sql: string, ...params: SQLInputValue[]): any {
    return this.db.prepare(sql).get(...params);
  }
  all(sql: string, ...params: SQLInputValue[]): any[] {
    return this.db.prepare(sql).all(...params);
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
