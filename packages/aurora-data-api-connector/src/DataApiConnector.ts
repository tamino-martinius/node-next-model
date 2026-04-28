import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
  type ColumnDefault,
  type ColumnDefinition,
  type ColumnKind,
  type ColumnOptions,
  type Connector,
  type DeltaUpdateSpec,
  type Dict,
  defineTable,
  type Filter,
  type FilterBetween,
  FilterError,
  type FilterIn,
  type FilterRaw,
  type FilterSpecial,
  type ForeignKeyAction,
  foreignKeyName,
  type IndexDefinition,
  type JoinClause,
  type JoinQuerySpec,
  type KeyType,
  PersistenceError,
  type Projection,
  type QueryScopedSpec,
  type Scope,
  SortDirection,
  type TableBuilder,
  type TableDefinition,
  type UpsertSpec,
} from '@next-model/core';
import knexPkg, { type Knex } from 'knex';

// `knex` is a CommonJS package — under Node's ESM loader the named exports
// aren't synthesised reliably. Default-import + destructure is the portable
// shape.
const createKnex = knexPkg.knex;

export interface DataApiQueryResult {
  records?: Dict<any>[];
  insertId?: number;
  numberOfRecordsUpdated?: number;
}

export interface DataApiClient {
  query(sql: string, params?: Dict<any>): Promise<DataApiQueryResult>;
  beginTransaction?(): Promise<unknown>;
  commitTransaction?(id: unknown): Promise<void>;
  rollbackTransaction?(id: unknown): Promise<void>;
}

export type DataApiDialect = 'postgres' | 'mysql';

export interface DataApiConfig {
  secretArn?: string;
  resourceArn?: string;
  database?: string;
  debug?: boolean;
  client?: DataApiClient;
  /**
   * Underlying engine for the Data API. Aurora Serverless v1 / v2 supports
   * both Postgres and MySQL. When omitted, the connector defaults to
   * `'postgres'` (the more common Aurora setup) and `reflectSchema()`
   * dispatches to the Postgres `information_schema` queries.
   */
  dialect?: DataApiDialect;
}

