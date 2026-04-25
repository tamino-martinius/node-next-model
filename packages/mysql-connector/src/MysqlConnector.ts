import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
  type ColumnDefinition,
  type ColumnKind,
  type ColumnOptions,
  type Connector,
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
  type KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
} from '@next-model/core';
import {
  createPool,
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

export type MysqlConfig = PoolOptions | string;

interface SqlFragment {
  sql: string;
  params: BaseType[];
}

export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new PersistenceError(`Refusing to quote unsafe identifier: ${name}`);
  }
  return `\`${name}\``;
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

function normaliseValue(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export class MysqlConnector implements Connector {
  pool: Pool;
  private activeConnection: PoolConnection | undefined;

  constructor(config: MysqlConfig) {
    this.pool = createPool(typeof config === 'string' ? { uri: config } : config);
  }

  async destroy(): Promise<void> {
    await this.pool.end();
  }

  protected async run(sql: string, params: BaseType[] = []): Promise<RowDataPacket[]> {
    const bindings = params.map(normaliseValue);
    if (this.activeConnection) {
      const [rows] = await this.activeConnection.query(sql, bindings);
      return rows as RowDataPacket[];
    }
    const [rows] = await this.pool.query(sql, bindings);
    return rows as RowDataPacket[];
  }

  protected async runMutation(sql: string, params: BaseType[] = []): Promise<ResultSetHeader> {
    const bindings = params.map(normaliseValue);
    if (this.activeConnection) {
      const [info] = await this.activeConnection.query(sql, bindings);
      return info as ResultSetHeader;
    }
    const [info] = await this.pool.query(sql, bindings);
    return info as ResultSetHeader;
  }

  protected buildWhere(filter: Filter<any> | undefined): SqlFragment {
    const params: BaseType[] = [];
    const sql = filter === undefined ? '' : this.compileFilter(filter, params);
    return { sql, params };
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
    return filters.map((f) => `(${this.compileFilter(f, params)})`).join(` ${joiner} `);
  }

  private compileEquality(filter: Partial<Dict<any>>, params: BaseType[]): string {
    const keys = Object.keys(filter);
    if (keys.length === 0) return '1=1';
    return keys
      .map((k) => {
        const value = filter[k];
        if (value === null) return `${quoteIdent(k)} IS NULL`;
        params.push(value as BaseType);
        return `${quoteIdent(k)} = ?`;
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
      return '?';
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
    params.push(range.to);
    return `${quoteIdent(key)} ${negate ? 'NOT BETWEEN' : 'BETWEEN'} ? AND ?`;
  }

  private compileCompare(filter: Dict<BaseType>, op: string, params: BaseType[]): string {
    const key = requireSingleKey(filter, op);
    params.push(filter[key]);
    return `${quoteIdent(key)} ${op} ?`;
  }

  private compileLike(filter: Dict<string>, params: BaseType[]): string {
    const key = requireSingleKey(filter, '$like');
    params.push(filter[key]);
    return `${quoteIdent(key)} LIKE ?`;
  }

  private compileRaw(raw: FilterRaw, params: BaseType[]): string {
    if (!raw.$query) throw new FilterError('$raw requires a $query string');
    for (const b of (raw.$bindings ?? []) as BaseType[]) params.push(b);
    return `(${raw.$query})`;
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
    return (await this.run(sql, where.params)) as Dict<any>[];
  }

  async count(scope: Scope): Promise<number> {
    const where = this.buildWhere(scope.filter);
    let sql = `SELECT COUNT(*) AS \`count\` FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    const rows = (await this.run(sql, where.params)) as Dict<any>[];
    return Number(rows[0]?.count ?? 0);
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    const cols = keys.length === 0 ? '*' : keys.map(quoteIdent).join(', ');
    let sql = `SELECT ${cols} FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += this.buildOrder(scope.order);
    if (scope.limit !== undefined) sql += ` LIMIT ${Number(scope.limit)}`;
    if (scope.skip !== undefined) sql += ` OFFSET ${Number(scope.skip)}`;
    return (await this.run(sql, where.params)) as Dict<any>[];
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const attrKeys = Object.keys(attrs);
    if (attrKeys.length === 0) return this.query(scope);
    // MySQL has no UPDATE ... RETURNING; capture matching rows first, then issue the update.
    const matching = await this.query(scope);
    const params: BaseType[] = [];
    const setFragments = attrKeys.map((k) => {
      params.push(attrs[k] as BaseType);
      return `${quoteIdent(k)} = ?`;
    });
    const where = this.buildWhere(scope.filter);
    for (const p of where.params) params.push(p);
    let sql = `UPDATE ${quoteIdent(scope.tableName)} SET ${setFragments.join(', ')}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    await this.runMutation(sql, params);
    for (const row of matching) Object.assign(row, attrs);
    return matching;
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    // MySQL has no DELETE ... RETURNING; capture matching rows first, then issue the delete.
    const matching = await this.query(scope);
    const where = this.buildWhere(scope.filter);
    let sql = `DELETE FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    await this.runMutation(sql, where.params);
    return matching;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const primaryKey = Object.keys(keys)[0] ?? 'id';
    const allKeys = new Set<string>();
    for (const item of items) for (const k of Object.keys(item)) allKeys.add(k);
    const cols = Array.from(allKeys);
    if (cols.length === 0) {
      const info = await this.runMutation(`INSERT INTO ${quoteIdent(tableName)} () VALUES ()`);
      const start = Number(info.insertId);
      const ids = items.map((_, i) => start + i);
      return this.fetchByIds(tableName, primaryKey, ids);
    }
    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const item of items) {
      const placeholders = cols.map((c) => {
        params.push(item[c] as BaseType);
        return '?';
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const sql = `INSERT INTO ${quoteIdent(tableName)} (${cols
      .map(quoteIdent)
      .join(', ')}) VALUES ${valueRows.join(', ')}`;
    const info = await this.runMutation(sql, params);
    if (info.affectedRows === 0) {
      throw new PersistenceError(`batchInsert into ${tableName} returned no rows`);
    }
    // mysql returns the FIRST inserted id; subsequent ids are consecutive under InnoDB's
    // contiguous auto-increment lock (default for a single statement).
    if (cols.includes(primaryKey)) {
      const ids = items.map((item) => Number(item[primaryKey]));
      return this.fetchByIds(tableName, primaryKey, ids);
    }
    const start = Number(info.insertId);
    const ids = items.map((_, i) => start + i);
    return this.fetchByIds(tableName, primaryKey, ids);
  }

  private async fetchByIds(
    tableName: string,
    primaryKey: string,
    ids: number[],
  ): Promise<Dict<any>[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = (await this.run(
      `SELECT * FROM ${quoteIdent(tableName)} WHERE ${quoteIdent(primaryKey)} IN (${placeholders})`,
      ids as BaseType[],
    )) as Dict<any>[];
    const dict: Dict<Dict<any>> = {};
    for (const row of rows) dict[row[primaryKey]] = row;
    return ids.map((id) => dict[id]).filter((r): r is Dict<any> => r !== undefined);
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const params = Array.isArray(bindings) ? bindings : [bindings];
    return (await this.run(query, params)) as Dict<any>[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeConnection) return fn();
    const conn = await this.pool.getConnection();
    this.activeConnection = conn;
    try {
      await conn.beginTransaction();
      const result = await fn();
      await conn.commit();
      return result;
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      throw err;
    } finally {
      this.activeConnection = undefined;
      conn.release();
    }
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const where = this.buildWhere(scope.filter);
    const fn = kind.toUpperCase();
    let sql = `SELECT ${fn}(${quoteIdent(key)}) AS \`result\` FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    const rows = (await this.run(sql, where.params)) as Dict<any>[];
    const value = rows[0]?.result;
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const rows = (await this.run(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [tableName],
    )) as Dict<any>[];
    return rows.length > 0;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const def = defineTable(tableName, blueprint);
    if (await this.hasTable(tableName)) return;
    const colSql: string[] = [];
    for (const col of def.columns) colSql.push(this.columnDdl(col));
    const sql = `CREATE TABLE ${quoteIdent(tableName)} (${colSql.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    await this.runMutation(sql);
    for (const idx of def.indexes) await this.createIndex(tableName, idx);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.runMutation(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
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
        await this.runMutation(
          `ALTER TABLE ${t} ADD COLUMN ${this.columnDdl(definitionFromOp(op.name, op.type, op.options))}`,
        );
        return;
      case 'removeColumn':
        await this.runMutation(`ALTER TABLE ${t} DROP COLUMN ${quoteIdent(op.name)}`);
        return;
      case 'renameColumn':
        await this.runMutation(
          `ALTER TABLE ${t} RENAME COLUMN ${quoteIdent(op.from)} TO ${quoteIdent(op.to)}`,
        );
        return;
      case 'changeColumn':
        await this.runMutation(
          `ALTER TABLE ${t} MODIFY COLUMN ${this.columnDdl(definitionFromOp(op.name, op.type, op.options))}`,
        );
        return;
      case 'addIndex':
        await this.createIndex(tableName, {
          columns: op.columns,
          unique: op.unique ?? false,
          name: op.name,
        });
        return;
      case 'removeIndex': {
        const target = Array.isArray(op.nameOrColumns)
          ? `idx_${tableName}_${op.nameOrColumns.join('_')}`
          : op.nameOrColumns;
        await this.runMutation(`DROP INDEX ${quoteIdent(target)} ON ${t}`);
        return;
      }
      case 'renameIndex':
        await this.runMutation(
          `ALTER TABLE ${t} RENAME INDEX ${quoteIdent(op.from)} TO ${quoteIdent(op.to)}`,
        );
        return;
      case 'addForeignKey': {
        const local = op.column ?? `${op.toTable}Id`;
        const constraint = op.name ?? foreignKeyName(tableName, op.toTable);
        const ref = op.primaryKey ?? 'id';
        let sql = `ALTER TABLE ${t} ADD CONSTRAINT ${quoteIdent(constraint)} FOREIGN KEY (${quoteIdent(local)}) REFERENCES ${quoteIdent(op.toTable)} (${quoteIdent(ref)})`;
        if (op.onDelete) sql += ` ON DELETE ${mysqlAction(op.onDelete)}`;
        if (op.onUpdate) sql += ` ON UPDATE ${mysqlAction(op.onUpdate)}`;
        await this.runMutation(sql);
        return;
      }
      case 'removeForeignKey': {
        const constraint = op.nameOrTable.startsWith('fk_')
          ? op.nameOrTable
          : foreignKeyName(tableName, op.nameOrTable);
        await this.runMutation(`ALTER TABLE ${t} DROP FOREIGN KEY ${quoteIdent(constraint)}`);
        return;
      }
      case 'addCheckConstraint': {
        const name = op.name ?? `chk_${tableName}_${Date.now()}`;
        await this.runMutation(
          `ALTER TABLE ${t} ADD CONSTRAINT ${quoteIdent(name)} CHECK (${op.expression})`,
        );
        return;
      }
      case 'removeCheckConstraint':
        await this.runMutation(`ALTER TABLE ${t} DROP CHECK ${quoteIdent(op.name)}`);
        return;
    }
  }

  private columnDdl(col: ColumnDefinition): string {
    const parts: string[] = [quoteIdent(col.name)];
    if (col.autoIncrement) {
      parts.push('INT NOT NULL AUTO_INCREMENT PRIMARY KEY');
    } else {
      parts.push(this.columnType(col));
      if (!col.nullable) parts.push('NOT NULL');
      if (col.primary) parts.push('PRIMARY KEY');
      if (col.unique && !col.primary) parts.push('UNIQUE');
    }
    if (col.default !== undefined && !col.autoIncrement) {
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
        return 'INT';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return 'FLOAT';
      case 'decimal':
        return col.precision !== undefined
          ? `DECIMAL(${col.precision}${col.scale !== undefined ? `, ${col.scale}` : ''})`
          : 'DECIMAL';
      case 'boolean':
        return 'TINYINT(1)';
      case 'date':
        return 'DATE';
      case 'datetime':
      case 'timestamp':
        return 'DATETIME';
      case 'json':
        return 'JSON';
    }
  }

  private defaultLiteral(value: ColumnDefinition['default']): string {
    if (value === 'currentTimestamp') return 'CURRENT_TIMESTAMP';
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private async createIndex(tableName: string, idx: IndexDefinition): Promise<void> {
    const cols = idx.columns.map(quoteIdent).join(', ');
    const name = quoteIdent(idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`);
    const unique = idx.unique ? 'UNIQUE ' : '';
    await this.runMutation(`CREATE ${unique}INDEX ${name} ON ${quoteIdent(tableName)} (${cols})`);
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

function mysqlAction(action: ForeignKeyAction): string {
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
