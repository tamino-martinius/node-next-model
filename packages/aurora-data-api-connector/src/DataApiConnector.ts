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
  type IndexDefinition,
  type KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
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

export interface DataApiConfig {
  secretArn?: string;
  resourceArn?: string;
  database?: string;
  debug?: boolean;
  client?: DataApiClient;
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
  private activeTransactionId: unknown;

  constructor(options: DataApiConfig) {
    if (options.client) {
      this.dataApi = options.client;
    } else {
      this.dataApi = require('data-api-client')(options);
    }
    this.debug = options.debug ?? false;
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

export default DataApiConnector;