function requireSingleKey(filter: Dict<any>, operator: string): string {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${operator} expects exactly one key, received ${keys.length}`);
  }
  return keys[0];
}

export class DataApiConnector implements Connector {
  dataApi: DataApiClient;
  knex: Knex = createKnex({ client: 'pg' });
  debug: boolean;
  dialect: DataApiDialect;
  private activeTransactionId: unknown;

  constructor(options: DataApiConfig) {
    if (options.client) {
      this.dataApi = options.client;
    } else {
      this.dataApi = require('data-api-client')(options);
    }
    this.debug = options.debug ?? false;
    this.dialect = options.dialect ?? 'postgres';
  }

  private currentMilliseconds(): number {
    const hrTime = process.hrtime();
    return hrTime[0] * 1000 + hrTime[1] / 1000000;
  }

  private toSqlAndParams(query: Knex.QueryBuilder): { sql: string; params: Dict<any> } {
    const sql = query.toSQL();
    const bindings = sql.bindings as any[];
    if (bindings.length !== (sql.sql.match(/\?/g) || []).length) {
      throw new PersistenceError('Mismatched bindings and placeholders in generated SQL');
    }
    let i = 0;
    const params: Dict<any> = {};
    const sqlStatement = sql.sql.replace(/\?/g, () => {
      const key = `param${i}`;
      params[key] = bindings[i];
      i += 1;
      return `:${key}`;
    });
    return { sql: sqlStatement, params };
  }

  private async runQuery(query: Knex.QueryBuilder): Promise<DataApiQueryResult> {
    const { sql, params } = this.toSqlAndParams(query);
    const startTime = this.currentMilliseconds();
    const result = await this.dataApi.query(sql, params);
    if (this.debug) {
      const elapsed = this.currentMilliseconds() - startTime;
      console.log([sql, JSON.stringify(params), `${elapsed.toFixed(3)} ms\n`].join(' | '));
    }
    return result;
  }

  private table(tableName: string): Knex.QueryBuilder {
    return this.knex(tableName);
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
    const result = await this.runQuery(query.select('*'));
    return result.records ?? [];
  }

  /**
   * Emits ONE SQL statement using nested `WHERE col IN (SELECT … FROM …)`
   * subqueries — one per `parentScope`. The leaf builder runs against the
   * target table; each parent scope projects its `link.parentColumn` and
   * gates the next level (or the leaf) via that scope's `link.childColumn`.
   * Builders resolve `pendingJoins` to `$in` / `$notIn` filters before calling
   * this method, so the connector only sees a flat scope.
   */
  async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
    if (spec.pendingJoins.length > 0) {
      throw new PersistenceError(
        `DataApiConnector.queryScoped expects pendingJoins to be resolved upstream; received ${spec.pendingJoins.length} unresolved join(s). Use the CollectionQuery / ScalarQuery / ColumnQuery builders to materialise scopes with joins.`,
      );
    }

    let builder = this.table(spec.target.tableName);

    for (const parent of spec.parentScopes) {
      const self = this;
      builder = builder.whereIn(parent.link.childColumn, async function (this: Knex.QueryBuilder) {
        this.from(parent.parentTable).select(parent.link.parentColumn);
        if (parent.parentFilter) await self.filter(this, parent.parentFilter);
        self.applyOrder(this, parent.parentOrder);
        if (parent.parentLimit !== undefined) this.limit(parent.parentLimit);
      });
    }

    if (spec.filter) {
      ({ query: builder } = await this.filter(builder, spec.filter));
    }
    builder = this.applyOrder(builder, spec.order);
    if (spec.limit !== undefined) builder = builder.limit(spec.limit);
    if (spec.skip !== undefined) builder = builder.offset(spec.skip);

    const projection: Projection = spec.projection;
    if (projection === 'rows') {
      const result = await this.runQuery(builder.select('*'));
      return result.records ?? [];
    }
    if (typeof projection === 'object' && projection.kind === 'pk') {
      const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
      const result = await this.runQuery(builder.select(pkName));
      return (result.records ?? []).map((r) => r[pkName]);
    }
    if (typeof projection === 'object' && projection.kind === 'column') {
      const result = await this.runQuery(builder.select(projection.column));
      return (result.records ?? []).map((r) => r[projection.column]);
    }
    if (typeof projection === 'object' && projection.kind === 'aggregate') {
      if (projection.op === 'count') {
        const result = await this.runQuery(builder.count('* as c'));
        const rows = result.records ?? [];
        if (rows.length === 0) return 0;
        const v = rows[0].c;
        return v == null ? 0 : Number(v);
      }
      if (!projection.column) {
        throw new PersistenceError(
          `Aggregate '${projection.op}' requires a column; received undefined.`,
        );
      }
      const fn = projection.op as AggregateKind;
      const result = await this.runQuery(
        (builder as any)[fn](`${projection.column} as v`) as Knex.QueryBuilder,
      );
      const rows = result.records ?? [];
      if (rows.length === 0) return undefined;
      const v = rows[0].v;
      return v == null ? undefined : Number(v);
    }
    throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
  }

  async queryWithJoins(spec: JoinQuerySpec): Promise<Dict<any>[]> {
    const { parent, joins } = spec;
    const parentTable = parent.tableName;
    let builder = this.table(parentTable);
    builder = (await this.filter(builder, parent.filter)).query;
    for (const join of joins) {
      if (join.mode === 'select') {
        builder = this.applyExistsJoin(builder, parentTable, join, 'whereExists');
      } else if (join.mode === 'antiJoin') {
        builder = this.applyExistsJoin(builder, parentTable, join, 'whereNotExists');
      }
    }
    builder = this.applyOrder(builder, parent.order);
    if (parent.skip !== undefined) builder = builder.offset(parent.skip);
    if (parent.limit !== undefined) builder = builder.limit(parent.limit);
    const result = await this.runQuery(builder.select(`${parentTable}.*`));
    const parentRows = result.records ?? [];
    return this.attachIncludesViaJoins(parentRows, joins);
  }

  /** Wrap a child-table EXISTS / NOT EXISTS clause around the parent query. */
  private applyExistsJoin(
    query: Knex.QueryBuilder,
    parentTable: string,
    join: JoinClause,
    method: 'whereExists' | 'whereNotExists',
  ): Knex.QueryBuilder {
    const self = this;
    const childTable = join.childTableName;
    const parentColumn = join.on.parentColumn;
    const childColumn = join.on.childColumn;
    const childFilter = join.filter;
    return query[method](async function (this: Knex.QueryBuilder) {
      this.select(self.knex.raw('1'))
        .from(childTable)
        .whereRaw('?? = ??', [`${childTable}.${childColumn}`, `${parentTable}.${parentColumn}`]);
      if (childFilter) {
        await self.filter(this, childFilter);
      }
    });
  }

  /** Batched IN per `mode: 'includes'` join; groups by parent key in JS. */
  private async attachIncludesViaJoins(
    parentRows: Dict<any>[],
    joins: JoinClause[],
  ): Promise<Dict<any>[]> {
    const includesJoins = joins.filter((j) => j.mode === 'includes');
    if (includesJoins.length === 0) return parentRows;
    for (const row of parentRows) (row as Dict<any>).__includes = {};
    for (const join of includesJoins) {
      const parentKeys: BaseType[] = [];
      const seen = new Set<unknown>();
      for (const row of parentRows) {
        const v = (row as Dict<any>)[join.on.parentColumn];
        if (v == null || seen.has(v)) continue;
        seen.add(v);
        parentKeys.push(v as BaseType);
      }
      const attach = join.attachAs ?? '';
      if (parentKeys.length === 0) {
        for (const row of parentRows) {
          ((row as Dict<any>).__includes as Dict<Dict<any>[]>)[attach] = [];
        }
        continue;
      }
      const childFilter: Filter<any> = join.filter
        ? ({
            $and: [{ $in: { [join.on.childColumn]: parentKeys } }, join.filter],
          } as Filter<any>)
        : ({ $in: { [join.on.childColumn]: parentKeys } } as Filter<any>);
      const childRows = await this.query({
        tableName: join.childTableName,
        filter: childFilter,
      });
      const grouped = new Map<unknown, Dict<any>[]>();
      for (const child of childRows) {
        const k = (child as Dict<any>)[join.on.childColumn];
        if (k == null) continue;
        const list = grouped.get(k);
        if (list) list.push(child);
        else grouped.set(k, [child]);
      }
      for (const row of parentRows) {
        const key = (row as Dict<any>)[join.on.parentColumn];
        ((row as Dict<any>).__includes as Dict<Dict<any>[]>)[attach] = grouped.get(key) ?? [];
      }
    }
    return parentRows;
  }

  async count(scope: Scope): Promise<number> {
    const { query } = await this.collection(scope);
    const result = await this.runQuery(query.count('* as count'));
    const rows = result.records ?? [];
    if (rows.length === 0) return 0;
    for (const key in rows[0]) {
      return Number(rows[0][key]);
    }
    return 0;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    let { query } = await this.collection(scope);
    query = this.applyOrder(query, scope.order);
    const result = await this.runQuery(query.select(...keys));
    return result.records ?? [];
  }

  async updateAll(scope: Scope, attrs: Dict<any>): Promise<Dict<any>[]> {
    const { query: updateQuery } = await this.collection(scope);
    await this.runQuery(updateQuery.update(attrs));
    const updated = await this.query(scope);
    return updated;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const matching = await this.query(scope);
    const { query } = await this.collection(scope);
    await this.runQuery(query.del());
    return matching;
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    if (spec.deltas.length === 0 && (!spec.set || Object.keys(spec.set).length === 0)) return 0;
    const update: Dict<any> = {};
    for (const { column, by } of spec.deltas) {
      update[column] = this.knex.raw('COALESCE(??, 0) + ?', [column, by]);
    }
    if (spec.set) {
      for (const k of Object.keys(spec.set)) update[k] = spec.set[k];
    }
    const { query } = await this.collection({
      tableName: spec.tableName,
      filter: spec.filter,
    } as Scope);
    const result = await this.runQuery(query.update(update));
    return Number(result.numberOfRecordsUpdated ?? 0);
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const primaryKey = Object.keys(keys)[0];
    const inserted: Dict<any>[] = [];
    for (const item of items) {
      const builder = this.table(tableName).insert(item);
      const result = await this.runQuery(builder);
      const insertId = result.insertId;
      if (insertId === undefined) {
        throw new PersistenceError(`insert into ${tableName} did not return an insertId`);
      }
      const fetched = await this.runQuery(
        this.table(tableName).where(primaryKey, insertId).select('*'),
      );
      const row = fetched.records?.[0];
      if (row === undefined) {
        throw new PersistenceError(
          `insert into ${tableName} row with ${primaryKey}=${insertId} not found`,
        );
      }
      inserted.push(row);
    }
    return inserted;
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const allCols = new Set<string>();
    for (const row of spec.rows) for (const k of Object.keys(row)) allCols.add(k);
    const updateColumns =
      spec.updateColumns ?? [...allCols].filter((c) => !spec.conflictTarget.includes(c));
    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    let builder = this.table(spec.tableName).insert(spec.rows);
    builder = ignore
      ? builder.onConflict(spec.conflictTarget).ignore()
      : builder.onConflict(spec.conflictTarget).merge(updateColumns);
    builder = builder.returning('*');
    const result = await this.runQuery(builder);
    const inserted = result.records ?? [];

    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c: string) => JSON.stringify(row[c])).join('|');
    const byTuple = new Map<string, Dict<any>>();
    for (const row of inserted) byTuple.set(tupleKey(row), row);

    const missing = spec.rows.filter((r) => !byTuple.has(tupleKey(r)));
    if (missing.length > 0) {
      let selectQuery = this.table(spec.tableName);
      if (spec.conflictTarget.length === 1) {
        const [col] = spec.conflictTarget;
        selectQuery = selectQuery.whereIn(col, missing.map((r) => r[col]) as any);
      } else {
        selectQuery = selectQuery.where(function () {
          for (const r of missing) {
            const w: Dict<any> = {};
            for (const c of spec.conflictTarget) w[c] = r[c];
            this.orWhere(w);
          }
        });
      }
      const fetchedResult = await this.runQuery(selectQuery.select('*'));
      for (const row of fetchedResult.records ?? []) byTuple.set(tupleKey(row), row);
    }

    return spec.rows
      .map((row: Dict<any>) => byTuple.get(tupleKey(row)))
      .filter((row: Dict<any> | undefined): row is Dict<any> => row !== undefined);
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const { query } = await this.collection(scope);
    const column = `${kind}_result`;
    const result = await this.runQuery(query[kind](`${key} as ${column}`));
    const rows = result.records ?? [];
    if (rows.length === 0) return undefined;
    const value = rows[0][column];
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const bindingsArray = Array.isArray(bindings) ? bindings : [bindings];
    const params: Dict<any> = {};
    let i = 0;
    const sqlStatement = query.replace(/\?/g, () => {
      const paramKey = `param${i}`;
      params[paramKey] = bindingsArray[i];
      i += 1;
      return `:${paramKey}`;
    });
    const result = await this.dataApi.query(sqlStatement, params);
    return result.records ?? [];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeTransactionId !== undefined) {
      return fn();
    }
    if (
      !this.dataApi.beginTransaction ||
      !this.dataApi.commitTransaction ||
      !this.dataApi.rollbackTransaction
    ) {
      throw new PersistenceError('Data API client does not support transactions');
    }
    const id = await this.dataApi.beginTransaction();
    this.activeTransactionId = id;
    try {
      const result = await fn();
      await this.dataApi.commitTransaction(id);
      return result;
    } catch (err) {
      await this.dataApi.rollbackTransaction(id);
      throw err;
    } finally {
      this.activeTransactionId = undefined;
    }
  }

  async hasTable(tableName: string): Promise<boolean> {
    validateIdentifier(tableName);
    try {
      await this.dataApi.query(`SELECT 1 FROM ${tableName} LIMIT 0`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reflect the live schema by querying `information_schema` (the same view
   * shape Postgres and MySQL both expose). The dispatch is decided at
   * construction time via `options.dialect` (defaults to `'postgres'`).
   * Returns one `TableDefinition` per user table with column kinds, primary
   * key, indexes, and `auto_increment` / `nextval(...)` flags mapped back
   * through the dialect-specific type tables. Throws `PersistenceError`
   * when the dialect is anything other than `'postgres'` / `'mysql'`.
   */
  async reflectSchema(): Promise<TableDefinition[]> {
    if (this.dialect === 'postgres') return this.reflectSchemaPostgres();
    if (this.dialect === 'mysql') return this.reflectSchemaMysql();
    throw new PersistenceError(
      `DataApiConnector.reflectSchema does not support dialect ${String(this.dialect)}`,
    );
  }

  /** Postgres `information_schema` reflection — see `PostgresConnector.reflectSchema`. */
  private async reflectSchemaPostgres(): Promise<TableDefinition[]> {
    const tablesRes = await this.dataApi.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const tables = (tablesRes.records ?? []) as Array<{ table_name: string }>;
    const result: TableDefinition[] = [];
    for (const row of tables) {
      const tableName = row.table_name;
      const colsRes = await this.dataApi.query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default,
                character_maximum_length, numeric_precision, numeric_scale,
                ordinal_position
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = :tableName
         ORDER BY ordinal_position`,
        { tableName },
      );
      const pkRes = await this.dataApi.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = :tableName
           AND tc.constraint_type = 'PRIMARY KEY'`,
        { tableName },
      );
      const pkColumns = new Set(
        ((pkRes.records ?? []) as Array<{ column_name: string }>).map((r) => r.column_name),
      );
      const uniqueRes = await this.dataApi.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = :tableName
           AND tc.constraint_type = 'UNIQUE'
         GROUP BY kcu.constraint_name, kcu.column_name
         HAVING COUNT(*) = 1`,
        { tableName },
      );
      const uniqueColumns = new Set(
        ((uniqueRes.records ?? []) as Array<{ column_name: string }>).map((r) => r.column_name),
      );

      const idxRes = await this.dataApi.query(
        `SELECT i.relname AS index_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                a.attname AS column_name,
                array_position(ix.indkey, a.attnum) AS ord,
                COALESCE(con.contype, '') AS contype
         FROM pg_class t
         JOIN pg_index ix ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
         LEFT JOIN pg_constraint con ON con.conindid = i.oid
         WHERE n.nspname = current_schema() AND t.relname = :tableName
         ORDER BY i.relname, ord`,
        { tableName },
      );
      const indexMap = new Map<
        string,
        {
          columns: { column: string; ord: number }[];
          unique: boolean;
          primary: boolean;
          contype: string;
        }
      >();
      for (const ir of (idxRes.records ?? []) as Array<{
        index_name: string;
        is_unique: boolean;
        is_primary: boolean;
        column_name: string;
        ord: number;
        contype: string;
      }>) {
        let entry = indexMap.get(ir.index_name);
        if (!entry) {
          entry = {
            columns: [],
            unique: ir.is_unique,
            primary: ir.is_primary,
            contype: ir.contype,
          };
          indexMap.set(ir.index_name, entry);
        }
        entry.columns.push({ column: ir.column_name, ord: Number(ir.ord) });
      }
      const indexes: IndexDefinition[] = [];
      for (const [name, entry] of indexMap) {
        // PRIMARY KEY backing index — round-trips via column.primary.
        if (entry.primary || entry.contype === 'p') continue;
        // Single-column UNIQUE constraint — round-trips via column.unique.
        // Multi-column unique constraints stay as IndexDefinitions because
        // they cannot be expressed on a single column.
        if (entry.contype === 'u' && entry.columns.length === 1) continue;
        entry.columns.sort((a, b) => a.ord - b.ord);
        indexes.push({
          columns: entry.columns.map((c) => c.column),
          unique: entry.unique,
          name,
        });
      }

      const columns: ColumnDefinition[] = (
        (colsRes.records ?? []) as Array<{
          column_name: string;
          data_type: string;
          udt_name: string;
          is_nullable: 'YES' | 'NO';
          column_default: string | null;
          character_maximum_length: number | null;
          numeric_precision: number | null;
          numeric_scale: number | null;
        }>
      ).map((c) => {
        const isPrimary = pkColumns.has(c.column_name);
        const isUnique = uniqueColumns.has(c.column_name);
        const kind = pgTypeToColumnKind(c.data_type, c.udt_name);
        const defaultRaw = c.column_default;
        const autoIncrement =
          isPrimary &&
          (kind === 'integer' || kind === 'bigint') &&
          typeof defaultRaw === 'string' &&
          /^nextval\(/i.test(defaultRaw);
        return {
          name: c.column_name,
          type: kind,
          nullable: c.is_nullable === 'YES' && !isPrimary,
          default: autoIncrement ? undefined : parsePgDefault(defaultRaw, kind),
          limit: kind === 'string' ? (c.character_maximum_length ?? undefined) : undefined,
          primary: isPrimary,
          unique: isUnique && !isPrimary,
          precision:
            kind === 'decimal' && c.numeric_precision !== null ? c.numeric_precision : undefined,
          scale: kind === 'decimal' && c.numeric_scale !== null ? c.numeric_scale : undefined,
          autoIncrement,
        };
      });

      const primaryKey = columns.find((c) => c.primary)?.name;
      result.push({ name: tableName, columns, indexes, primaryKey });
    }
    return result;
  }

  /** MySQL `information_schema` reflection — see `MysqlConnector.reflectSchema`. */
  private async reflectSchemaMysql(): Promise<TableDefinition[]> {
    const tablesRes = await this.dataApi.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
    );
    const tables = (tablesRes.records ?? []) as Array<{ TABLE_NAME: string }>;
    const result: TableDefinition[] = [];
    for (const row of tables) {
      const tableName = row.TABLE_NAME;
      const colsRes = await this.dataApi.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY,
                CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName
         ORDER BY ORDINAL_POSITION`,
        { tableName },
      );
      const idxRes = await this.dataApi.query(
        `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        { tableName },
      );
      const indexMap = new Map<string, { columns: string[]; unique: boolean }>();
      for (const ir of (idxRes.records ?? []) as Array<{
        INDEX_NAME: string;
        NON_UNIQUE: number;
        COLUMN_NAME: string;
        SEQ_IN_INDEX: number;
      }>) {
        let entry = indexMap.get(ir.INDEX_NAME);
        if (!entry) {
          entry = { columns: [], unique: ir.NON_UNIQUE === 0 };
          indexMap.set(ir.INDEX_NAME, entry);
        }
        entry.columns.push(ir.COLUMN_NAME);
      }
      const singleUniqueColumns = new Set<string>();
      const indexes: IndexDefinition[] = [];
      for (const [name, entry] of indexMap) {
        if (name === 'PRIMARY') continue;
        if (entry.unique && entry.columns.length === 1) {
          singleUniqueColumns.add(entry.columns[0]);
          continue;
        }
        indexes.push({ columns: entry.columns, unique: entry.unique, name });
      }

      const columns: ColumnDefinition[] = (
        (colsRes.records ?? []) as Array<{
          COLUMN_NAME: string;
          DATA_TYPE: string;
          COLUMN_TYPE: string;
          IS_NULLABLE: 'YES' | 'NO';
          COLUMN_DEFAULT: string | null;
          COLUMN_KEY: string;
          CHARACTER_MAXIMUM_LENGTH: number | null;
          NUMERIC_PRECISION: number | null;
          NUMERIC_SCALE: number | null;
          EXTRA: string;
        }>
      ).map((c) => {
        const isPrimary = c.COLUMN_KEY === 'PRI';
        const kind = mysqlTypeToColumnKind(c.DATA_TYPE, c.COLUMN_TYPE);
        const autoIncrement = /auto_increment/i.test(c.EXTRA);
        return {
          name: c.COLUMN_NAME,
          type: kind,
          nullable: c.IS_NULLABLE === 'YES' && !isPrimary,
          default: autoIncrement ? undefined : parseMysqlDefault(c.COLUMN_DEFAULT, c.EXTRA, kind),
          limit: kind === 'string' ? (c.CHARACTER_MAXIMUM_LENGTH ?? undefined) : undefined,
          primary: isPrimary,
          unique: singleUniqueColumns.has(c.COLUMN_NAME) && !isPrimary,
          precision:
            kind === 'decimal' && c.NUMERIC_PRECISION !== null ? c.NUMERIC_PRECISION : undefined,
          scale: kind === 'decimal' && c.NUMERIC_SCALE !== null ? c.NUMERIC_SCALE : undefined,
          autoIncrement,
        };
      });

      const primaryKey = columns.find((c) => c.primary)?.name;
      result.push({ name: tableName, columns, indexes, primaryKey });
    }
    return result;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    validateIdentifier(tableName);
    const def = defineTable(tableName, blueprint);
    const columnSql = def.columns.map(columnToSql).join(', ');
    await this.dataApi.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnSql})`);
    for (const idx of def.indexes) {
      await this.dataApi.query(indexToSql(tableName, idx));
    }
  }

  async dropTable(tableName: string): Promise<void> {
    validateIdentifier(tableName);
    await this.dataApi.query(`DROP TABLE IF EXISTS ${tableName}`);
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    validateIdentifier(spec.tableName);
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    switch (op.op) {
      case 'addColumn':
        validateIdentifier(op.name);
        await this.dataApi.query(
          `ALTER TABLE ${tableName} ADD COLUMN ${columnToSql(definitionFromOp(op.name, op.type, op.options))}`,
        );
        return;
      case 'removeColumn':
        validateIdentifier(op.name);
        await this.dataApi.query(`ALTER TABLE ${tableName} DROP COLUMN ${op.name}`);
        return;
      case 'renameColumn':
        validateIdentifier(op.from);
        validateIdentifier(op.to);
        await this.dataApi.query(`ALTER TABLE ${tableName} RENAME COLUMN ${op.from} TO ${op.to}`);
        return;
      case 'changeColumn':
        validateIdentifier(op.name);
        await this.dataApi.query(
          `ALTER TABLE ${tableName} ALTER COLUMN ${op.name} TYPE ${columnSqlType(definitionFromOp(op.name, op.type, op.options))}`,
        );
        return;
      case 'addIndex':
        await this.dataApi.query(
          indexToSql(tableName, {
            columns: op.columns,
            unique: op.unique ?? false,
            name: op.name,
          }),
        );
        return;
      case 'removeIndex': {
        const target = Array.isArray(op.nameOrColumns)
          ? `idx_${tableName}_${op.nameOrColumns.join('_')}`
          : op.nameOrColumns;
        validateIdentifier(target);
        await this.dataApi.query(`DROP INDEX IF EXISTS ${target}`);
        return;
      }
      case 'renameIndex':
        validateIdentifier(op.from);
        validateIdentifier(op.to);
        await this.dataApi.query(`ALTER INDEX ${op.from} RENAME TO ${op.to}`);
        return;
      case 'addForeignKey': {
        const local = op.column ?? `${op.toTable}Id`;
        const constraint = op.name ?? foreignKeyName(tableName, op.toTable);
        const ref = op.primaryKey ?? 'id';
        validateIdentifier(local);
        validateIdentifier(constraint);
        validateIdentifier(op.toTable);
        validateIdentifier(ref);
        let sql = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraint} FOREIGN KEY (${local}) REFERENCES ${op.toTable} (${ref})`;
        if (op.onDelete) sql += ` ON DELETE ${dataApiAction(op.onDelete)}`;
        if (op.onUpdate) sql += ` ON UPDATE ${dataApiAction(op.onUpdate)}`;
        await this.dataApi.query(sql);
        return;
      }
      case 'removeForeignKey': {
        const constraint = op.nameOrTable.startsWith('fk_')
          ? op.nameOrTable
          : foreignKeyName(tableName, op.nameOrTable);
        validateIdentifier(constraint);
        await this.dataApi.query(`ALTER TABLE ${tableName} DROP CONSTRAINT ${constraint}`);
        return;
      }
      case 'addCheckConstraint': {
        const name = op.name ?? `chk_${tableName}_${Date.now()}`;
        validateIdentifier(name);
        await this.dataApi.query(
          `ALTER TABLE ${tableName} ADD CONSTRAINT ${name} CHECK (${op.expression})`,
        );
        return;
      }
      case 'removeCheckConstraint':
        validateIdentifier(op.name);
        await this.dataApi.query(`ALTER TABLE ${tableName} DROP CONSTRAINT ${op.name}`);
        return;
    }
  }
}

