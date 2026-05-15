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
  type DatabaseSchema,
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
  type ParentScope,
  PersistenceError,
  type Projection,
  type QueryScopedSpec,
  type Scope,
  SortDirection,
  type TableBuilder,
  type TableDefinition,
  type UpsertSpec,
} from '@next-model/core';
import { Pool, type PoolClient, type PoolConfig, type QueryResult } from 'pg';

export type PostgresConfig = PoolConfig | { connectionString: string } | string;

interface SqlFragment {
  sql: string;
  params: BaseType[];
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new PersistenceError(`Refusing to quote unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

function requireSingleKey(filter: Dict<any>, operator: string): string {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${operator} expects exactly one key, received ${keys.length}`);
  }
  return keys[0];
}

function requireNonEmpty(filter: Dict<any>, operator: string): void {
  if (Object.keys(filter).length === 0) {
    throw new FilterError(`${operator} expects at least one key`);
  }
}

export class PostgresConnector<S extends DatabaseSchema<any> | undefined = undefined>
  implements Connector<S>
{
  readonly schema?: S;
  pool: Pool;
  private activeClient: PoolClient | undefined;

  constructor(config: PostgresConfig, extras?: { schema?: S }) {
    if (typeof config === 'string') {
      this.pool = new Pool({ connectionString: config });
    } else if ('connectionString' in (config as object)) {
      this.pool = new Pool({
        connectionString: (config as { connectionString: string }).connectionString,
      });
    } else {
      this.pool = new Pool(config as PoolConfig);
    }
    this.schema = extras?.schema;
  }

  async destroy(): Promise<void> {
    await this.pool.end();
  }

  private async run(sql: string, params: BaseType[] = []): Promise<QueryResult> {
    if (this.activeClient) return this.activeClient.query(sql, params as any);
    return this.pool.query(sql, params as any);
  }

  private buildWhere(filter: Filter<any> | undefined): SqlFragment {
    const params: BaseType[] = [];
    const sql = filter === undefined ? '' : this.compileFilter(filter, params);
    return { sql, params };
  }

  private placeholder(params: BaseType[]): string {
    return `$${params.length}`;
  }

  private compileFilter(filter: Filter<any>, params: BaseType[]): string {
    const f = filter as FilterSpecial<Dict<any>> & Partial<Dict<any>>;
    if (f.$and !== undefined) return this.compileGroup(f.$and as Filter<any>[], 'AND', params);
    if (f.$or !== undefined) return this.compileGroup(f.$or as Filter<any>[], 'OR', params);
    if (f.$not !== undefined) return `NOT (${this.compileFilter(f.$not as Filter<any>, params)})`;
    if (f.$in !== undefined)
      return this.compileIn(f.$in as Partial<FilterIn<Dict<any>>>, params, false);
    if (f.$notIn !== undefined)
      return this.compileIn(f.$notIn as Partial<FilterIn<Dict<any>>>, params, true);
    if (f.$null !== undefined) return `${quoteIdent(f.$null as string)} IS NULL`;
    if (f.$notNull !== undefined) return `${quoteIdent(f.$notNull as string)} IS NOT NULL`;
    if (f.$between !== undefined)
      return this.compileBetween(f.$between as Partial<FilterBetween<Dict<any>>>, params, false);
    if (f.$notBetween !== undefined)
      return this.compileBetween(f.$notBetween as Partial<FilterBetween<Dict<any>>>, params, true);
    if (f.$gt !== undefined) return this.compileCompare(f.$gt as Dict<BaseType>, '>', params);
    if (f.$gte !== undefined) return this.compileCompare(f.$gte as Dict<BaseType>, '>=', params);
    if (f.$lt !== undefined) return this.compileCompare(f.$lt as Dict<BaseType>, '<', params);
    if (f.$lte !== undefined) return this.compileCompare(f.$lte as Dict<BaseType>, '<=', params);
    if (f.$like !== undefined) return this.compileLike(f.$like as Dict<string>, params);
    if (f.$raw !== undefined) return this.compileRaw(f.$raw as FilterRaw, params);
    if (f.$async !== undefined) {
      throw new FilterError('$async filters must be resolved before reaching the connector');
    }
    return this.compileEquality(filter as Partial<Dict<any>>, params);
  }

  private compileGroup(filters: Filter<any>[], joiner: string, params: BaseType[]): string {
    if (filters.length === 0) return '1=1';
    const parts = filters.map((f) => `(${this.compileFilter(f, params)})`);
    return parts.join(` ${joiner} `);
  }

  private compileEquality(filter: Partial<Dict<any>>, params: BaseType[]): string {
    const keys = Object.keys(filter);
    if (keys.length === 0) return '1=1';
    return keys
      .map((k) => {
        const value = filter[k];
        if (value === null) return `${quoteIdent(k)} IS NULL`;
        params.push(value as BaseType);
        return `${quoteIdent(k)} = ${this.placeholder(params)}`;
      })
      .join(' AND ');
  }

  private compileIn(
    filter: Partial<FilterIn<Dict<any>>>,
    params: BaseType[],
    negate: boolean,
  ): string {
    requireNonEmpty(filter, negate ? '$notIn' : '$in');
    const key = requireSingleKey(filter, negate ? '$notIn' : '$in');
    const list = (filter as Dict<any>)[key] as BaseType[];
    if (!Array.isArray(list) || list.length === 0) {
      throw new FilterError(`${negate ? '$notIn' : '$in'}.${key} requires a non-empty array`);
    }
    const placeholders = list.map((v) => {
      params.push(v);
      return this.placeholder(params);
    });
    return `${quoteIdent(key)} ${negate ? 'NOT IN' : 'IN'} (${placeholders.join(', ')})`;
  }

  private compileBetween(
    filter: Partial<FilterBetween<Dict<any>>>,
    params: BaseType[],
    negate: boolean,
  ): string {
    requireNonEmpty(filter, negate ? '$notBetween' : '$between');
    const key = requireSingleKey(filter, negate ? '$notBetween' : '$between');
    const range = (filter as Dict<any>)[key] as { from: BaseType; to: BaseType };
    params.push(range.from);
    const fromPh = this.placeholder(params);
    params.push(range.to);
    const toPh = this.placeholder(params);
    return `${quoteIdent(key)} ${negate ? 'NOT BETWEEN' : 'BETWEEN'} ${fromPh} AND ${toPh}`;
  }

  private compileCompare(filter: Dict<BaseType>, op: string, params: BaseType[]): string {
    const key = requireSingleKey(filter, op);
    params.push(filter[key]);
    return `${quoteIdent(key)} ${op} ${this.placeholder(params)}`;
  }

  private compileLike(filter: Dict<string>, params: BaseType[]): string {
    const key = requireSingleKey(filter, '$like');
    params.push(filter[key]);
    return `${quoteIdent(key)} LIKE ${this.placeholder(params)}`;
  }

  private compileRaw(raw: FilterRaw, params: BaseType[]): string {
    if (!raw.$query) throw new FilterError('$raw requires a $query string');
    if (typeof raw.$query !== 'string') {
      throw new FilterError(
        'PostgresConnector requires `$raw.$query` to be a SQL string; ' +
          'predicate functions are only supported by JS-evaluating connectors.',
      );
    }
    let sql = raw.$query;
    const bindings = (raw.$bindings ?? []) as BaseType[];
    for (const b of bindings) {
      params.push(b);
      sql = sql.replace('?', this.placeholder(params));
    }
    return `(${sql})`;
  }

  private buildOrder(order: Scope['order']): string {
    if (!order || order.length === 0) return '';
    const parts = order.map((col) => {
      const dir = (col.dir ?? SortDirection.Asc) === SortDirection.Asc ? 'ASC' : 'DESC';
      return `${quoteIdent(col.key as string)} ${dir}`;
    });
    return ` ORDER BY ${parts.join(', ')}`;
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    let sql = `SELECT * FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += this.buildOrder(scope.order);
    if (scope.limit !== undefined) sql += ` LIMIT ${Number(scope.limit)}`;
    if (scope.skip !== undefined) sql += ` OFFSET ${Number(scope.skip)}`;
    const result = await this.run(sql, where.params);
    return result.rows;
  }

  /**
   * Emits ONE SQL statement using nested `WHERE col IN (SELECT … FROM …)`
   * subqueries — one per `parentScope`. The leaf SELECT runs against the
   * target table; each parent scope projects its `link.parentColumn` and
   * gates the next level (or the leaf) via that scope's `link.childColumn`.
   * Builders resolve `pendingJoins` to `$in` / `$notIn` filters before calling
   * this method, so the connector only sees a flat scope.
   */
  async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
    if (spec.pendingJoins.length > 0) {
      throw new PersistenceError(
        `PostgresConnector.queryScoped expects pendingJoins to be resolved upstream; received ${spec.pendingJoins.length} unresolved join(s). Use the CollectionQuery / ScalarQuery / ColumnQuery builders to materialise scopes with joins.`,
      );
    }

    const params: BaseType[] = [];
    const whereClauses: string[] = [];

    for (const parent of spec.parentScopes) {
      whereClauses.push(this.compileParentScope(parent, params));
    }
    if (spec.filter !== undefined) {
      whereClauses.push(this.compileFilter(spec.filter, params));
    }

    const projection: Projection = spec.projection;
    const selectClause = this.projectionSelect(projection, spec.target.keys);

    let sql = `SELECT ${selectClause} FROM ${quoteIdent(spec.target.tableName)}`;
    if (whereClauses.length > 0) sql += ` WHERE ${whereClauses.map((c) => `(${c})`).join(' AND ')}`;
    sql += this.buildOrder(spec.order);
    if (spec.limit !== undefined) sql += ` LIMIT ${Number(spec.limit)}`;
    if (spec.skip !== undefined) sql += ` OFFSET ${Number(spec.skip)}`;

    const result = await this.run(sql, params);
    return this.materializeProjection(result.rows, projection, spec.target.keys);
  }

  /** `link.childColumn IN (SELECT link.parentColumn FROM parentTable WHERE … ORDER BY … LIMIT N)` */
  private compileParentScope(parent: ParentScope, params: BaseType[]): string {
    const { link, parentTable, parentFilter, parentOrder, parentLimit } = parent;
    let inner = `SELECT ${quoteIdent(link.parentColumn)} FROM ${quoteIdent(parentTable)}`;
    if (parentFilter !== undefined) {
      inner += ` WHERE ${this.compileFilter(parentFilter, params)}`;
    }
    inner += this.buildOrder(parentOrder);
    if (parentLimit !== undefined) inner += ` LIMIT ${Number(parentLimit)}`;
    return `${quoteIdent(link.childColumn)} IN (${inner})`;
  }

  private projectionSelect(projection: Projection, keys: Dict<KeyType>): string {
    if (projection === 'rows') return '*';
    if (projection.kind === 'pk') {
      const pkName = Object.keys(keys)[0] ?? 'id';
      return quoteIdent(pkName);
    }
    if (projection.kind === 'column') return quoteIdent(projection.column);
    if (projection.kind === 'aggregate') {
      if (projection.op === 'count') return 'COUNT(*) AS result';
      if (!projection.column) {
        throw new PersistenceError(
          `Aggregate '${projection.op}' requires a column; received undefined.`,
        );
      }
      return `${projection.op.toUpperCase()}(${quoteIdent(projection.column)}) AS result`;
    }
    throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
  }

  private materializeProjection(
    rows: Dict<any>[],
    projection: Projection,
    keys: Dict<KeyType>,
  ): unknown {
    if (projection === 'rows') return rows;
    if (projection.kind === 'pk') {
      const pkName = Object.keys(keys)[0] ?? 'id';
      return rows.map((r) => (r as Dict<any>)[pkName]);
    }
    if (projection.kind === 'column') {
      const col = projection.column;
      return rows.map((r) => (r as Dict<any>)[col]);
    }
    if (projection.kind === 'aggregate') {
      if (projection.op === 'count') {
        const v = rows[0]?.result;
        return v == null ? 0 : Number(v);
      }
      const v = rows[0]?.result;
      return v == null ? undefined : Number(v);
    }
    throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
  }

  async queryWithJoins(spec: JoinQuerySpec): Promise<Dict<any>[]> {
    const { parent, joins } = spec;
    const params: BaseType[] = [];
    const whereClauses: string[] = [];
    if (parent.filter !== undefined) {
      whereClauses.push(this.compileFilter(parent.filter, params));
    }
    for (const join of joins) {
      const clause = this.compileExistsClause(parent.tableName, join, params);
      if (clause) whereClauses.push(clause);
    }
    let sql = `SELECT * FROM ${quoteIdent(parent.tableName)}`;
    if (whereClauses.length > 0) sql += ` WHERE ${whereClauses.join(' AND ')}`;
    sql += this.buildOrder(parent.order);
    if (parent.limit !== undefined) sql += ` LIMIT ${Number(parent.limit)}`;
    if (parent.skip !== undefined) sql += ` OFFSET ${Number(parent.skip)}`;
    const result = await this.run(sql, params);
    return this.attachIncludes(result.rows, joins);
  }

  /** See SqliteConnector.compileExistsClause — same shape, $N placeholders. */
  private compileExistsClause(
    parentTable: string,
    join: JoinClause,
    params: BaseType[],
  ): string | undefined {
    if (join.mode !== 'select' && join.mode !== 'antiJoin') return undefined;
    const op = join.mode === 'antiJoin' ? 'NOT EXISTS' : 'EXISTS';
    const childTable = quoteIdent(join.childTableName);
    const parentTableQ = quoteIdent(parentTable);
    const childCol = quoteIdent(join.on.childColumn);
    const parentCol = quoteIdent(join.on.parentColumn);
    let inner = `SELECT 1 FROM ${childTable} WHERE ${childTable}.${childCol} = ${parentTableQ}.${parentCol}`;
    if (join.filter !== undefined) {
      inner += ` AND (${this.compileFilter(join.filter, params)})`;
    }
    return `${op} (${inner})`;
  }

  /** Batched IN per `mode: 'includes'` join; groups by parent key in JS. */
  private async attachIncludes(parentRows: Dict<any>[], joins: JoinClause[]): Promise<Dict<any>[]> {
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
    const where = this.buildWhere(scope.filter);
    let sql = `SELECT COUNT(*) AS count FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    const result = await this.run(sql, where.params);
    return Number(result.rows[0]?.count ?? 0);
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    const cols = keys.length === 0 ? '*' : keys.map(quoteIdent).join(', ');
    let sql = `SELECT ${cols} FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += this.buildOrder(scope.order);
    if (scope.limit !== undefined) sql += ` LIMIT ${Number(scope.limit)}`;
    if (scope.skip !== undefined) sql += ` OFFSET ${Number(scope.skip)}`;
    const result = await this.run(sql, where.params);
    return result.rows;
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const attrKeys = Object.keys(attrs);
    if (attrKeys.length === 0) return this.query(scope);
    const params: BaseType[] = [];
    const setFragments = attrKeys.map((k) => {
      params.push(attrs[k] as BaseType);
      return `${quoteIdent(k)} = $${params.length}`;
    });
    const where = this.buildWhere(scope.filter);
    for (const p of where.params) params.push(p);
    const offset = params.length - where.params.length;
    let whereSql = where.sql;
    if (whereSql) {
      whereSql = whereSql.replace(/\$(\d+)/g, (_, idx) => `$${Number(idx) + offset}`);
    }
    let sql = `UPDATE ${quoteIdent(scope.tableName)} SET ${setFragments.join(', ')}`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    sql += ' RETURNING *';
    const result = await this.run(sql, params);
    return result.rows;
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    if (spec.deltas.length === 0 && (!spec.set || Object.keys(spec.set).length === 0)) return 0;
    const params: BaseType[] = [];
    const setFragments: string[] = [];
    for (const { column, by } of spec.deltas) {
      params.push(by as BaseType);
      setFragments.push(
        `${quoteIdent(column)} = COALESCE(${quoteIdent(column)}, 0) + $${params.length}`,
      );
    }
    if (spec.set) {
      for (const k of Object.keys(spec.set)) {
        params.push(spec.set[k] as BaseType);
        setFragments.push(`${quoteIdent(k)} = $${params.length}`);
      }
    }
    const where = this.buildWhere(spec.filter);
    const offset = params.length;
    let whereSql = where.sql;
    if (whereSql) {
      whereSql = whereSql.replace(/\$(\d+)/g, (_, idx) => `$${Number(idx) + offset}`);
    }
    for (const p of where.params) params.push(p);
    let sql = `UPDATE ${quoteIdent(spec.tableName)} SET ${setFragments.join(', ')}`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    const result = await this.run(sql, params);
    return result.rowCount ?? 0;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    let sql = `DELETE FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += ' RETURNING *';
    const result = await this.run(sql, where.params);
    return result.rows;
  }

  async batchInsert(
    tableName: string,
    _keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const allKeys = new Set<string>();
    for (const item of items) {
      for (const k of Object.keys(item)) allKeys.add(k);
    }
    const cols = Array.from(allKeys);
    if (cols.length === 0) {
      const sql = `INSERT INTO ${quoteIdent(tableName)} DEFAULT VALUES RETURNING *`;
      const result = await this.run(sql);
      return result.rows;
    }
    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const item of items) {
      const placeholders = cols.map((c) => {
        params.push(item[c] as BaseType);
        return `$${params.length}`;
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const sql = `INSERT INTO ${quoteIdent(tableName)} (${cols.map(quoteIdent).join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`;
    const result = await this.run(sql, params);
    return result.rows;
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const allKeys = new Set<string>();
    for (const row of spec.rows) for (const k of Object.keys(row)) allKeys.add(k);
    const cols = Array.from(allKeys);
    const updateColumns =
      spec.updateColumns ?? cols.filter((c: string) => !spec.conflictTarget.includes(c));
    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const row of spec.rows) {
      const placeholders = cols.map((c) => {
        params.push(row[c] as BaseType);
        return `$${params.length}`;
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const conflictCols = spec.conflictTarget.map(quoteIdent).join(', ');
    const conflictClause = ignore
      ? `ON CONFLICT (${conflictCols}) DO NOTHING`
      : `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateColumns
          .map((c: string) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
          .join(', ')}`;
    const sql = `INSERT INTO ${quoteIdent(spec.tableName)} (${cols
      .map(quoteIdent)
      .join(', ')}) VALUES ${valueRows.join(', ')} ${conflictClause} RETURNING *`;
    const inserted = (await this.run(sql, params)).rows as Dict<any>[];

    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c: string) => JSON.stringify(row[c])).join('|');
    const byTuple = new Map<string, Dict<any>>();
    for (const row of inserted) byTuple.set(tupleKey(row), row);

    const missing: Dict<any>[] = [];
    for (const row of spec.rows) {
      if (!byTuple.has(tupleKey(row))) missing.push(row);
    }
    if (missing.length > 0) {
      const fetched = await this.fetchByConflict(spec.tableName, spec.conflictTarget, missing);
      for (const row of fetched) byTuple.set(tupleKey(row), row);
    }

    return spec.rows
      .map((row: Dict<any>) => byTuple.get(tupleKey(row)))
      .filter((row: Dict<any> | undefined): row is Dict<any> => row !== undefined);
  }

  private async fetchByConflict(
    tableName: string,
    conflictTarget: string[],
    rows: Dict<any>[],
  ): Promise<Dict<any>[]> {
    const params: BaseType[] = [];
    let where: string;
    if (conflictTarget.length === 1) {
      const [col] = conflictTarget;
      const placeholders = rows.map((r) => {
        params.push(r[col] as BaseType);
        return `$${params.length}`;
      });
      where = `${quoteIdent(col)} IN (${placeholders.join(', ')})`;
    } else {
      where = rows
        .map((r) => {
          const parts = conflictTarget.map((c) => {
            params.push(r[c] as BaseType);
            return `${quoteIdent(c)} = $${params.length}`;
          });
          return `(${parts.join(' AND ')})`;
        })
        .join(' OR ');
    }
    const sql = `SELECT * FROM ${quoteIdent(tableName)} WHERE ${where}`;
    return (await this.run(sql, params)).rows as Dict<any>[];
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const params = Array.isArray(bindings) ? bindings : [bindings];
    const result = await this.run(query, params);
    return result.rows;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeClient) return fn();
    const client = await this.pool.connect();
    this.activeClient = client;
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      this.activeClient = undefined;
      client.release();
    }
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const where = this.buildWhere(scope.filter);
    const fn = kind.toUpperCase();
    let sql = `SELECT ${fn}(${quoteIdent(key)}) AS result FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    const result = await this.run(sql, where.params);
    const value = result.rows[0]?.result;
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const result = await this.run('SELECT to_regclass($1) AS reg', [tableName]);
    return result.rows[0]?.reg !== null;
  }

  /**
   * Reflect the live schema by querying `information_schema.tables` /
   * `information_schema.columns` / `information_schema.table_constraints`
   * (for primary keys) and `pg_indexes` (for explicit indexes). Returns
   * one `TableDefinition` per user table in the connection's
   * `current_schema()`. Postgres types map back to the connector's
   * `ColumnKind` set, default values are decoded from their serialised
   * Postgres form (`'currentTimestamp'` for `now()` / `CURRENT_TIMESTAMP`,
   * quoted literals for strings, bare for numbers), and `nextval(...)`
   * defaults flag the column as `autoIncrement: true` so reflection
   * round-trips back into `createTable` cleanly.
   */
  async reflectSchema(): Promise<TableDefinition[]> {
    const tablesRes = await this.run(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const result: TableDefinition[] = [];
    for (const row of tablesRes.rows as Array<{ table_name: string }>) {
      const tableName = row.table_name;
      const colsRes = await this.run(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default,
                character_maximum_length, numeric_precision, numeric_scale,
                ordinal_position
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName],
      );
      const pkRes = await this.run(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = $1
           AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`,
        [tableName],
      );
      const pkColumns = new Set(
        (pkRes.rows as Array<{ column_name: string }>).map((r) => r.column_name),
      );
      // Single-column UNIQUE constraints surface on the column directly.
      const uniqueRes = await this.run(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = current_schema()
           AND tc.table_name = $1
           AND tc.constraint_type = 'UNIQUE'
         GROUP BY kcu.constraint_name, kcu.column_name
         HAVING COUNT(*) = 1`,
        [tableName],
      );
      const uniqueColumns = new Set(
        (uniqueRes.rows as Array<{ column_name: string }>).map((r) => r.column_name),
      );

      // Explicit indexes (skipping the auto-created primary key / unique
      // constraint indexes).
      const idxRes = await this.run(
        `SELECT i.relname AS index_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                a.attname AS column_name,
                a.attnum,
                array_position(ix.indkey, a.attnum) AS ord,
                COALESCE(con.contype, '') AS contype
         FROM pg_class t
         JOIN pg_index ix ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
         LEFT JOIN pg_constraint con ON con.conindid = i.oid
         WHERE n.nspname = current_schema() AND t.relname = $1
         ORDER BY i.relname, ord`,
        [tableName],
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
      for (const ir of idxRes.rows as Array<{
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
        // Skip the auto-generated index that backs a PRIMARY KEY constraint —
        // it round-trips via the column's `primary` flag.
        if (entry.primary || entry.contype === 'p') continue;
        // Single-column UNIQUE constraints round-trip via the column's
        // `unique` flag; skip their backing indexes so reflection doesn't
        // emit redundant index definitions. Multi-column unique constraints
        // (named via `t.unique([...], name)`) carry richer data than a single
        // column flag can express, so we keep them as IndexDefinitions.
        if (entry.contype === 'u' && entry.columns.length === 1) continue;
        entry.columns.sort((a, b) => a.ord - b.ord);
        indexes.push({
          columns: entry.columns.map((c) => c.column),
          unique: entry.unique,
          name,
        });
      }

      const columns: ColumnDefinition[] = (
        colsRes.rows as Array<{
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
      result.push({
        name: tableName,
        columns,
        indexes,
        primaryKey,
      });
    }
    return result;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const def = defineTable(tableName, blueprint);
    if (await this.hasTable(tableName)) return;
    const colSql: string[] = [];
    for (const col of def.columns) {
      colSql.push(this.columnDdl(col));
    }
    const sql = `CREATE TABLE ${quoteIdent(tableName)} (${colSql.join(', ')})`;
    await this.run(sql);
    for (const idx of def.indexes) {
      await this.createIndex(tableName, idx);
    }
  }

  async dropTable(tableName: string): Promise<void> {
    await this.run(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    const t = quoteIdent(tableName);
    switch (op.op) {
      case 'addColumn':
        await this.run(
          `ALTER TABLE ${t} ADD COLUMN ${this.columnDdl(definitionFromOp(op.name, op.type, op.options))}`,
        );
        return;
      case 'removeColumn':
        await this.run(`ALTER TABLE ${t} DROP COLUMN ${quoteIdent(op.name)}`);
        return;
      case 'renameColumn':
        await this.run(
          `ALTER TABLE ${t} RENAME COLUMN ${quoteIdent(op.from)} TO ${quoteIdent(op.to)}`,
        );
        return;
      case 'changeColumn':
        await this.applyChangeColumn(tableName, op.name, op.type, op.options);
        return;
      case 'addIndex':
        await this.createIndex(tableName, {
          columns: op.columns,
          unique: op.unique ?? false,
          name: op.name,
        });
        return;
      case 'removeIndex':
        await this.dropIndex(tableName, op.nameOrColumns);
        return;
      case 'renameIndex':
        await this.run(`ALTER INDEX ${quoteIdent(op.from)} RENAME TO ${quoteIdent(op.to)}`);
        return;
      case 'addForeignKey': {
        const local = op.column ?? `${op.toTable}Id`;
        const name = op.name ?? foreignKeyName(tableName, op.toTable);
        const ref = op.primaryKey ?? 'id';
        let sql = `ALTER TABLE ${t} ADD CONSTRAINT ${quoteIdent(name)} FOREIGN KEY (${quoteIdent(local)}) REFERENCES ${quoteIdent(op.toTable)} (${quoteIdent(ref)})`;
        if (op.onDelete) sql += ` ON DELETE ${pgAction(op.onDelete)}`;
        if (op.onUpdate) sql += ` ON UPDATE ${pgAction(op.onUpdate)}`;
        await this.run(sql);
        return;
      }
      case 'removeForeignKey': {
        const constraint = op.nameOrTable.startsWith('fk_')
          ? op.nameOrTable
          : foreignKeyName(tableName, op.nameOrTable);
        await this.run(`ALTER TABLE ${t} DROP CONSTRAINT ${quoteIdent(constraint)}`);
        return;
      }
      case 'addCheckConstraint': {
        const name = op.name ?? `chk_${tableName}_${Date.now()}`;
        await this.run(
          `ALTER TABLE ${t} ADD CONSTRAINT ${quoteIdent(name)} CHECK (${op.expression})`,
        );
        return;
      }
      case 'removeCheckConstraint':
        await this.run(`ALTER TABLE ${t} DROP CONSTRAINT ${quoteIdent(op.name)}`);
        return;
    }
  }

  private async applyChangeColumn(
    tableName: string,
    name: string,
    type: ColumnKind,
    options: ColumnOptions = {},
  ): Promise<void> {
    const t = quoteIdent(tableName);
    const c = quoteIdent(name);
    const def = definitionFromOp(name, type, options);
    await this.run(`ALTER TABLE ${t} ALTER COLUMN ${c} TYPE ${this.columnType(def)}`);
    if (options.null === false) {
      await this.run(`ALTER TABLE ${t} ALTER COLUMN ${c} SET NOT NULL`);
    } else if (options.null === true) {
      await this.run(`ALTER TABLE ${t} ALTER COLUMN ${c} DROP NOT NULL`);
    }
    if (options.default === undefined) {
      await this.run(`ALTER TABLE ${t} ALTER COLUMN ${c} DROP DEFAULT`);
    } else {
      await this.run(
        `ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT ${this.defaultLiteral(options.default)}`,
      );
    }
  }

  private async dropIndex(tableName: string, nameOrColumns: string | string[]): Promise<void> {
    if (Array.isArray(nameOrColumns)) {
      const target = `idx_${tableName}_${nameOrColumns.join('_')}`;
      await this.run(`DROP INDEX IF EXISTS ${quoteIdent(target)}`);
    } else {
      await this.run(`DROP INDEX IF EXISTS ${quoteIdent(nameOrColumns)}`);
    }
  }

  private columnDdl(col: ColumnDefinition): string {
    const parts: string[] = [quoteIdent(col.name)];
    if (col.autoIncrement) {
      parts.push('SERIAL');
    } else {
      parts.push(this.columnType(col));
    }
    if (col.primary) parts.push('PRIMARY KEY');
    if (col.unique && !col.primary) parts.push('UNIQUE');
    if (!col.nullable && !col.autoIncrement) parts.push('NOT NULL');
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${this.defaultLiteral(col.default)}`);
    }
    return parts.join(' ');
  }

  private columnType(col: ColumnDefinition): string {
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
        return 'REAL';
      case 'decimal':
        return col.precision !== undefined
          ? `NUMERIC(${col.precision}${col.scale !== undefined ? `, ${col.scale}` : ''})`
          : 'NUMERIC';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
      case 'timestamp':
        return 'TIMESTAMP';
      case 'json':
        return 'JSONB';
    }
  }

  private defaultLiteral(value: ColumnDefinition['default']): string {
    if (value === 'currentTimestamp') return 'CURRENT_TIMESTAMP';
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private async createIndex(tableName: string, idx: IndexDefinition): Promise<void> {
    const cols = idx.columns.map(quoteIdent).join(', ');
    const name = quoteIdent(idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`);
    const unique = idx.unique ? 'UNIQUE ' : '';
    await this.run(`CREATE ${unique}INDEX ${name} ON ${quoteIdent(tableName)} (${cols})`);
  }
}

function definitionFromOp(
  name: string,
  type: ColumnKind,
  options: ColumnOptions = {},
): ColumnDefinition {
  return {
    name,
    type,
    // Mirror the builder default in `@next-model/core`: NOT NULL unless explicit.
    nullable: options.null ?? false,
    default: options.default,
    limit: options.limit,
    primary: options.primary ?? false,
    unique: options.unique ?? false,
    precision: options.precision,
    scale: options.scale,
    autoIncrement: options.autoIncrement ?? false,
  };
}

function pgAction(action: ForeignKeyAction): string {
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

/**
 * Map a Postgres `information_schema.columns.data_type` (plus its `udt_name`
 * when the data_type is generic, e.g. for `varchar` vs `text`) back to the
 * connector's `ColumnKind`. Inverse of `columnType(...)` above.
 */
function pgTypeToColumnKind(dataType: string, udtName: string): ColumnKind {
  const t = dataType.toLowerCase();
  const u = (udtName ?? '').toLowerCase();
  switch (t) {
    case 'character varying':
    case 'varchar':
      return 'string';
    case 'character':
    case 'char':
      return 'string';
    case 'text':
      return 'text';
    case 'integer':
      return 'integer';
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
    default: {
      // Sometimes data_type is generic (e.g. "USER-DEFINED") and udt_name
      // is the actual type. Try the udt_name as a secondary hint.
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
}

/**
 * Postgres `information_schema.columns.column_default` is a serialised SQL
 * fragment — `'api'::character varying`, `5`, `now()`, `nextval('seq')`, …
 * Decode the common cases back into the connector's `ColumnDefault` shape so
 * reflection round-trips through `defineSchema(...)` cleanly.
 */
function parsePgDefault(raw: string | null, kind: ColumnKind): ColumnDefault | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return undefined;
  // Strip the explicit cast suffix: `'api'::character varying` -> `'api'`,
  // `5::integer` -> `5`. Multiple casts are possible; remove all trailing.
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
