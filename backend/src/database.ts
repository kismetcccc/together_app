import { AsyncLocalStorage } from "node:async_hooks";
import { Store } from "./db.js";

export interface Database {
  consumeRateLimit?(
    key: string,
    now: number,
    windowMs: number,
    max: number,
  ): Promise<boolean>;
  get(sql: string, ...params: any[]): Promise<any>;
  all(sql: string, ...params: any[]): Promise<any[]>;
  run(sql: string, ...params: any[]): Promise<{ changes: number | bigint }>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Keep a local SQLite transaction isolated while its asynchronous callback runs.
export class LocalDatabase implements Database {
  private store: Store;
  private active = new AsyncLocalStorage<boolean>();
  private inTransaction = new AsyncLocalStorage<boolean>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(path: string) {
    this.store = new Store(path);
  }
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active.getStore()) return fn();
    const next = this.tail.then(() => this.active.run(true, fn));
    this.tail = next.catch(() => {});
    return next;
  }
  get(sql: string, ...params: any[]) {
    return this.locked(async () => this.store.get(sql, ...params));
  }
  all(sql: string, ...params: any[]) {
    return this.locked(async () => this.store.all(sql, ...params));
  }
  run(sql: string, ...params: any[]) {
    return this.locked(async () => this.store.run(sql, ...params));
  }
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction.getStore()) return fn();
    return this.locked(async () => {
      this.store.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await this.inTransaction.run(true, fn);
        this.store.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.store.db.exec("ROLLBACK");
        throw error;
      }
    });
  }
  async close() {
    await this.tail;
    this.store.close();
  }
}
