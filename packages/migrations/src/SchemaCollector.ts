import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  type AggregateKind,
  type BaseType,
  type Connector,
  type Dict,
  defineTable,
  type KeyType,
  type Scope,
  type TableBuilder,
  type TableDefinition,
  type UpsertSpec,
} from '@next-model/core';

export interface SchemaSnapshot {
  /** Bumped when the on-disk shape changes. Readers can guard on this. */
  version: 1;
  /** When the snapshot was last written. */
  generatedAt: string;
  /** Tables known to the schema, keyed by table name. */
  tables: Record<string, TableDefinition>;
}

export interface SchemaCollectorOptions {
  /** Seed the collector with an existing snapshot (e.g. loaded from disk). */
  initial?: SchemaSnapshot;
}

/**
 * Connector wrapper that delegates every operation to the underlying connector
 * while keeping an in-memory mirror of the schema DDL as migrations run. After
 * `migrate()` finishes, call `snapshot()` to get the cumulative table
 * definitions or `writeSchema(path)` to persist them as JSON.
 *
 * The mirror is intentionally DDL-only — the SchemaCollector doesn't attempt
 * to capture data changes, indexes added outside the schema DSL, or raw SQL
 * issued via `execute()`.
 */
export class SchemaCollector implements Connector {
  private readonly inner: Connector;
  private tables: Record<string, TableDefinition>;

  constructor(inner: Connector, options: SchemaCollectorOptions = {}) {
    this.inner = inner;
    this.tables = { ...(options.initial?.tables ?? {}) };
  }

  /** Underlying connector the collector wraps — useful for feature detection. */
  get delegate(): Connector {
    return this.inner;
  }

  /** Current schema snapshot (shallow copy — safe to mutate the returned object). */
  snapshot(): SchemaSnapshot {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      tables: structuredClone(this.tables),
    };
  }

  /**
   * Serialise the snapshot to disk as pretty-printed JSON. Parent directories
   * are created if needed. Writes atomically via `writeFileSync`.
   */
  writeSchema(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(this.snapshot(), null, 2)}\n`, 'utf8');
  }

  // Schema-mutating methods — intercept before delegating.

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const definition = defineTable(tableName, blueprint);
    this.tables[tableName] = definition;
    return this.inner.createTable(tableName, blueprint);
  }

  async dropTable(tableName: string): Promise<void> {
    delete this.tables[tableName];
    return this.inner.dropTable(tableName);
  }

  // Data methods — pure delegation.

  query(scope: Scope): Promise<Dict<any>[]> {
    return this.inner.query(scope);
  }
  count(scope: Scope): Promise<number> {
    return this.inner.count(scope);
  }
  select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    return this.inner.select(scope, ...keys);
  }
  updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    return this.inner.updateAll(scope, attrs);
  }
  deleteAll(scope: Scope): Promise<Dict<any>[]> {
    return this.inner.deleteAll(scope);
  }
  batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]> {
    return this.inner.batchInsert(tableName, keys, items);
  }
  upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    return this.inner.upsert(spec);
  }
  execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    return this.inner.execute(query, bindings);
  }
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.inner.transaction(fn);
  }
  aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    return this.inner.aggregate(scope, kind, key);
  }
  hasTable(tableName: string): Promise<boolean> {
    return this.inner.hasTable(tableName);
  }
}

/**
 * Read a schema snapshot written by `SchemaCollector.writeSchema(path)`.
 * Throws when the file doesn't parse or targets a future snapshot version
 * this reader doesn't understand.
 */
export async function readSchemaFile(path: string): Promise<SchemaSnapshot> {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as SchemaSnapshot;
  if (parsed.version !== 1) {
    throw new Error(`unsupported schema snapshot version: ${parsed.version}`);
  }
  return parsed;
}
