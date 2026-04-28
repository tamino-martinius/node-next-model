import type { Dict } from '@next-model/core';
import { pkKey, rowKey } from './pkKey.js';

interface Entry {
  instance: object;
  refcount: number;
}

export class Store {
  private rows = new Map<string, Map<string, Entry>>();
  private subs = new Map<string | symbol, Set<() => void>>();
  private disposed = false;

  acquire(tableName: string, keys: Dict<unknown>): object | undefined {
    return this.rows.get(tableName)?.get(pkKey(keys))?.instance;
  }

  register(tableName: string, keys: Dict<unknown>, instance: object): object {
    const table = this.tableMap(tableName);
    const k = pkKey(keys);
    const existing = table.get(k);
    if (existing) {
      existing.refcount = Math.max(1, existing.refcount + 1);
      return existing.instance;
    }
    table.set(k, { instance, refcount: 1 });
    return instance;
  }

  softRegister(tableName: string, keys: Dict<unknown>, instance: object): object {
    const table = this.tableMap(tableName);
    const k = pkKey(keys);
    const existing = table.get(k);
    if (existing) return existing.instance;
    table.set(k, { instance, refcount: 0 });
    return instance;
  }

  retain(tableName: string, keys: Dict<unknown>): void {
    const entry = this.rows.get(tableName)?.get(pkKey(keys));
    if (entry) entry.refcount += 1;
  }

  release(tableName: string, keys: Dict<unknown>): void {
    const table = this.rows.get(tableName);
    if (!table) return;
    const k = pkKey(keys);
    const entry = table.get(k);
    if (!entry) return;
    entry.refcount -= 1;
    if (entry.refcount < 1) table.delete(k);
  }

  drop(tableName: string, keys: Dict<unknown>): void {
    this.rows.get(tableName)?.delete(pkKey(keys));
  }

  refcount(tableName: string, keys: Dict<unknown>): number {
    return this.rows.get(tableName)?.get(pkKey(keys))?.refcount ?? 0;
  }

  subscribe(key: string | symbol, cb: () => void): () => void {
    let set = this.subs.get(key);
    if (!set) {
      set = new Set();
      this.subs.set(key, set);
    }
    set.add(cb);
    return () => {
      const s = this.subs.get(key);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) this.subs.delete(key);
    };
  }

  publish(key: string | symbol): void {
    if (this.disposed) return;
    const set = this.subs.get(key);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
  }

  publishRow(tableName: string, keys: Dict<unknown>): void {
    this.publish(rowKey(tableName, keys));
  }

  publishKeys(keys: (string | symbol)[]): void {
    for (const k of keys) this.publish(k);
  }

  dispose(): void {
    this.disposed = true;
    this.rows.clear();
    this.subs.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private tableMap(tableName: string): Map<string, Entry> {
    let t = this.rows.get(tableName);
    if (!t) {
      t = new Map();
      this.rows.set(tableName, t);
    }
    return t;
  }
}