function validateIdentifier(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new PersistenceError(`invalid SQL identifier: ${name}`);
  }
}

function columnSqlType(col: ColumnDefinition): string {
  switch (col.type) {
    case 'string':
      return `VARCHAR(${col.limit ?? 255})`;
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'float':
      return 'DOUBLE PRECISION';
    case 'decimal':
      if (col.precision !== undefined && col.scale !== undefined) {
        return `DECIMAL(${col.precision}, ${col.scale})`;
      }
      return 'DECIMAL';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return 'TIMESTAMP';
    case 'json':
      return 'JSON';
  }
}

function defaultSql(value: ColumnDefinition['default']): string {
  if (value === 'currentTimestamp') return 'CURRENT_TIMESTAMP';
  if (value === null) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  throw new PersistenceError(`unsupported default value: ${String(value)}`);
}

function columnToSql(col: ColumnDefinition): string {
  validateIdentifier(col.name);
  const parts = [col.name, columnSqlType(col)];
  if (col.primary) parts.push('PRIMARY KEY');
  if (col.unique && !col.primary) parts.push('UNIQUE');
  if (!col.nullable && !col.primary) parts.push('NOT NULL');
  if (col.default !== undefined) parts.push(`DEFAULT ${defaultSql(col.default)}`);
  return parts.join(' ');
}

