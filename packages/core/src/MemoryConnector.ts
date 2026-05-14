import { UnsupportedOperationError } from './errors.js';
import { filterList } from './FilterEngine.js';
import { baseQueryScoped } from './query/baseQueryScoped.js';
import {
  type AlterTableSpec,
  type ColumnOptions,
  defineTable,
  type IndexOptions,
  type TableBuilder,
} from './schema.js';
import type { DatabaseSchema } from './typedSchema.js';
import {
  type AggregateKind,
  type BaseType,
  type Connector,
  type DeltaUpdateSpec,
  type Dict,
  KeyType,
  normalizeOrderEntry,
  type QueryScopedSpec,
  type Scope,
  type UpsertSpec,
} from './types.js';

import { clone, uuid } from './util.js';

export type Storage = Dict<Dict<any>[]>;

const globalStorage: Storage = {};
const globalLastIds: Dict<number> = {};

export class MemoryConnector<S extends DatabaseSchema<any> | undefined = undefined>
  implements Connector<S>
{
  readonly schema?: S;
  private storage: Storage;
  private lastIds: Dict<number>;
  private inTransaction = false;

  constructor(props?: { storage?: Storage; lastIds?: Dict<number> }, extras?: { schema?: S }) {
    this.storage = props?.storage || globalStorage;
    this.lastIds = props?.lastIds || globalLastIds;
    this.schema = extras?.schema;
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
      const { key, dir } = normalizeOrderEntry(order[orderIndex]);

      items = items.sort((a, b) => {
        if (a[key] > b[key]) {
          return dir;
        }
        if (a[key] < b[key]) {
          return -dir;
        }
        if ((a[key] === null || a[key] === undefined) && b[key] !== null && b[key] !== undefined) {
          return dir;
        }
        if ((b[key] === null || b[key] === undefined) && a[key] !== null && a[key] !== undefined) {
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

  async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
    return baseQueryScoped(this, spec);
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

  /**
   * Materialise every table declared in the attached `schema` idempotently.
   * Iterates `schema.tableDefinitions` and dispatches through the existing
   * per-connector `createTable` path so connector-specific column type quirks
   * are preserved. Subclasses (e.g. SQLite, localStorage) inherit this method
   * — they only need to ensure their `createTable` / `hasTable` overrides are
   * sound.
   */
  async ensureSchema(): Promise<{ created: string[]; existing: string[] }> {
    if (!this.schema) {
      throw new Error(
        'Connector.ensureSchema(): no schema is attached. Pass `{ schema }` at construction.',
      );
    }
    const created: string[] = [];
    const existing: string[] = [];
    const tableDefinitions = this.schema.tableDefinitions as Record<
      string,
      import('./schema.js').TableDefinition
    >;
    for (const tableName of Object.keys(tableDefinitions)) {
      if (await this.hasTable(tableName)) {
        existing.push(tableName);
        continue;
      }
      const def = tableDefinitions[tableName];
      await this.createTable(tableName, (t) => {
        for (const col of def.columns) {
          const options: ColumnOptions = {
            null: col.nullable,
            primary: col.primary,
            unique: col.unique,
            autoIncrement: col.autoIncrement,
          };
          if (col.default !== undefined) options.default = col.default;
          if (col.limit !== undefined) options.limit = col.limit;
          if (col.precision !== undefined) options.precision = col.precision;
          if (col.scale !== undefined) options.scale = col.scale;
          t.column(col.name, col.type, options);
        }
        for (const idx of def.indexes) {
          const indexOptions: IndexOptions = { unique: idx.unique };
          if (idx.name !== undefined) indexOptions.name = idx.name;
          t.index(idx.columns, indexOptions);
        }
      });
      created.push(tableName);
    }
    return { created, existing };
  }

  async dropTable(tableName: string): Promise<void> {
    delete this.storage[tableName];
    delete this.lastIds[tableName];
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    const rows = this.collection(spec.tableName);
    for (const op of spec.ops) {
      switch (op.op) {
        case 'addColumn': {
          const fallback = defaultValueFor(op.options?.default);
          for (const row of rows) {
            if (!(op.name in row)) row[op.name] = fallback;
          }
          break;
        }
        case 'removeColumn': {
          for (const row of rows) {
            delete row[op.name];
          }
          break;
        }
        case 'renameColumn': {
          for (const row of rows) {
            if (op.from in row) {
              row[op.to] = row[op.from];
              delete row[op.from];
            }
          }
          break;
        }
        case 'changeColumn':
        case 'addIndex':
        case 'removeIndex':
        case 'renameIndex':
          // No-op: MemoryConnector doesn't enforce column types or maintain
          // indexes — the snapshot tracked by SchemaCollector still reflects
          // these mutations because it applies them to its own mirror.
          break;
        case 'addForeignKey':
        case 'removeForeignKey':
        case 'addCheckConstraint':
        case 'removeCheckConstraint':
          throw new UnsupportedOperationError(
            `MemoryConnector does not enforce ${op.op}; wrap it in a SchemaCollector or use a SQL connector for constraint-aware migrations`,
          );
      }
    }
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

function defaultValueFor(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === 'currentTimestamp') return new Date().toISOString();
  return value;
}

function compileExecute(source: string): (...args: any[]) => any[] {
  // biome-ignore lint/security/noGlobalEval: MemoryConnector.execute evaluates raw query strings by design
  return eval(source);
}

export default MemoryConnector;
