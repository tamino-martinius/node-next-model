import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
  type Connector,
  type DeltaUpdateSpec,
  type Dict,
  defineTable,
  type Filter,
  filterList,
  KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
  UnsupportedOperationError,
  type UpsertSpec,
} from '@next-model/core';
import { createClient, type RedisClientOptions, type RedisClientType } from 'redis';

export interface RedisConfig {
  /** node-redis options. Pass `url: 'redis://...'` or `socket: { host, port }`. */
  client?: RedisClientOptions;
  /** Pre-built node-redis client. Caller controls connect/disconnect. */
  redis?: RedisClientType;
  /** Prefix prepended to every key (e.g. `myapp:`). Defaults to `nm:`. */
  prefix?: string;
}

interface TableSnapshot {
  meta: string | null;
  nextId: string | null;
  ids: string[];
  rows: Map<string, Dict<string>>;
}

function encode(value: unknown): string {
  if (value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify({ __date__: value.toISOString() });
  return JSON.stringify(value);
}

function decode(raw: string): unknown {
  if (raw === 'null') return null;
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && '__date__' in parsed) {
    return new Date((parsed as { __date__: string }).__date__);
  }
  return parsed;
}

function deserializeRow(hash: Dict<string>): Dict<any> {
  const out: Dict<any> = {};
  for (const k in hash) out[k] = decode(hash[k]);
  return out;
}

function applyOrder(rows: Dict<any>[], order: Scope['order']): Dict<any>[] {
  if (!order || order.length === 0) return rows;
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    for (const col of order) {
      const dir = (col.dir ?? SortDirection.Asc) === SortDirection.Asc ? 1 : -1;
      const av = a[col.key as string];
      const bv = b[col.key as string];
      if (av === bv) continue;
      if (av === null || av === undefined) return -1 * dir;
      if (bv === null || bv === undefined) return 1 * dir;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  });
  return sorted;
}

function applyLimitSkip(rows: Dict<any>[], scope: Scope): Dict<any>[] {
  const start = scope.skip ?? 0;
  const end = scope.limit !== undefined ? start + scope.limit : undefined;
  return rows.slice(start, end);
}

export class RedisConnector implements Connector {
  client: RedisClientType;
  prefix: string;
  private ownsClient: boolean;
  private connected = false;
  private inTransaction = false;

