import { filterList } from './FilterEngine.js';
import { defineTable, type TableBuilder } from './schema.js';
import {
  type AggregateKind,
  type BaseType,
  type Connector,
  type DeltaUpdateSpec,
  type Dict,
  KeyType,
  type Scope,
  SortDirection,
  type UpsertSpec,
} from './types.js';

import { clone, uuid } from './util.js';

export type Storage = Dict<Dict<any>[]>;

const globalStorage: Storage = {};
const globalLastIds: Dict<number> = {};

export class MemoryConnector implements Connector {
  private storage: Storage;
  private lastIds: Dict<number>;
  private inTransaction = false;

  constructor(props?: { storage?: Storage; lastIds?: Dict<number> }) {
    this.storage = props?.storage || globalStorage;
    this.lastIds = props?.lastIds || globalLastIds;
  }

  private collection(tableName: string): Dict<any>[] {
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init pattern
    return (this.storage[tableName] = this.storage[tableName] || []);
  }

  private nextId(tableName: string): number {
    this.lastIds[tableName] = this.lastIds[tableName] || 0;
    return ++this.lastIds[tableName];
  }

  private async items({
    tableName,
    filter = {},
    limit,
    skip,
    order = [],
  }: Scope): Promise<Dict<any>[]> {
    let items = await filterList(this.collection(tableName), filter);

    for (let orderIndex = order.length - 1; orderIndex >= 0; orderIndex -= 1) {
      const key = order[orderIndex].key;
      const dir = order[orderIndex].dir || SortDirection.Asc;

      items = items.sort((a, b) => {
        if (a[key as string] > b[key as string]) {
          return dir;
        }
        if (a[key as string] < b[key as string]) {
          return -dir;
        }
        if (
          (a[key as string] === null || a[key as string] === undefined) &&
          b[key as string] !== null &&
          b[key as string] !== undefined
        ) {
          return dir;
        }
        if (
          (b[key as string] === null || b[key as string] === undefined) &&
          a[key as string] !== null &&
          a[key as string] !== undefined
        ) {
          return -dir;
        }
        return 0;
      });
    }

    if (skip && limit) {
      items = items.slice(skip, skip + limit);
    } else if (skip) {
      items = items.slice(skip);
    } else if (limit) {
      items = items.slice(0, limit);
    }

    return items;
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    return clone(items);
  }

  async count(scope: Scope): Promise<number> {
    const items = await this.items(scope);
    return items.length;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    return items.map((item) => {
      const obj: Dict<any> = {};
      for (const key of keys) {
        obj[key] = item[key];
      }
      return obj;
    });
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    items.forEach((item) => {
      for (const key in attrs) {
        item[key] = attrs[key];
      }
    });
    return clone(items);
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    const items = await this.items({ tableName: spec.tableName, filter: spec.filter });
    for (const item of items) {
      for (const { column, by } of spec.deltas) {
        const current = Number(item[column] ?? 0);
        item[column] = current + by;
      }
      if (spec.set) {
        for (const key in spec.set) {
          item[key] = spec.set[key];
        }
      }
    }
    return items.length;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    const result = clone(items);
    const collection = this.collection(scope.tableName);
    let index = 0;
    while (index < collection.length) {
      if (items.includes(collection[index])) {
        collection.splice(index, 1);
      } else {
        index += 1;
      }
    }
    return result;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    const result: Dict<any>[] = [];
    for (const item of items) {
      const keyValues: Dict<any> = {};
      for (const key in keys) {
        switch (keys[key]) {
          case KeyType.uuid:
            keyValues[key] = uuid();
            break;
          case KeyType.number:
            keyValues[key] = this.nextId(tableName);
            break;
          case KeyType.manual:
            break;
        }
      }
      const attributes = { ...item, ...keyValues };
      this.collection(tableName).push(attributes);
      result.push(clone(attributes));
    }
    return result;
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const collection = this.collection(spec.tableName);
    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c) => JSON.stringify(row[c])).join('|');
    const existingByTuple = new Map<string, Dict<any>>();
    for (const row of collection) {
      existingByTuple.set(tupleKey(row), row);
    }
    const results: Dict<any>[] = [];
    for (const row of spec.rows) {
      const match = existingByTuple.get(tupleKey(row));
      if (match) {
        if (spec.ignoreOnly) {
          results.push(clone(match));
          continue;
        }
        const updateCols =
          spec.updateColumns ?? Object.keys(row).filter((k) => !spec.conflictTarget.includes(k));
        for (const col of updateCols) {
          if (Object.hasOwn(row, col)) match[col] = row[col];
        }
        results.push(clone(match));
        continue;
      }
      const keyValues: Dict<any> = {};
      for (const key in spec.keys) {
        if (Object.hasOwn(row, key) && row[key] !== undefined) continue;
        switch (spec.keys[key]) {
          case KeyType.uuid:
            keyValues[key] = uuid();
            break;
          case KeyType.number:
            keyValues[key] = this.nextId(spec.tableName);
            break;
          case KeyType.manual:
            break;
        }
      }
      const inserted = { ...row, ...keyValues };
      collection.push(inserted);
      existingByTuple.set(tupleKey(inserted), inserted);
      results.push(clone(inserted));
    }
    return results;
  }

  async hasTable(tableName: string): Promise<boolean> {
    return Object.hasOwn(this.storage, tableName);
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    defineTable(tableName, blueprint);
    if (!Object.hasOwn(this.storage, tableName)) {
      this.storage[tableName] = [];
    }
  }

  async dropTable(tableName: string): Promise<void> {
    delete this.storage[tableName];
    delete this.lastIds[tableName];
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const items = await this.items(scope);
    const values = items
      .map((item) => item[key])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (values.length === 0) return undefined;
    switch (kind) {
      case 'sum':
        return values.reduce((acc, v) => acc + v, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'avg':
        return values.reduce((acc, v) => acc + v, 0) / values.length;
    }
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const fn = compileExecute(query);
    if (Array.isArray(bindings)) {
      return fn(this.storage, ...bindings);
    }
    return fn(this.storage, bindings);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn();
    const storageSnapshot = structuredClone(this.storage);
    const lastIdsSnapshot = { ...this.lastIds };
    this.inTransaction = true;
    try {
      const result = await fn();
      this.inTransaction = false;
      return result;
    } catch (err) {
      for (const key in this.storage) delete this.storage[key];
      Object.assign(this.storage, storageSnapshot);
      for (const key in this.lastIds) delete this.lastIds[key];
      Object.assign(this.lastIds, lastIdsSnapshot);
      this.inTransaction = false;
      throw err;
    }
  }
}

function compileExecute(source: string): (...args: any[]) => any[] {
  // biome-ignore lint/security/noGlobalEval: MemoryConnector.execute evaluates raw query strings by design
  return eval(source);
}

export default MemoryConnector;
