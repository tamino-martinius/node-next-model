import {
  type AggregateKind,
  type BaseType,
  type DeltaUpdateSpec,
  type Dict,
  type KeyType,
  MemoryConnector,
  type Scope,
  type Storage,
  type TableBuilder,
  type UpsertSpec,
} from '@next-model/core';

export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageConnectorOptions {
  localStorage?: WebStorageLike;
  prefix?: string;
  suffix?: string;
}

export class LocalStorageConnector extends MemoryConnector {
  private readonly webStorage: WebStorageLike;
  private readonly prefix: string;
  private readonly suffix: string;
  private readonly storageRef: Storage;
  private readonly lastIdsRef: Dict<number>;
  private readonly hydrated = new Set<string>();
  private deferPersist = false;
  private pendingPersist = new Set<string>();

  constructor(options: LocalStorageConnectorOptions = {}) {
    const storage: Storage = {};
    const lastIds: Dict<number> = {};
    super({ storage, lastIds });
    this.storageRef = storage;
    this.lastIdsRef = lastIds;
    const ls =
      options.localStorage ?? (globalThis as { localStorage?: WebStorageLike }).localStorage;
    if (!ls) {
      throw new Error(
        'LocalStorageConnector requires a localStorage implementation (pass one via options.localStorage when not running in a browser)',
      );
    }
    this.webStorage = ls;
    this.prefix = options.prefix ?? '';
    this.suffix = options.suffix ?? '';
  }

  private tableKey(tableName: string): string {
    return `${this.prefix}${tableName}${this.suffix}`;
  }

  private nextIdKey(tableName: string): string {
    return `${this.tableKey(tableName)}__nextId`;
  }

  private hydrate(tableName: string): void {
    if (this.hydrated.has(tableName)) return;
    const data = this.webStorage.getItem(this.tableKey(tableName));
    if (data !== null) {
      try {
        const rows = JSON.parse(data);
        if (Array.isArray(rows)) this.storageRef[tableName] = rows;
      } catch {
        // corrupt payload — start fresh
      }
    }
    const nextIdRaw = this.webStorage.getItem(this.nextIdKey(tableName));
    if (nextIdRaw !== null) {
      const n = Number(nextIdRaw);
      if (Number.isFinite(n)) this.lastIdsRef[tableName] = n;
    }
    this.hydrated.add(tableName);
  }

  private persist(tableName: string): void {
    if (this.deferPersist) {
      this.pendingPersist.add(tableName);
      return;
    }
    const rows = this.storageRef[tableName] ?? [];
    this.webStorage.setItem(this.tableKey(tableName), JSON.stringify(rows));
    if (this.lastIdsRef[tableName] !== undefined) {
      this.webStorage.setItem(this.nextIdKey(tableName), String(this.lastIdsRef[tableName]));
    }
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    this.hydrate(scope.tableName);
    return super.query(scope);
  }

  async count(scope: Scope): Promise<number> {
    this.hydrate(scope.tableName);
    return super.count(scope);
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    this.hydrate(scope.tableName);
    return super.select(scope, ...keys);
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    this.hydrate(scope.tableName);
    return super.aggregate(scope, kind, key);
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    this.hydrate(scope.tableName);
    const result = await super.updateAll(scope, attrs);
    this.persist(scope.tableName);
    return result;
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    this.hydrate(spec.tableName);
    const affected = await super.deltaUpdate(spec);
    if (affected > 0) this.persist(spec.tableName);
    return affected;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    this.hydrate(scope.tableName);
    const result = await super.deleteAll(scope);
    this.persist(scope.tableName);
    return result;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    this.hydrate(tableName);
    const result = await super.batchInsert(tableName, keys, items);
    this.persist(tableName);
    return result;
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    this.hydrate(spec.tableName);
    const result = await super.upsert(spec);
    this.persist(spec.tableName);
    return result;
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    return super.execute(query, bindings);
  }

  async hasTable(tableName: string): Promise<boolean> {
    if (await super.hasTable(tableName)) return true;
    return this.webStorage.getItem(this.tableKey(tableName)) !== null;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    this.hydrate(tableName);
    await super.createTable(tableName, blueprint);
    this.persist(tableName);
  }

  async dropTable(tableName: string): Promise<void> {
    await super.dropTable(tableName);
    this.hydrated.delete(tableName);
    this.pendingPersist.delete(tableName);
    this.webStorage.removeItem(this.tableKey(tableName));
    this.webStorage.removeItem(this.nextIdKey(tableName));
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.deferPersist) return super.transaction(fn);
    this.deferPersist = true;
    this.pendingPersist.clear();
    try {
      const result = await super.transaction(fn);
      this.deferPersist = false;
      const pending = this.pendingPersist;
      this.pendingPersist = new Set<string>();
      for (const tableName of pending) this.persist(tableName);
      return result;
    } catch (err) {
      this.deferPersist = false;
      this.pendingPersist = new Set<string>();
      throw err;
    }
  }
}

export default LocalStorageConnector;