  constructor(config: RedisConfig = {}) {
    if (config.redis) {
      this.client = config.redis;
      this.ownsClient = false;
    } else {
      this.client = createClient(config.client) as RedisClientType;
      this.ownsClient = true;
    }
    this.prefix = config.prefix ?? 'nm:';
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.client.isOpen) await this.client.connect();
    this.connected = true;
  }

  async destroy(): Promise<void> {
    if (this.ownsClient && this.client.isOpen) await this.client.quit();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  private metaKey(tableName: string): string {
    return `${this.prefix}${tableName}:meta`;
  }
  private idsKey(tableName: string): string {
    return `${this.prefix}${tableName}:ids`;
  }
  private nextIdKey(tableName: string): string {
    return `${this.prefix}${tableName}:nextid`;
  }
  private rowKey(tableName: string, id: number | string): string {
    return `${this.prefix}${tableName}:row:${id}`;
  }
  private tablePattern(tableName: string): string {
    return `${this.prefix}${tableName}:*`;
  }

  private async loadAll(tableName: string): Promise<Dict<any>[]> {
    await this.ensureConnected();
    const ids = await this.client.zRange(this.idsKey(tableName), 0, -1);
    if (ids.length === 0) return [];
    const rows: Dict<any>[] = [];
    for (const id of ids) {
      const hash = await this.client.hGetAll(this.rowKey(tableName, id));
      if (Object.keys(hash).length > 0) {
        rows.push(deserializeRow(hash as Dict<string>));
      }
    }
    return rows;
  }

  /**
   * Fast path: when the scope's filter is exactly `{pk: value}` or
   * `{$in: {pk: [...]}}`, Redis can resolve the row(s) via direct HGETALL on
   * the known key instead of a full ZRANGE + scan. Returns `null` when the
   * filter doesn't match one of those shapes so the caller falls back.
   */
  private async tryDirectIdLookup(scope: Scope): Promise<Dict<any>[] | null> {
    const filter = scope.filter;
    if (!filter || typeof filter !== 'object') return null;
    const filterKeys = Object.keys(filter);
    if (filterKeys.length !== 1) return null;

    const primaryKey = await this.resolvePrimaryKey(scope.tableName);
    const ids: (number | string)[] = [];

    // {pk: value}
    if (filterKeys[0] === primaryKey) {
      const value = (filter as Dict<any>)[primaryKey];
      if (typeof value === 'number' || typeof value === 'string') {
        ids.push(value);
      } else {
        return null;
      }
    } else if (filterKeys[0] === '$in') {
      const inner = (filter as Dict<any>).$in as Dict<any> | undefined;
      if (!inner || typeof inner !== 'object') return null;
      const innerKeys = Object.keys(inner);
      if (innerKeys.length !== 1 || innerKeys[0] !== primaryKey) return null;
      const values = inner[primaryKey];
      if (!Array.isArray(values)) return null;
      for (const v of values) {
        if (typeof v !== 'number' && typeof v !== 'string') return null;
        ids.push(v);
      }
    } else {
      return null;
    }

    await this.ensureConnected();
    const rows: Dict<any>[] = [];
    for (const id of ids) {
      const hash = await this.client.hGetAll(this.rowKey(scope.tableName, id));
      if (Object.keys(hash).length > 0) {
        rows.push(deserializeRow(hash as Dict<string>));
      }
    }
    return rows;
  }

  private async resolvePrimaryKey(tableName: string): Promise<string> {
    const meta = await this.client.get(this.metaKey(tableName));
    if (meta) {
      try {
        const def = JSON.parse(meta) as { primaryKey?: string };
        if (def.primaryKey) return def.primaryKey;
      } catch {
        // fall through
      }
    }
    return 'id';
  }

  private async resolveScope(scope: Scope): Promise<Dict<any>[]> {
    const fast = await this.tryDirectIdLookup(scope);
    if (fast !== null) {
      // Fast path already filtered by exact match; only order/limit/skip
      // matter for the remaining envelope.
      const ordered = applyOrder(fast, scope.order);
      return applyLimitSkip(ordered, scope);
    }
    const all = await this.loadAll(scope.tableName);
    const filtered = await filterList(all, scope.filter);
    const ordered = applyOrder(filtered, scope.order);
    return applyLimitSkip(ordered, scope);
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    return this.resolveScope(scope);
  }

  async count(scope: Scope): Promise<number> {
    const fast = await this.tryDirectIdLookup(scope);
    if (fast !== null) return fast.length;
    const all = await this.loadAll(scope.tableName);
    const filtered = await filterList(all, scope.filter);
    return filtered.length;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const rows = await this.resolveScope(scope);
    if (keys.length === 0) return rows;
    return rows.map((row) => {
      const subset: Dict<any> = {};
      for (const k of keys) subset[k] = row[k];
      return subset;
    });
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const rows = await this.resolveScope(scope);
    const primaryKey = await this.detectPrimaryKey(scope.tableName, rows);
    const updated: Dict<any>[] = [];
    for (const row of rows) {
      const id = row[primaryKey];
      if (id === undefined) continue;
      const merged = { ...row, ...attrs };
      const fields: Dict<string> = {};
      for (const k in attrs) fields[k] = encode(attrs[k]);
      await this.client.hSet(this.rowKey(scope.tableName, id), fields);
      updated.push(merged);
    }
    return updated;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const rows = await this.resolveScope(scope);
    const primaryKey = await this.detectPrimaryKey(scope.tableName, rows);
    const idsKey = this.idsKey(scope.tableName);
    for (const row of rows) {
      const id = row[primaryKey];
      if (id === undefined) continue;
      await this.client.del(this.rowKey(scope.tableName, id));
      await this.client.zRem(idsKey, String(id));
    }
    return rows;
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    if (spec.deltas.length === 0 && (!spec.set || Object.keys(spec.set).length === 0)) return 0;
    const rows = await this.resolveScope({
      tableName: spec.tableName,
      filter: spec.filter,
    } as Scope);
    if (rows.length === 0) return 0;
    const primaryKey = await this.detectPrimaryKey(spec.tableName, rows);
    const setFields: Dict<string> | undefined = spec.set
      ? Object.fromEntries(Object.keys(spec.set).map((k) => [k, encode(spec.set?.[k])]))
      : undefined;
    for (const row of rows) {
      const id = row[primaryKey];
      if (id === undefined) continue;
      const key = this.rowKey(spec.tableName, id);
      // Per-row MULTI: queue deltas + absolute sets and dispatch atomically.
      // Cross-row atomicity is not provided (would require a Lua script).
      const tx = this.client.multi();
      for (const { column, by } of spec.deltas) {
        if (Number.isInteger(by)) {
          tx.hIncrBy(key, column, by);
        } else {
          tx.hIncrByFloat(key, column, by);
        }
      }
      if (setFields) tx.hSet(key, setFields);
      await (tx as { exec: () => Promise<unknown[]> }).exec();
    }
    return rows.length;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    await this.ensureConnected();
    const primaryKey = Object.keys(keys)[0] ?? 'id';
    const keyType = keys[primaryKey];
    const inserted: Dict<any>[] = [];
    for (const item of items) {
      let id: number | string;
      if (keyType === KeyType.manual) {
        if (item[primaryKey] === undefined) {
          throw new PersistenceError(`KeyType.manual requires the caller to supply ${primaryKey}`);
        }
        id = item[primaryKey] as number | string;
      } else if (keyType === KeyType.uuid) {
        id =
          item[primaryKey] !== undefined
            ? (item[primaryKey] as string)
            : globalThis.crypto.randomUUID();
      } else {
        id =
          item[primaryKey] !== undefined
            ? Number(item[primaryKey])
            : await this.client.incr(this.nextIdKey(tableName));
      }
      const row = { ...item, [primaryKey]: id };
      const fields: Dict<string> = {};
      for (const k in row) fields[k] = encode(row[k]);
      await this.client.hSet(this.rowKey(tableName, id), fields);
      const score = typeof id === 'number' ? id : Date.now() + inserted.length;
      await this.client.zAdd(this.idsKey(tableName), { score, value: String(id) });
      inserted.push(row);
    }
    return inserted;
  }

  /**
   * Non-atomic upsert via SELECT-then-INSERT-or-UPDATE on the existing
   * primitives. Redis can't natively conflict on arbitrary `conflictTarget`
   * (it's a key-value store, not a relational one), so this is the best we
   * can do without a secondary index. Concurrent writes to the same
   * conflict tuple may race; wrap calls in `Model.transaction(...)` for the
   * snapshot/rollback safety net.
   */
  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    await this.ensureConnected();
    const primaryKey = Object.keys(spec.keys)[0] ?? 'id';

    let existingFilter: Filter<any>;
    if (spec.conflictTarget.length === 1) {
      const [col] = spec.conflictTarget;
      existingFilter = { $in: { [col]: spec.rows.map((r) => r[col]) } } as Filter<any>;
    } else {
      existingFilter = {
        $or: spec.rows.map((r) => {
          const sub: Dict<any> = {};
          for (const c of spec.conflictTarget) sub[c] = r[c];
          return sub;
        }),
      } as Filter<any>;
    }
    const existing = await this.resolveScope({
      tableName: spec.tableName,
      filter: existingFilter,
    });

    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c) => JSON.stringify(row[c])).join('|');
    const existingByTuple = new Map<string, Dict<any>>();
    for (const row of existing) existingByTuple.set(tupleKey(row), row);

    const allCols = new Set<string>();
    for (const r of spec.rows) for (const k of Object.keys(r)) allCols.add(k);
    const updateColumns =
      spec.updateColumns ?? [...allCols].filter((c) => !spec.conflictTarget.includes(c));
    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    const results: Dict<any>[] = [];
    const toInsert: Dict<any>[] = [];
    const insertSlots: number[] = [];

    for (let i = 0; i < spec.rows.length; i++) {
      const row = spec.rows[i];
      const match = existingByTuple.get(tupleKey(row));
      if (match) {
        if (ignore) {
          results[i] = match;
          continue;
        }
        const fields: Dict<string> = {};
        const merged: Dict<any> = { ...match };
        for (const col of updateColumns) {
          if (Object.hasOwn(row, col)) {
            fields[col] = encode(row[col]);
            merged[col] = row[col];
          }
        }
        if (Object.keys(fields).length > 0) {
          await this.client.hSet(this.rowKey(spec.tableName, match[primaryKey]), fields);
        }
        results[i] = merged;
      } else {
        toInsert.push(row);
        insertSlots.push(i);
      }
    }

    if (toInsert.length > 0) {
      const inserted = await this.batchInsert(spec.tableName, spec.keys, toInsert);
      for (let i = 0; i < inserted.length; i++) {
        results[insertSlots[i]] = inserted[i];
      }
    }

    return results;
  }

  /** Raw command escape hatch. `query` is the command name, `bindings` its args. */
  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    await this.ensureConnected();
    const args = Array.isArray(bindings) ? bindings : [bindings];
    const result = await this.client.sendCommand([query, ...args.map(String)]);
    return Array.isArray(result) ? result : [result];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn();
    await this.ensureConnected();
    const snapshots = new Map<string, TableSnapshot>();
    for (const tableName of await this.listTables()) {
      snapshots.set(tableName, await this.snapshotTable(tableName));
    }
    this.inTransaction = true;
    try {
      const result = await fn();
      this.inTransaction = false;
      return result;
    } catch (err) {
      const known = new Set(snapshots.keys());
      const current = new Set(await this.listTables());
      for (const tableName of current) {
        if (!known.has(tableName)) await this.dropTable(tableName);
      }
      for (const [tableName, snap] of snapshots) {
        await this.restoreTable(tableName, snap);
      }
      this.inTransaction = false;
      throw err;
    }
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const rows = await this.resolveScope(scope);
    const values = rows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (values.length === 0) return undefined;
    switch (kind) {
      case 'sum':
        return values.reduce((s, v) => s + v, 0);
      case 'min':
        return values.reduce((m, v) => (v < m ? v : m), values[0]);
      case 'max':
        return values.reduce((m, v) => (v > m ? v : m), values[0]);
      case 'avg':
        return values.reduce((s, v) => s + v, 0) / values.length;
    }
  }

  async hasTable(tableName: string): Promise<boolean> {
    await this.ensureConnected();
    return (await this.client.exists(this.metaKey(tableName))) === 1;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    await this.ensureConnected();
    if (await this.hasTable(tableName)) return;
    const def = defineTable(tableName, blueprint);
    await this.client.set(this.metaKey(tableName), JSON.stringify(def));
  }

  async dropTable(tableName: string): Promise<void> {
    await this.ensureConnected();
    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, {
        MATCH: this.tablePattern(tableName),
        COUNT: 100,
      });
      cursor = Number(result.cursor);
      if (result.keys.length > 0) await this.client.del(result.keys);
    } while (cursor !== 0);
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    switch (op.op) {
      case 'addColumn':
      case 'addIndex':
      case 'removeIndex':
      case 'renameIndex':
      case 'changeColumn':
        return;
      case 'removeColumn':
        await this.removeFieldFromAllRows(tableName, op.name);
        return;
      case 'renameColumn':
        await this.renameFieldInAllRows(tableName, op.from, op.to);
        return;
      case 'addForeignKey':
      case 'removeForeignKey':
      case 'addCheckConstraint':
      case 'removeCheckConstraint':
        throw new UnsupportedOperationError(
          `RedisConnector cannot apply ${op.op}: redis does not enforce relational constraints. Drop the operation from the migration or guard it with a connector capability check.`,
        );
    }
  }

  private async removeFieldFromAllRows(tableName: string, field: string): Promise<void> {
    await this.ensureConnected();
    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, {
        MATCH: this.tablePattern(tableName),
        COUNT: 100,
      });
      cursor = Number(result.cursor);
      for (const key of result.keys) {
        if (key.endsWith(':meta') || key.endsWith(':nextId') || key.endsWith(':ids')) continue;
        await this.client.hDel(key, field);
      }
    } while (cursor !== 0);
  }

  private async renameFieldInAllRows(tableName: string, from: string, to: string): Promise<void> {
    await this.ensureConnected();
    let cursor = 0;
    do {
      const result = await this.client.scan(cursor, {
        MATCH: this.tablePattern(tableName),
        COUNT: 100,
      });
      cursor = Number(result.cursor);
      for (const key of result.keys) {
        if (key.endsWith(':meta') || key.endsWith(':nextId') || key.endsWith(':ids')) continue;
        const value = await this.client.hGet(key, from);
        if (value === undefined || value === null) continue;
        await this.client.hSet(key, to, value);
        await this.client.hDel(key, from);
      }
    } while (cursor !== 0);
  }

  private async listTables(): Promise<string[]> {
    let cursor = 0;
    const tables = new Set<string>();
    do {
      const result = await this.client.scan(cursor, {
        MATCH: `${this.prefix}*:meta`,
        COUNT: 100,
      });
      cursor = Number(result.cursor);
      for (const key of result.keys) {
        const name = key.slice(this.prefix.length, -':meta'.length);
        tables.add(name);
      }
    } while (cursor !== 0);
    return [...tables];
  }

  private async snapshotTable(tableName: string): Promise<TableSnapshot> {
    const meta = await this.client.get(this.metaKey(tableName));
    const nextId = await this.client.get(this.nextIdKey(tableName));
    const ids = await this.client.zRange(this.idsKey(tableName), 0, -1);
    const rows = new Map<string, Dict<string>>();
    for (const id of ids) {
      const hash = await this.client.hGetAll(this.rowKey(tableName, id));
      rows.set(id, hash as Dict<string>);
    }
    return { meta, nextId, ids, rows };
  }

  private async restoreTable(tableName: string, snap: TableSnapshot): Promise<void> {
    await this.dropTable(tableName);
    if (snap.meta !== null) await this.client.set(this.metaKey(tableName), snap.meta);
    if (snap.nextId !== null) await this.client.set(this.nextIdKey(tableName), snap.nextId);
    const idsKey = this.idsKey(tableName);
    for (const id of snap.ids) {
      const score = Number(id);
      await this.client.zAdd(idsKey, {
        score: Number.isFinite(score) ? score : 0,
        value: id,
      });
      const hash = snap.rows.get(id);
      if (hash && Object.keys(hash).length > 0) {
        await this.client.hSet(this.rowKey(tableName, id), hash);
      }
    }
  }

  private async detectPrimaryKey(tableName: string, sample: Dict<any>[]): Promise<string> {
    const meta = await this.client.get(this.metaKey(tableName));
    if (meta) {
      try {
        const def = JSON.parse(meta) as { primaryKey?: string };
        if (def.primaryKey) return def.primaryKey;
      } catch {
        // fall through
      }
    }
    if (sample.length > 0 && sample[0].id !== undefined) return 'id';
    return 'id';
  }
}
