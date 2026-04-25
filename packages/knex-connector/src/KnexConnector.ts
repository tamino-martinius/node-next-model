try {
  const pg = require('pg');
  pg.types.setTypeParser(20, 'text', Number.parseInt);
} catch {}

import {
  type AggregateKind,
  type BaseType,
  type ColumnDefinition,
  type Connector,
  type Dict,
  defineTable,
  type Filter,
  type FilterBetween,
  FilterError,
  type FilterIn,
  type FilterRaw,
  type FilterSpecial,
  KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
  type UpsertSpec,
} from '@next-model/core';
import knexPkg, { type Knex } from 'knex';

// `knex` is a CommonJS package — under Node's ESM loader the named exports
// aren't synthesised reliably. Default-import + destructure is the portable
// shape.
const createKnex = knexPkg.knex;

function requireSingleKey(filter: Dict<any>, operator: string): string {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${operator} expects exactly one key, received ${keys.length}`);
  }
  return keys[0];
}

export class KnexConnector implements Connector {
  readonly supportsUpsert = true as const;
  knex: Knex;
  private activeTransaction: Knex.Transaction | undefined;

  constructor(options: Knex.Config) {
    this.knex = createKnex(options);
  }

  private table(tableName: string): Knex.QueryBuilder {
    const client = this.activeTransaction ?? this.knex;
    return client(tableName);
  }

  private async propertyFilter(query: Knex.QueryBuilder, filter: Dict<any>) {
    query = query.where(filter);
    return { query };
  }

  private async andFilter(query: Knex.QueryBuilder, filters: Filter<Dict<any>>[]) {
    const self = this;
    for (const filter of filters) {
      query = query.andWhere(async function () {
        await self.filter(this, filter);
      });
    }
    return { query };
  }

  private async notFilter(query: Knex.QueryBuilder, filter: Filter<Dict<any>>) {
    const self = this;
    query = query.whereNot(async function () {
      await self.filter(this, filter);
    });
    return { query };
  }

  private async orFilter(query: Knex.QueryBuilder, filters: Filter<Dict<any>>[]) {
    const self = this;
    for (const filter of filters) {
      query = query.orWhere(function () {
        self.filter(this, filter);
      });
    }
    return { query };
  }

  private async inFilter(query: Knex.QueryBuilder, filter: Partial<FilterIn<Dict<any>>>) {
    const key = requireSingleKey(filter, '$in');
    return { query: query.whereIn(key, filter[key] as any) };
  }

  private async notInFilter(query: Knex.QueryBuilder, filter: Partial<FilterIn<Dict<any>>>) {
    const key = requireSingleKey(filter, '$notIn');
    return { query: query.whereNotIn(key, filter[key] as any) };
  }

  private async nullFilter(query: Knex.QueryBuilder, key: string) {
    return { query: query.whereNull(key) };
  }

  private async notNullFilter(query: Knex.QueryBuilder, key: string) {
    return { query: query.whereNotNull(key) };
  }

  private async betweenFilter(query: Knex.QueryBuilder, filter: Partial<FilterBetween<Dict<any>>>) {
    const key = requireSingleKey(filter, '$between');
    const range = filter[key];
    if (range === undefined) {
      throw new FilterError(`$between missing range for key ${key}`);
    }
    return { query: query.andWhereBetween(key, [range.from, range.to] as any) };
  }

  private async notBetweenFilter(
    query: Knex.QueryBuilder,
    filter: Partial<FilterBetween<Dict<any>>>,
  ) {
    const key = requireSingleKey(filter, '$notBetween');
    const range = filter[key];
    if (range === undefined) {
      throw new FilterError(`$notBetween missing range for key ${key}`);
    }
    return { query: query.andWhereNotBetween(key, [range.from, range.to] as any) };
  }

  private async compareFilter(
    query: Knex.QueryBuilder,
    filter: Partial<Dict<any>>,
    operator: '>' | '>=' | '<' | '<=',
    name: string,
  ) {
    const key = requireSingleKey(filter, name);
    return { query: query.where(key, operator, filter[key] as any) };
  }

  private async likeFilter(query: Knex.QueryBuilder, filter: Partial<Dict<any>>) {
    const key = requireSingleKey(filter, '$like');
    return { query: query.where(key, 'like', filter[key] as any) };
  }

  private async rawFilter(query: Knex.QueryBuilder, filter: FilterRaw) {
    return {
      query: query.whereRaw(filter.$query, filter.$bindings || []),
    };
  }

  private async asyncFilter(query: Knex.QueryBuilder, filter: Promise<Filter<Dict<any>>>) {
    return this.filter(query, await filter);
  }

  private async specialFilter(
    query: Knex.QueryBuilder,
    filter: FilterSpecial<Dict<any>>,
  ): Promise<{ query: Knex.QueryBuilder }> {
    const keys = Object.keys(filter);
    if (keys.length !== 1) {
      throw new FilterError(
        `Special filter expects exactly one operator, received [${keys.join(', ')}]`,
      );
    }
    if (filter.$and !== undefined) return this.andFilter(query, filter.$and);
    if (filter.$or !== undefined) return this.orFilter(query, filter.$or);
    if (filter.$not !== undefined) return this.notFilter(query, filter.$not);
    if (filter.$in !== undefined) return this.inFilter(query, filter.$in);
    if (filter.$notIn !== undefined) return this.notInFilter(query, filter.$notIn);
    if (filter.$null !== undefined) return this.nullFilter(query, filter.$null as string);
    if (filter.$notNull !== undefined) return this.notNullFilter(query, filter.$notNull as string);
    if (filter.$between !== undefined) return this.betweenFilter(query, filter.$between);
    if (filter.$notBetween !== undefined) return this.notBetweenFilter(query, filter.$notBetween);
    if (filter.$gt !== undefined) return this.compareFilter(query, filter.$gt, '>', '$gt');
    if (filter.$gte !== undefined) return this.compareFilter(query, filter.$gte, '>=', '$gte');
    if (filter.$lt !== undefined) return this.compareFilter(query, filter.$lt, '<', '$lt');
    if (filter.$lte !== undefined) return this.compareFilter(query, filter.$lte, '<=', '$lte');
    if (filter.$like !== undefined) return this.likeFilter(query, filter.$like);
    if (filter.$async !== undefined) return this.asyncFilter(query, filter.$async);
    if (filter.$raw !== undefined) return this.rawFilter(query, filter.$raw);
    throw new FilterError(`Unsupported filter operator: ${keys[0]}`);
  }

  private async filter(query: Knex.QueryBuilder, filter: Filter<Dict<any>> | undefined) {
    if (!filter || Object.keys(filter).length === 0) {
      return { query };
    }
    for (const key in filter) {
      if (key.startsWith('$')) {
        return this.specialFilter(query, filter as FilterSpecial<Dict<any>>);
      }
    }
    return await this.propertyFilter(query, filter as Partial<Dict<any>>);
  }

  private applyOrder(query: Knex.QueryBuilder, order: Scope['order']): Knex.QueryBuilder {
    for (const column of order || []) {
      const direction = (column.dir ?? SortDirection.Asc) === SortDirection.Asc ? 'asc' : 'desc';
      query = query.orderBy(column.key as string, direction);
    }
    return query;
  }

  private async collection(scope: Scope) {
    const table = this.table(scope.tableName);
    let { query } = await this.filter(table, scope.filter);
    if (scope.limit !== undefined) {
      query = query.limit(scope.limit);
    }
    if (scope.skip !== undefined) {
      query = query.offset(scope.skip);
    }
    return { query };
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    let { query } = await this.collection(scope);
    query = this.applyOrder(query, scope.order);
    const rows: Dict<any>[] = await query.select('*');
    return rows;
  }

  async count(scope: Scope): Promise<number> {
    const { query } = await this.collection(scope);
    const rows: Dict<any>[] = await query.count();
    if (rows.length === 0) return 0;
    for (const key in rows[0]) {
      return Number(rows[0][key]);
    }
    return 0;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    let { query } = await this.collection(scope);
    query = this.applyOrder(query, scope.order);
    const rows: Dict<any>[] = await query.select(...keys);
    return rows;
  }

  async updateAll(scope: Scope, attrs: Dict<any>): Promise<Dict<any>[]> {
    const clientName = this.knex.client.config.client;
    const supportsReturning =
      clientName !== 'sqlite3' && clientName !== 'mysql' && clientName !== 'mysql2';
    const table = this.table(scope.tableName);
    const { query } = await this.filter(table, scope.filter);
    let rows: any;
    if (supportsReturning) {
      try {
        rows = await query.update(attrs).returning(`${scope.tableName}.*`);
      } catch (_err) {
        rows = await query.update(attrs);
      }
    } else {
      rows = await query.update(attrs);
    }
    if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
      return rows as Dict<any>[];
    }
    const matching = await this.query(scope);
    for (const row of matching) {
      Object.assign(row, attrs);
    }
    return matching;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const matching = await this.query(scope);
    const table = this.table(scope.tableName);
    const { query } = await this.filter(table, scope.filter);
    await query.del();
    return matching;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const primaryKey = Object.keys(keys)[0];
    const isManualKey = keys[primaryKey] === KeyType.manual;
    const clientName = this.knex.client.config.client;
    const isSqlite = clientName === 'sqlite3';

    if (isSqlite) {
      const results: Dict<any>[] = [];
      for (const item of items) {
        const insertResult = await this.table(tableName).insert(item);
        if (isManualKey) {
          results.push({ ...item });
          continue;
        }
        const insertedId = Array.isArray(insertResult) ? insertResult[0] : insertResult;
        const row = (await this.table(tableName).where(primaryKey, insertedId).first()) as
          | Dict<any>
          | undefined;
        if (row === undefined) {
          throw new PersistenceError(`batchInsert into ${tableName} returned no row`);
        }
        results.push(row);
      }
      return results;
    }

    if (isManualKey) {
      const rows = await this.table(tableName).insert(items).returning(`${tableName}.*`);
      if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
        return rows as Dict<any>[];
      }
      return items.map((item) => ({ ...item }));
    }

    const idsOrRows = await this.table(tableName).insert(items).returning(`${tableName}.*`);
    if (idsOrRows.length === 0) {
      throw new PersistenceError(`batchInsert into ${tableName} returned no rows`);
    }
    if (typeof idsOrRows[0] === 'object') {
      return idsOrRows as Dict<any>[];
    }
    const returnedIds = idsOrRows as number[];
    const isMysql = clientName === 'mysql' || clientName === 'mysql2';
    const ids =
      isMysql && returnedIds.length === 1 && items.length > 1
        ? items.map((_, i) => returnedIds[0] + i)
        : returnedIds;
    const rows = (await this.table(tableName).whereIn(primaryKey, ids).select('*')) as Dict<any>[];
    const rowDict: Dict<Dict<any>> = {};
    for (const row of rows) {
      rowDict[row[primaryKey]] = row;
    }
    return ids.map((id) => rowDict[id]).filter((r): r is Dict<any> => r !== undefined);
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const clientName = this.knex.client.config.client;
    const isPg = clientName === 'pg' || clientName === 'postgres';
    const isMysql = clientName === 'mysql' || clientName === 'mysql2';
    const isSqlite = clientName === 'sqlite3';

    const allColumns = new Set<string>();
    for (const row of spec.rows) {
      for (const col of Object.keys(row)) allColumns.add(col);
    }
    const updateColumns =
      spec.updateColumns ?? [...allColumns].filter((c) => !spec.conflictTarget.includes(c));

    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    // SQLite emits multi-row INSERT as UNION ALL, capped at SQLITE_LIMIT_COMPOUND_SELECT
    // (default 500). Chunk to stay safely below; pg/mysql accept the whole batch in one shot.
    const chunkSize = isSqlite ? 200 : spec.rows.length;
    const chunks: Dict<any>[][] = [];
    for (let i = 0; i < spec.rows.length; i += chunkSize) {
      chunks.push(spec.rows.slice(i, i + chunkSize));
    }

    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c: string) => JSON.stringify(row[c])).join('|');
    const byTuple = new Map<string, Dict<any>>();

    const runChunks = async () => {
      for (const chunk of chunks) {
        let insertQuery = this.table(spec.tableName).insert(chunk);
        if (isMysql) {
          insertQuery = ignore
            ? insertQuery.onConflict().ignore()
            : insertQuery.onConflict().merge(updateColumns);
        } else {
          insertQuery = ignore
            ? insertQuery.onConflict(spec.conflictTarget).ignore()
            : insertQuery.onConflict(spec.conflictTarget).merge(updateColumns);
        }
        if (isPg) {
          const returned = (await insertQuery.returning(`${spec.tableName}.*`)) as Dict<any>[];
          for (const row of returned) byTuple.set(tupleKey(row), row);
        } else {
          await insertQuery;
        }
      }
    };

    if (chunks.length > 1) {
      await this.transaction(runChunks);
    } else {
      await runChunks();
    }

    const missingRows: Dict<any>[] = [];
    for (const row of spec.rows) {
      if (!byTuple.has(tupleKey(row))) missingRows.push(row);
    }

    if (missingRows.length > 0) {
      let selectQuery = this.table(spec.tableName);
      if (spec.conflictTarget.length === 1) {
        const [col] = spec.conflictTarget;
        const values = missingRows.map((r) => r[col]);
        selectQuery = selectQuery.whereIn(col, values as any);
      } else {
        selectQuery = selectQuery.where(function () {
          for (const row of missingRows) {
            const where: Dict<any> = {};
            for (const col of spec.conflictTarget) where[col] = row[col];
            this.orWhere(where);
          }
        });
      }
      const fetched = (await selectQuery.select('*')) as Dict<any>[];
      for (const row of fetched) byTuple.set(tupleKey(row), row);
    }

    return spec.rows
      .map((row: Dict<any>) => byTuple.get(tupleKey(row)))
      .filter((row: Dict<any> | undefined): row is Dict<any> => row !== undefined);
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const { query } = await this.collection(scope);
    const column = `${kind}_result`;
    const rows: Dict<any>[] = await query[kind](`${key} as ${column}`);
    if (rows.length === 0) return undefined;
    const value = rows[0][column];
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const client = this.activeTransaction ?? this.knex;
    const result: any = await client.raw(query, bindings as any);
    const clientName = this.knex.client.config.client;
    if (clientName === 'sqlite3') return result;
    if (clientName === 'postgres' || clientName === 'pg') return result.rows;
    if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
    return result;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeTransaction) return fn();
    return this.knex.transaction(async (trx) => {
      this.activeTransaction = trx;
      try {
        return await fn();
      } finally {
        this.activeTransaction = undefined;
      }
    });
  }

  private schemaBuilder(): Knex.SchemaBuilder {
    return this.activeTransaction?.schema ?? this.knex.schema;
  }

  async hasTable(tableName: string): Promise<boolean> {
    return this.schemaBuilder().hasTable(tableName);
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const def = defineTable(tableName, blueprint);
    if (await this.hasTable(tableName)) return;
    await this.schemaBuilder().createTable(tableName, (table) => {
      for (const col of def.columns) {
        if (col.autoIncrement) {
          const auto = table.increments(col.name);
          if (col.unique) auto.unique();
          continue;
        }
        const columnBuilder = buildKnexColumn(table, col);
        if (col.primary) columnBuilder.primary();
        if (col.unique) columnBuilder.unique();
        if (col.nullable) columnBuilder.nullable();
        else columnBuilder.notNullable();
        if (col.default !== undefined) {
          if (col.default === 'currentTimestamp') {
            columnBuilder.defaultTo(this.knex.fn.now());
          } else {
            columnBuilder.defaultTo(col.default as any);
          }
        }
      }
      for (const idx of def.indexes) {
        if (idx.unique) table.unique(idx.columns, idx.name);
        else table.index(idx.columns, idx.name);
      }
    });
  }

  async dropTable(tableName: string): Promise<void> {
    await this.schemaBuilder().dropTableIfExists(tableName);
  }
}

function buildKnexColumn(
  table: Knex.CreateTableBuilder,
  col: ColumnDefinition,
): Knex.ColumnBuilder {
  switch (col.type) {
    case 'string':
      return table.string(col.name, col.limit ?? 255);
    case 'text':
      return table.text(col.name);
    case 'integer':
      return table.integer(col.name);
    case 'bigint':
      return table.bigInteger(col.name);
    case 'float':
      return table.float(col.name);
    case 'decimal':
      return table.decimal(col.name, col.precision, col.scale);
    case 'boolean':
      return table.boolean(col.name);
    case 'date':
      return table.date(col.name);
    case 'datetime':
    case 'timestamp':
      return table.timestamp(col.name);
    case 'json':
      return table.json(col.name);
  }
}

export default KnexConnector;