function indexToSql(tableName: string, idx: IndexDefinition): string {
  for (const column of idx.columns) validateIdentifier(column);
  const indexName = idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`;
  validateIdentifier(indexName);
  const unique = idx.unique ? 'UNIQUE ' : '';
  return `CREATE ${unique}INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${idx.columns.join(', ')})`;
}

function definitionFromOp(
  name: string,
  type: ColumnKind,
  options: ColumnOptions = {},
): ColumnDefinition {
  return {
    name,
    type,
    nullable: options.null ?? true,
    default: options.default,
    limit: options.limit,
    primary: options.primary ?? false,
    unique: options.unique ?? false,
    precision: options.precision,
    scale: options.scale,
    autoIncrement: options.autoIncrement ?? false,
  };
}

function dataApiAction(action: ForeignKeyAction): string {
  switch (action) {
    case 'cascade':
      return 'CASCADE';
    case 'restrict':
      return 'RESTRICT';
    case 'setNull':
      return 'SET NULL';
    case 'setDefault':
      return 'SET DEFAULT';
    case 'noAction':
      return 'NO ACTION';
  }
}

/** Postgres type → ColumnKind mapping; mirrors `PostgresConnector`'s helper. */
function pgTypeToColumnKind(dataType: string, udtName: string): ColumnKind {
  const t = (dataType ?? '').toLowerCase();
  const u = (udtName ?? '').toLowerCase();
  switch (t) {
    case 'character varying':
    case 'varchar':
    case 'character':
    case 'char':
      return 'string';
    case 'text':
      return 'text';
    case 'integer':
    case 'smallint':
      return 'integer';
    case 'bigint':
      return 'bigint';
    case 'boolean':
      return 'boolean';
    case 'real':
    case 'double precision':
      return 'float';
    case 'numeric':
    case 'decimal':
      return 'decimal';
    case 'date':
      return 'date';
    case 'time':
    case 'time without time zone':
    case 'time with time zone':
      return 'datetime';
    case 'timestamp':
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return 'timestamp';
    case 'json':
    case 'jsonb':
      return 'json';
    default:
      switch (u) {
        case 'int2':
        case 'int4':
          return 'integer';
        case 'int8':
          return 'bigint';
        case 'float4':
        case 'float8':
          return 'float';
        case 'numeric':
          return 'decimal';
        case 'bool':
          return 'boolean';
        case 'json':
        case 'jsonb':
          return 'json';
        case 'varchar':
        case 'bpchar':
          return 'string';
        case 'text':
          return 'text';
        case 'date':
          return 'date';
        case 'timestamp':
        case 'timestamptz':
          return 'timestamp';
        case 'time':
        case 'timetz':
          return 'datetime';
      }
      return 'text';
  }
}

function parsePgDefault(raw: string | null, kind: ColumnKind): ColumnDefault | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return undefined;
  const stripped = trimmed.replace(/::[A-Za-z0-9_ "]+(\([^)]*\))?$/g, '').trim();
  const upper = stripped.toUpperCase();
  if (upper === 'CURRENT_TIMESTAMP' || upper === 'NOW()') return 'currentTimestamp';
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  if (stripped.startsWith("'") && stripped.endsWith("'") && stripped.length >= 2) {
    return stripped.slice(1, -1).replace(/''/g, "'");
  }
  if (kind === 'boolean') {
    if (stripped === '1') return true;
    if (stripped === '0') return false;
  }
  if (kind === 'integer' || kind === 'bigint' || kind === 'float' || kind === 'decimal') {
    const num = Number(stripped);
    if (Number.isFinite(num)) return num;
  }
  return stripped;
}

/** MySQL type → ColumnKind mapping; mirrors `MysqlConnector`'s helper. */
function mysqlTypeToColumnKind(dataType: string, columnType: string): ColumnKind {
  const t = (dataType ?? '').toLowerCase();
  const ct = (columnType ?? '').toLowerCase();
  switch (t) {
    case 'tinyint':
      return /^tinyint\(1\)/i.test(ct) ? 'boolean' : 'integer';
    case 'smallint':
    case 'mediumint':
    case 'int':
    case 'integer':
      return 'integer';
    case 'bigint':
      return 'bigint';
    case 'float':
    case 'double':
    case 'real':
      return 'float';
    case 'decimal':
    case 'numeric':
      return 'decimal';
    case 'char':
    case 'varchar':
      return 'string';
    case 'tinytext':
    case 'text':
    case 'mediumtext':
    case 'longtext':
      return 'text';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'timestamp':
      return 'timestamp';
    case 'time':
    case 'year':
      return 'datetime';
    case 'json':
      return 'json';
    default:
      return 'text';
  }
}

function parseMysqlDefault(
  raw: string | null,
  extra: string,
  kind: ColumnKind,
): ColumnDefault | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '' && /default_generated/i.test(extra)) return undefined;
  const upper = trimmed.toUpperCase();
  if (upper === 'CURRENT_TIMESTAMP' || upper === 'NOW()') return 'currentTimestamp';
  if (upper === 'NULL') return null;
  let s = trimmed;
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    s = s.slice(1, -1).replace(/''/g, "'");
  }
  if (kind === 'boolean') {
    if (s === '1') return true;
    if (s === '0') return false;
  }
  if (kind === 'integer' || kind === 'bigint' || kind === 'float' || kind === 'decimal') {
    const num = Number(s);
    if (Number.isFinite(num)) return num;
  }
  return s;
}

export default DataApiConnector;
