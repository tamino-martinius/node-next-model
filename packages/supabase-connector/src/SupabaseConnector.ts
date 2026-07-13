import {
  type Connector,
  type DatabaseSchema,
  type Dict,
  type KeyType,
  normalizeOrderEntry,
  PersistenceError,
  type Scope,
  SortDirection,
  type UpsertSpec,
} from '@next-model/core';
import { createClient } from '@supabase/supabase-js';
import { applyFilters } from './filters.js';
import type {
  PostgrestBuilderLike,
  PostgrestResult,
  SupabaseClientLike,
  SupabaseConfig,
  SupabaseCredentials,
} from './types.js';

export { MockSupabaseClient } from './MockSupabaseClient.js';
export type { SupabaseConfig } from './types.js';

function isClientLike(value: unknown): value is SupabaseClientLike {
  return typeof (value as { from?: unknown })?.from === 'function';
}

export class SupabaseConnector<S extends DatabaseSchema<any> | undefined = undefined>
  implements Connector<S>
{
  readonly schema?: S;
  protected readonly client: SupabaseClientLike;

  constructor(config: SupabaseConfig, extras?: { schema?: S }) {
    if (isClientLike(config)) {
      this.client = config;
    } else if ('client' in config && isClientLike(config.client)) {
      this.client = config.client;
    } else {
      const { url, key, options } = config as SupabaseCredentials;
      this.client = createClient(url, key, options) as unknown as SupabaseClientLike;
    }
    this.schema = extras?.schema;
  }

  /** Resolve the primary-key column for `tableName` from the attached schema. */
  protected pk(tableName: string): string {
    return this.schema?.tableDefinitions?.[tableName]?.primaryKey ?? 'id';
  }

  protected unwrap<T = Dict<any>>(result: PostgrestResult<T>): T[] {
    if (result.error) throw new PersistenceError(result.error.message);
    return result.data ?? [];
  }

  protected applyScope(builder: PostgrestBuilderLike, scope: Scope): PostgrestBuilderLike {
    applyFilters(builder, scope.filter);
    for (const entry of scope.order ?? []) {
      const { key, dir } = normalizeOrderEntry(entry);
      builder.order(String(key), { ascending: dir !== SortDirection.Desc });
    }
    if (scope.skip !== undefined && scope.limit !== undefined) {
      builder.range(scope.skip, scope.skip + scope.limit - 1);
    } else {
      if (scope.limit !== undefined) builder.limit(scope.limit);
      if (scope.skip !== undefined) builder.range(scope.skip, scope.skip + 1_000_000);
    }
    return builder;
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    const builder = this.applyScope(this.client.from(scope.tableName).select('*'), scope);
    return this.unwrap(await builder);
  }

  async count(scope: Scope): Promise<number> {
    const builder = this.client.from(scope.tableName).select('*', { count: 'exact', head: true });
    applyFilters(builder, scope.filter);
    const result = await builder;
    if (result.error) throw new PersistenceError(result.error.message);
    return result.count ?? 0;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const cols = keys.length === 0 ? '*' : keys.join(',');
    const builder = this.applyScope(this.client.from(scope.tableName).select(cols), scope);
    return this.unwrap(await builder);
  }

  async batchInsert(
    tableName: string,
    _keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const builder = this.client.from(tableName).insert(items).select();
    return this.unwrap(await builder);
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    if (Object.keys(attrs).length === 0) return this.query(scope);
    const builder = this.client.from(scope.tableName).update(attrs);
    applyFilters(builder, scope.filter);
    return this.unwrap(await builder.select());
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const builder = this.client.from(scope.tableName).delete();
    applyFilters(builder, scope.filter);
    return this.unwrap(await builder.select());
  }

  private async fetchByConflict(
    tableName: string,
    conflictTarget: string[],
    rows: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (rows.length === 0) return [];
    const builder = this.client.from(tableName).select('*');
    if (conflictTarget.length === 1) {
      const col = conflictTarget[0];
      builder.in(
        col,
        rows.map((r) => r[col]),
      );
    } else {
      // Multi-column conflict: OR each row's AND-tuple via PostgREST or(and(...)).
      const frag = rows
        .map((r) => `and(${conflictTarget.map((c) => `${c}.eq.${r[c]}`).join(',')})`)
        .join(',');
      builder.or(frag);
    }
    return this.unwrap(await builder);
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const conflict = spec.conflictTarget;
    // `String(...)` (not `JSON.stringify`) so `'5'` and `5` land on the same key —
    // matching how Postgres itself coerces conflict-column values when comparing.
    const tupleKey = (row: Dict<any>) => conflict.map((c) => String(row[c])).join('|');

    const cols = new Set<string>();
    for (const row of spec.rows) for (const k of Object.keys(row)) cols.add(k);
    const updateColumns = spec.updateColumns ?? [...cols].filter((c) => !conflict.includes(c));
    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    const existing = await this.fetchByConflict(spec.tableName, conflict, spec.rows);
    const existingByTuple = new Map<string, Dict<any>>();
    for (const row of existing) existingByTuple.set(tupleKey(row), row);

    // Results are assembled by input INDEX (not by re-deriving a tuple key from
    // the write payload), so a row that was in fact written can never fail to
    // be found in the returned array.
    const results: (Dict<any> | undefined)[] = new Array(spec.rows.length);
    const writeRows: Dict<any>[] = [];
    const writeIndex: number[] = [];
    spec.rows.forEach((row, i) => {
      const ex = existingByTuple.get(tupleKey(row));
      if (ex && ignore) {
        results[i] = ex; // skip write; existing row is returned as-is
        return;
      }
      let writeRow: Dict<any>;
      if (ex) {
        // Merge into an existing row: send ONLY the conflict columns + the
        // allowed update columns present on the input row. Never spread the
        // fetched `ex` row (which carries the primary key and every other
        // untouched column) — PostgREST's `merge-duplicates` resolution
        // already leaves columns absent from the payload untouched, so
        // re-sending `ex` would clobber any concurrent write made to a
        // column between our fetch and this upsert.
        writeRow = {};
        for (const c of conflict) writeRow[c] = row[c];
        for (const c of updateColumns) if (c in row) writeRow[c] = row[c];
      } else {
        // Brand-new row: insert exactly what the caller provided.
        // `updateColumns` only governs what changes on conflict — see
        // `UpsertSpec.updateColumns` — it never restricts what gets inserted.
        writeRow = row;
      }
      writeIndex.push(i);
      writeRows.push(writeRow);
    });

    if (writeRows.length > 0) {
      const written = this.unwrap(
        await this.client
          .from(spec.tableName)
          .upsert(writeRows, { onConflict: conflict.join(','), ignoreDuplicates: false })
          .select(),
      );
      const writtenByTuple = new Map<string, Dict<any>>();
      for (const row of written) writtenByTuple.set(tupleKey(row), row);
      for (let k = 0; k < writeIndex.length; k++) {
        const i = writeIndex[k];
        results[i] = writtenByTuple.get(tupleKey(writeRows[k])) ?? writeRows[k];
      }
    }

    return results.filter((row): row is Dict<any> => row !== undefined);
  }
}
