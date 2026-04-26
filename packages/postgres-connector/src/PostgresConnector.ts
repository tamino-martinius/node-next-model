import {
  type AggregateKind,
  type AtomicUpdateSpec,
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
  type IndexDefinition,
  type KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
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

export class PostgresConnector implements Connector {
  pool: Pool;
  private activeClient: PoolClient | undefined;

  constructor(config: PostgresConfig) {
    if (typeof config === 'string') {
      this.pool = new Pool({ connectionString: config });
    } else if ('connectionString' in (config as object)) {
      this.pool = new Pool({
        connectionString: (config as { connectionString: string }).connectionString,
      });
    } else {
      this.pool = new Pool(config as PoolConfig);
    }
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

  async atomicUpdate(spec: AtomicUpdateSpec): Promise<number> {
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
    const name = idx.name ? quoteIdent(idx.name) : '';
    const unique = idx.unique ? 'UNIQUE ' : '';
    const sql = `CREATE ${unique}INDEX ${name} ON ${quoteIdent(tableName)} (${cols})`.replace(
      'INDEX  ',
      'INDEX ',
    );
    await this.run(sql);
  }
}
