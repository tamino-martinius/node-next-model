import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  applyAlterOps,
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
  PersistenceError,
  type Projection,
  type QueryScopedSpec,
  type Scope,
  SortDirection,
  type TableBuilder,
  type TableDefinition,
  UnsupportedOperationError,
  type UpsertSpec,
} from '@next-model/core';
import Database, { type Database as DatabaseType, type Options } from 'better-sqlite3';

export type SqliteConfig = string | { filename?: string; options?: Options };

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

function normaliseValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

interface ForeignKeyEntry {
  column: string;
  toTable: string;
  primaryKey?: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
  name?: string;
}

interface CheckEntry {
  expression: string;
  name?: string;
}

export class SqliteConnector<S extends DatabaseSchema<any> | undefined = undefined>
  implements Connector<S>
{
  readonly schema?: S;
  db: DatabaseType;
  private inTransaction = false;
  private jsonColumns = new Map<string, Set<string>>();
  private tableDefinitions = new Map<string, TableDefinition>();
  private foreignKeys = new Map<string, ForeignKeyEntry[]>();
  private checkConstraints = new Map<string, CheckEntry[]>();

  constructor(config: SqliteConfig = ':memory:', extras?: { schema?: S }) {
    if (typeof config === 'string') {
      this.db = new Database(config);
    } else {
      this.db = new Database(config.filename ?? ':memory:', config.options);
    }
    this.db.pragma('foreign_keys = ON');
    this.schema = extras?.schema;
  }

  private jsonColumnsFor(tableName: string): Set<string> | undefined {
    return this.jsonColumns.get(tableName);
  }

  private serializeRow<T extends Dict<any>>(tableName: string, row: T): T {
    const jsonCols = this.jsonColumnsFor(tableName);
    if (!jsonCols || jsonCols.size === 0) return row;
    const out: Dict<any> = { ...row };
    for (const col of jsonCols) {
      const v = out[col];
      if (v !== undefined && v !== null && typeof v !== 'string') {
        out[col] = JSON.stringify(v);
      }
    }
    return out as T;
  }

  private hydrateRow<T extends Dict<any>>(tableName: string, row: T): T {
    const jsonCols = this.jsonColumnsFor(tableName);
    if (!jsonCols || jsonCols.size === 0) return row;
    const out: Dict<any> = { ...row };
    for (const col of jsonCols) {
      const v = out[col];
      if (typeof v === 'string') {
        try {
          out[col] = JSON.parse(v);
        } catch {
          // Leave non-JSON strings alone — tolerates pre-existing rows.
        }
      }
    }
    return out as T;
  }

  destroy(): void {
    this.db.close();
  }

  private all(sql: string, params: BaseType[] = []): Dict<any>[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params.map(normaliseValue)) as Dict<any>[];
  }

  private runStatement(sql: string, params: BaseType[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params.map(normaliseValue));
  }

  private runChanges(sql: string, params: BaseType[] = []): number {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params.map(normaliseValue));
    return info.changes;
  }

  private buildWhere(filter: Filter<any> | undefined): SqlFragment {
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
    return this.all(sql, where.params).map((r) => this.hydrateRow(scope.tableName, r));
  }

  /**
   * Emits ONE SQL statement using nested `WHERE col IN (SELECT … FROM …)`
   * subqueries — one per `parentScope`. The leaf SELECT runs against the
   * target table; each parent scope projects its `link.parentColumn` and
   * gates the leaf via that scope's `link.childColumn`. Builders resolve
   * `pendingJoins` to `$in` / `$notIn` filters before calling this method,
   * so the connector only sees a flat scope.
   */
  async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
    if (spec.pendingJoins.length > 0) {
      throw new PersistenceError(
        `SqliteConnector.queryScoped expects pendingJoins to be resolved upstream; received ${spec.pendingJoins.length} unresolved join(s). Use the CollectionQuery / ScalarQuery / ColumnQuery builders to materialise scopes with joins.`,
      );
    }

    const params: BaseType[] = [];
    const whereClauses: string[] = [];

    for (const parent of spec.parentScopes) {
      const parentTable = quoteIdent(parent.parentTable);
      const parentCol = quoteIdent(parent.link.parentColumn);
      let inner = `SELECT ${parentCol} FROM ${parentTable}`;
      if (parent.parentFilter !== undefined) {
        inner += ` WHERE ${this.compileFilter(parent.parentFilter, params)}`;
      }
      inner += this.buildOrder(parent.parentOrder);
      if (parent.parentLimit !== undefined) inner += ` LIMIT ${Number(parent.parentLimit)}`;
      whereClauses.push(`${quoteIdent(parent.link.childColumn)} IN (${inner})`);
    }

    if (spec.filter !== undefined) {
      whereClauses.push(this.compileFilter(spec.filter, params));
    }

    const projection: Projection = spec.projection;
    const targetTable = quoteIdent(spec.target.tableName);
    let selectClause: string;
    if (projection === 'rows') {
      selectClause = '*';
    } else if (typeof projection === 'object' && projection.kind === 'pk') {
      const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
      selectClause = quoteIdent(pkName);
    } else if (typeof projection === 'object' && projection.kind === 'column') {
      selectClause = quoteIdent(projection.column);
    } else if (typeof projection === 'object' && projection.kind === 'aggregate') {
      if (projection.op === 'count') {
        selectClause = 'COUNT(*) AS result';
      } else {
        if (!projection.column) {
          throw new PersistenceError(
            `Aggregate '${projection.op}' requires a column; received undefined.`,
          );
        }
        selectClause = `${projection.op.toUpperCase()}(${quoteIdent(projection.column)}) AS result`;
      }
    } else {
      throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
    }

    let sql = `SELECT ${selectClause} FROM ${targetTable}`;
    if (whereClauses.length > 0) sql += ` WHERE ${whereClauses.join(' AND ')}`;
    sql += this.buildOrder(spec.order);
    if (spec.limit !== undefined) sql += ` LIMIT ${Number(spec.limit)}`;
    if (spec.skip !== undefined) sql += ` OFFSET ${Number(spec.skip)}`;

    const rows = this.all(sql, params);

    if (projection === 'rows') {
      return rows.map((r) => this.hydrateRow(spec.target.tableName, r));
    }
    if (typeof projection === 'object' && projection.kind === 'pk') {
      const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
      return rows.map((r) => r[pkName]);
    }
    if (typeof projection === 'object' && projection.kind === 'column') {
      return rows.map((r) => r[projection.column]);
    }
    // aggregate
    if (typeof projection === 'object' && projection.kind === 'aggregate') {
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
    const parentRows = this.all(sql, params).map((r) => this.hydrateRow(parent.tableName, r));
    return this.attachIncludes(parentRows, joins);
  }

  /**
   * Compile a `mode: 'select' | 'antiJoin'` join into a `WHERE EXISTS` /
   * `WHERE NOT EXISTS` SQL fragment. Bare column names inside the inner
   * filter resolve against the child table because the inner FROM is set
   * to the child; only the JOIN condition needs explicit qualification.
   */
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

  /**
   * Run one batched `WHERE child.fk IN (parent_pks) [AND filter]` per
   * `mode: 'includes'` join, group children by parent key in JS, attach
   * to `__includes[attachAs]` on each parent row. Same round-trip count as
   * `preloadHasMany` — kept inside the connector so callers go through one
   * capability surface.
   */
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
    const rows = this.all(sql, where.params);
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
    return this.all(sql, where.params).map((r) => this.hydrateRow(scope.tableName, r));
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const attrKeys = Object.keys(attrs);
    if (attrKeys.length === 0) return this.query(scope);
    const serialized = this.serializeRow(scope.tableName, attrs);
    const params: BaseType[] = [];
    const setFragments = attrKeys.map((k) => {
      params.push(serialized[k] as BaseType);
      return `${quoteIdent(k)} = ?`;
    });
    const where = this.buildWhere(scope.filter);
    for (const p of where.params) params.push(p);
    let sql = `UPDATE ${quoteIdent(scope.tableName)} SET ${setFragments.join(', ')}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += ' RETURNING *';
    return this.all(sql, params).map((r) => this.hydrateRow(scope.tableName, r));
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    let sql = `DELETE FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += ' RETURNING *';
    return this.all(sql, where.params).map((r) => this.hydrateRow(scope.tableName, r));
  }

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    if (spec.deltas.length === 0 && (!spec.set || Object.keys(spec.set).length === 0)) return 0;
    const params: BaseType[] = [];
    const setFragments: string[] = [];
    for (const { column, by } of spec.deltas) {
      params.push(by as BaseType);
      setFragments.push(`${quoteIdent(column)} = COALESCE(${quoteIdent(column)}, 0) + ?`);
    }
    if (spec.set) {
      const serialized = this.serializeRow(spec.tableName, spec.set);
      for (const k of Object.keys(spec.set)) {
        params.push(serialized[k] as BaseType);
        setFragments.push(`${quoteIdent(k)} = ?`);
      }
    }
    const where = this.buildWhere(spec.filter);
    for (const p of where.params) params.push(p);
    let sql = `UPDATE ${quoteIdent(spec.tableName)} SET ${setFragments.join(', ')}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    return this.runChanges(sql, params);
  }

  async batchInsert(
    tableName: string,
    _keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const allKeys = new Set<string>();
    for (const item of items) for (const k of Object.keys(item)) allKeys.add(k);
    const cols = Array.from(allKeys);
    if (cols.length === 0) {
      return this.all(`INSERT INTO ${quoteIdent(tableName)} DEFAULT VALUES RETURNING *`).map((r) =>
        this.hydrateRow(tableName, r),
      );
    }
    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const item of items) {
      const serialized = this.serializeRow(tableName, item);
      const placeholders = cols.map((c) => {
        params.push(serialized[c] as BaseType);
        return '?';
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const sql = `INSERT INTO ${quoteIdent(tableName)} (${cols.map(quoteIdent).join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`;
    return this.all(sql, params).map((r) => this.hydrateRow(tableName, r));
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
      const serialized = this.serializeRow(spec.tableName, row);
      const placeholders = cols.map((c) => {
        params.push(serialized[c] as BaseType);
        return '?';
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const conflictCols = spec.conflictTarget.map(quoteIdent).join(', ');
    const conflictClause = ignore
      ? `ON CONFLICT (${conflictCols}) DO NOTHING`
      : `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateColumns
          .map((c: string) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
          .join(', ')}`;
    const sql = `INSERT INTO ${quoteIdent(spec.tableName)} (${cols
      .map(quoteIdent)
      .join(', ')}) VALUES ${valueRows.join(', ')} ${conflictClause} RETURNING *`;
    const inserted = this.all(sql, params).map((r) => this.hydrateRow(spec.tableName, r));

    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c: string) => JSON.stringify(row[c])).join('|');
    const byTuple = new Map<string, Dict<any>>();
    for (const row of inserted) byTuple.set(tupleKey(row), row);

    const missing: Dict<any>[] = [];
    for (const row of spec.rows) {
      if (!byTuple.has(tupleKey(row))) missing.push(row);
    }
    if (missing.length > 0) {
      const fetched = this.fetchByConflict(spec.tableName, spec.conflictTarget, missing).map((r) =>
        this.hydrateRow(spec.tableName, r),
      );
      for (const row of fetched) byTuple.set(tupleKey(row), row);
    }

    return spec.rows
      .map((row: Dict<any>) => byTuple.get(tupleKey(row)))
      .filter((row: Dict<any> | undefined): row is Dict<any> => row !== undefined);
  }

  private fetchByConflict(
    tableName: string,
    conflictTarget: string[],
    rows: Dict<any>[],
  ): Dict<any>[] {
    const params: BaseType[] = [];
    let where: string;
    if (conflictTarget.length === 1) {
      const [col] = conflictTarget;
      const placeholders = rows.map((r) => {
        params.push(r[col] as BaseType);
        return '?';
      });
      where = `${quoteIdent(col)} IN (${placeholders.join(', ')})`;
    } else {
      where = rows
        .map((r) => {
          const parts = conflictTarget.map((c) => {
            params.push(r[c] as BaseType);
            return `${quoteIdent(c)} = ?`;
          });
          return `(${parts.join(' AND ')})`;
        })
        .join(' OR ');
    }
    return this.all(`SELECT * FROM ${quoteIdent(tableName)} WHERE ${where}`, params);
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const params = Array.isArray(bindings) ? bindings : [bindings];
    return this.all(query, params);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn();
    this.runStatement('BEGIN');
    this.inTransaction = true;
    try {
      const result = await fn();
      this.runStatement('COMMIT');
      return result;
    } catch (err) {
      try {
        this.runStatement('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const where = this.buildWhere(scope.filter);
    const fn = kind.toUpperCase();
    let sql = `SELECT ${fn}(${quoteIdent(key)}) AS result FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    const rows = this.all(sql, where.params);
    const value = rows[0]?.result;
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const rows = this.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [
      tableName,
    ]);
    return rows.length > 0;
  }

  /**
   * Reflect the live schema by reading sqlite's `sqlite_master` + `PRAGMA`
   * introspection tables. Returns one `TableDefinition` per user table
   * (skipping `sqlite_*` internals) with column kinds mapped from SQLite's
   * affinity types back to the connector's `ColumnKind` set, primary key
   * flagged on the appropriate column, and indexes (including the unique
   * flag) mirrored from `PRAGMA index_list` / `PRAGMA index_info`. The
   * `sqlite_master.sql` text is parsed for `AUTOINCREMENT` so the result
   * round-trips back into `createTable` cleanly.
   */
  async reflectSchema(): Promise<TableDefinition[]> {
    const tables = this.all(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ) as { name: string; sql: string | null }[];
    const result: TableDefinition[] = [];
    for (const t of tables) {
      const tableName = t.name;
      const ddl = t.sql ?? '';
      const cols = this.all(`PRAGMA table_info(${quoteIdent(tableName)})`) as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      }>;
      const idxList = this.all(`PRAGMA index_list(${quoteIdent(tableName)})`) as Array<{
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }>;
      const indexes: IndexDefinition[] = [];
      for (const idx of idxList) {
        // PRAGMA index_list returns auto-indexes for UNIQUE / PRIMARY KEY
        // constraints with origin === 'pk' / 'u'; we only want explicit
        // CREATE INDEX entries.
        if (idx.origin !== 'c') continue;
        const idxCols = this.all(`PRAGMA index_info(${quoteIdent(idx.name)})`) as Array<{
          seqno: number;
          cid: number;
          name: string;
        }>;
        idxCols.sort((a, b) => a.seqno - b.seqno);
        indexes.push({
          columns: idxCols.map((c) => c.name),
          unique: idx.unique === 1,
          name: idx.name,
        });
      }

      const primaryCol = cols.find((c) => c.pk === 1);
      const columnDefs: ColumnDefinition[] = cols.map((c) => {
        const kind = sqliteTypeToColumnKind(c.type);
        const limit = parseLimit(c.type);
        const { precision, scale } = parsePrecisionScale(c.type);
        const isPrimary = c.pk === 1;
        const colDdl = extractColumnDdl(ddl, c.name);
        const autoIncrement =
          isPrimary && c.type.toUpperCase() === 'INTEGER' && /AUTOINCREMENT/i.test(colDdl);
        const isUniqueViaIdx = idxList.some(
          (idx) =>
            idx.unique === 1 &&
            idx.origin === 'u' &&
            // single-column unique index
            (this.all(`PRAGMA index_info(${quoteIdent(idx.name)})`) as Array<{ name: string }>)
              .length === 1 &&
            (this.all(`PRAGMA index_info(${quoteIdent(idx.name)})`) as Array<{ name: string }>)[0]
              .name === c.name,
        );
        return {
          name: c.name,
          type: kind,
          nullable: c.notnull === 0 && !isPrimary,
          default: parseDefaultValue(c.dflt_value, kind),
          limit,
          primary: isPrimary,
          unique: isUniqueViaIdx,
          precision,
          scale,
          autoIncrement,
        };
      });

      result.push({
        name: tableName,
        columns: columnDefs,
        indexes,
        primaryKey: primaryCol?.name,
      });
    }
    return result;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const def = defineTable(tableName, blueprint);
    this.tableDefinitions.set(tableName, def);
    const jsonCols = new Set(def.columns.filter((c) => c.type === 'json').map((c) => c.name));
    if (jsonCols.size > 0) this.jsonColumns.set(tableName, jsonCols);
    if (await this.hasTable(tableName)) return;
    this.runStatement(this.buildCreateTableSql(tableName, def, [], []));
    for (const idx of def.indexes) await this.createIndex(tableName, idx);
  }

  /**
   * Materialise every table declared in the attached `schema` idempotently.
   * Iterates `schema.tableDefinitions`, skipping tables that already exist
   * and dispatching unknown tables through this connector's `createTable`
   * so SQLite-specific column-type rendering applies.
   */
  async ensureSchema(): Promise<{ created: string[]; existing: string[] }> {
    if (!this.schema) {
      throw new Error(
        'SqliteConnector.ensureSchema(): no schema is attached. Pass `{ schema }` at construction.',
      );
    }
    const created: string[] = [];
    const existing: string[] = [];
    const tableDefinitions = this.schema.tableDefinitions as Record<string, TableDefinition>;
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
          const indexOptions: { name?: string; unique?: boolean } = { unique: idx.unique };
          if (idx.name !== undefined) indexOptions.name = idx.name;
          t.index(idx.columns, indexOptions);
        }
      });
      created.push(tableName);
    }
    return { created, existing };
  }

  async dropTable(tableName: string): Promise<void> {
    this.runStatement(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
    this.jsonColumns.delete(tableName);
    this.tableDefinitions.delete(tableName);
    this.foreignKeys.delete(tableName);
    this.checkConstraints.delete(tableName);
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    if (spec.ops.length === 0) return;
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    switch (op.op) {
      case 'addColumn': {
        const def = definitionFromOp(op.name, op.type, op.options);
        this.runStatement(`ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${this.columnDdl(def)}`);
        if (op.type === 'json') this.markJsonColumn(tableName, op.name);
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      }
      case 'removeColumn':
        this.runStatement(
          `ALTER TABLE ${quoteIdent(tableName)} DROP COLUMN ${quoteIdent(op.name)}`,
        );
        this.unmarkJsonColumn(tableName, op.name);
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      case 'renameColumn':
        this.runStatement(
          `ALTER TABLE ${quoteIdent(tableName)} RENAME COLUMN ${quoteIdent(op.from)} TO ${quoteIdent(op.to)}`,
        );
        this.renameJsonColumn(tableName, op.from, op.to);
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      case 'addIndex':
        await this.createIndex(tableName, {
          columns: op.columns,
          unique: op.unique ?? false,
          name: op.name,
        });
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      case 'removeIndex': {
        const target = Array.isArray(op.nameOrColumns)
          ? `idx_${tableName}_${op.nameOrColumns.join('_')}`
          : op.nameOrColumns;
        this.runStatement(`DROP INDEX IF EXISTS ${quoteIdent(target)}`);
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      }
      case 'renameIndex': {
        const def = this.tableDefinitions.get(tableName);
        const existing = def?.indexes.find((idx) => idx.name === op.from);
        if (!existing) {
          throw new UnsupportedOperationError(
            `SqliteConnector cannot rename index ${op.from} on ${tableName}: index definition is unknown. Use createTable or alterTable through this connector first.`,
          );
        }
        this.runStatement(`DROP INDEX IF EXISTS ${quoteIdent(op.from)}`);
        await this.createIndex(tableName, {
          columns: existing.columns,
          unique: existing.unique,
          name: op.to,
        });
        this.applyToTrackedDefinition(tableName, [op]);
        return;
      }
      case 'changeColumn':
      case 'addForeignKey':
      case 'removeForeignKey':
      case 'addCheckConstraint':
      case 'removeCheckConstraint':
        await this.recreateWithOp(tableName, op);
        return;
    }
  }

  /**
   * SQLite cannot ALTER COLUMN type, ADD/DROP foreign keys, or ADD/DROP CHECK
   * constraints in place. The standard workaround is to copy the table.
   */
  private async recreateWithOp(tableName: string, op: AlterTableOp): Promise<void> {
    const current = this.tableDefinitions.get(tableName);
    if (!current) {
      throw new UnsupportedOperationError(
        `SqliteConnector cannot perform ${op.op} on ${tableName}: table definition is unknown. Use createTable through this connector first.`,
      );
    }
    const fkEntries = this.foreignKeys.get(tableName) ?? [];
    const checkEntries = this.checkConstraints.get(tableName) ?? [];
    let nextDef = current;
    let nextFks = [...fkEntries];
    let nextChecks = [...checkEntries];

    if (op.op === 'changeColumn') {
      nextDef = applyAlterOps(current, [op]);
    } else if (op.op === 'addForeignKey') {
      nextFks.push({
        column: op.column ?? `${op.toTable}Id`,
        toTable: op.toTable,
        primaryKey: op.primaryKey,
        onDelete: op.onDelete,
        onUpdate: op.onUpdate,
        name: op.name ?? foreignKeyName(tableName, op.toTable),
      });
    } else if (op.op === 'removeForeignKey') {
      nextFks = nextFks.filter((fk) => {
        const matchesName = fk.name === op.nameOrTable;
        const matchesTable = fk.toTable === op.nameOrTable;
        const matchesAutoName = fk.name === foreignKeyName(tableName, op.nameOrTable);
        return !(matchesName || matchesTable || matchesAutoName);
      });
    } else if (op.op === 'addCheckConstraint') {
      nextChecks.push({ expression: op.expression, name: op.name });
    } else if (op.op === 'removeCheckConstraint') {
      nextChecks = nextChecks.filter((c) => c.name !== op.name);
    }

    const tempName = `__nm_alter_${tableName}_${Date.now()}`;
    const createSql = this.buildCreateTableSql(tempName, nextDef, nextFks, nextChecks);
    const sharedColumns = current.columns
      .filter((col) => nextDef.columns.some((nc) => nc.name === col.name))
      .map((col) => col.name);
    const sharedQuoted = sharedColumns.map(quoteIdent).join(', ');

    const fkPragma = this.db.pragma('foreign_keys', { simple: true }) as 0 | 1;
    if (fkPragma === 1) this.db.pragma('foreign_keys = OFF');
    const wasInTransaction = this.inTransaction;
    if (!wasInTransaction) this.runStatement('BEGIN');
    try {
      this.runStatement(createSql);
      if (sharedColumns.length > 0) {
        this.runStatement(
          `INSERT INTO ${quoteIdent(tempName)} (${sharedQuoted}) SELECT ${sharedQuoted} FROM ${quoteIdent(tableName)}`,
        );
      }
      this.runStatement(`DROP TABLE ${quoteIdent(tableName)}`);
      this.runStatement(`ALTER TABLE ${quoteIdent(tempName)} RENAME TO ${quoteIdent(tableName)}`);
      for (const idx of nextDef.indexes) {
        await this.createIndex(tableName, idx);
      }
      if (!wasInTransaction) this.runStatement('COMMIT');
    } catch (err) {
      if (!wasInTransaction) {
        try {
          this.runStatement('ROLLBACK');
        } catch {
          // ignore
        }
      }
      throw err;
    } finally {
      if (fkPragma === 1) this.db.pragma('foreign_keys = ON');
    }

    this.tableDefinitions.set(tableName, nextDef);
    this.foreignKeys.set(tableName, nextFks);
    this.checkConstraints.set(tableName, nextChecks);
    if (op.op === 'changeColumn' && op.type === 'json') this.markJsonColumn(tableName, op.name);
  }

  private applyToTrackedDefinition(tableName: string, ops: AlterTableOp[]): void {
    const current = this.tableDefinitions.get(tableName);
    if (!current) return;
    this.tableDefinitions.set(tableName, applyAlterOps(current, ops));
  }

  private markJsonColumn(tableName: string, col: string): void {
    let set = this.jsonColumns.get(tableName);
    if (!set) {
      set = new Set();
      this.jsonColumns.set(tableName, set);
    }
    set.add(col);
  }

  private unmarkJsonColumn(tableName: string, col: string): void {
    const set = this.jsonColumns.get(tableName);
    if (!set) return;
    set.delete(col);
    if (set.size === 0) this.jsonColumns.delete(tableName);
  }

  private renameJsonColumn(tableName: string, from: string, to: string): void {
    const set = this.jsonColumns.get(tableName);
    if (!set?.has(from)) return;
    set.delete(from);
    set.add(to);
  }

  private buildCreateTableSql(
    tableName: string,
    def: TableDefinition,
    foreignKeys: ForeignKeyEntry[],
    checks: CheckEntry[],
  ): string {
    const colSql: string[] = [];
    for (const col of def.columns) colSql.push(this.columnDdl(col));
    for (const fk of foreignKeys) {
      const constraintName = fk.name ? `CONSTRAINT ${quoteIdent(fk.name)} ` : '';
      let frag = `${constraintName}FOREIGN KEY (${quoteIdent(fk.column)}) REFERENCES ${quoteIdent(fk.toTable)}(${quoteIdent(fk.primaryKey ?? 'id')})`;
      if (fk.onDelete) frag += ` ON DELETE ${sqliteAction(fk.onDelete)}`;
      if (fk.onUpdate) frag += ` ON UPDATE ${sqliteAction(fk.onUpdate)}`;
      colSql.push(frag);
    }
    for (const check of checks) {
      const constraintName = check.name ? `CONSTRAINT ${quoteIdent(check.name)} ` : '';
      colSql.push(`${constraintName}CHECK (${check.expression})`);
    }
    return `CREATE TABLE ${quoteIdent(tableName)} (${colSql.join(', ')})`;
  }

  private columnDdl(col: ColumnDefinition): string {
    const parts: string[] = [quoteIdent(col.name)];
    if (col.autoIncrement) {
      parts.push('INTEGER PRIMARY KEY AUTOINCREMENT');
    } else {
      parts.push(this.columnType(col));
      if (col.primary) parts.push('PRIMARY KEY');
      if (col.unique && !col.primary) parts.push('UNIQUE');
      if (!col.nullable) parts.push('NOT NULL');
    }
    if (col.default !== undefined && !col.autoIncrement) {
      parts.push(`DEFAULT ${this.defaultLiteral(col.default)}`);
    }
    return parts.join(' ');
  }

  private columnType(col: ColumnDefinition): string {
    switch (col.type) {
      case 'string':
        return col.limit !== undefined ? `VARCHAR(${col.limit})` : 'TEXT';
      case 'text':
        return 'TEXT';
      case 'integer':
      case 'bigint':
      case 'boolean':
        return 'INTEGER';
      case 'float':
        return 'REAL';
      case 'decimal':
        return col.precision !== undefined
          ? `NUMERIC(${col.precision}${col.scale !== undefined ? `, ${col.scale}` : ''})`
          : 'NUMERIC';
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'json':
        return 'TEXT';
    }
  }

  private defaultLiteral(value: ColumnDefinition['default']): string {
    if (value === 'currentTimestamp') return 'CURRENT_TIMESTAMP';
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private async createIndex(tableName: string, idx: IndexDefinition): Promise<void> {
    const cols = idx.columns.map(quoteIdent).join(', ');
    const name = quoteIdent(idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`);
    const unique = idx.unique ? 'UNIQUE ' : '';
    this.runStatement(
      `CREATE ${unique}INDEX IF NOT EXISTS ${name} ON ${quoteIdent(tableName)} (${cols})`,
    );
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

function sqliteAction(action: ForeignKeyAction): string {
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
 * Map a SQLite affinity / declared-type string back to the connector's
 * `ColumnKind`. SQLite is forgiving about declared types — most strings work
 * — so this is a best-effort inverse of `columnType(...)` above.
 */
function sqliteTypeToColumnKind(declared: string): ColumnKind {
  const t = declared.toUpperCase().split('(')[0].trim();
  switch (t) {
    case 'INTEGER':
      return 'integer';
    case 'BIGINT':
      return 'bigint';
    case 'REAL':
    case 'DOUBLE':
    case 'FLOAT':
      return 'float';
    case 'NUMERIC':
    case 'DECIMAL':
      return 'decimal';
    case 'BOOLEAN':
      return 'boolean';
    case 'DATE':
      return 'date';
    case 'DATETIME':
      return 'datetime';
    case 'TIMESTAMP':
      return 'timestamp';
    case 'JSON':
      return 'json';
    case 'VARCHAR':
    case 'CHAR':
    case 'CHARACTER':
      return 'string';
    case 'TEXT':
    case 'CLOB':
      return 'text';
    default:
      // Fallback: SQLite affinity is dynamic; assume text for unrecognised types.
      return 'text';
  }
}

function parseLimit(declared: string): number | undefined {
  const match = declared.match(/^\s*(?:VARCHAR|CHAR|CHARACTER)\s*\(\s*(\d+)\s*\)\s*$/i);
  return match ? Number(match[1]) : undefined;
}

function parsePrecisionScale(declared: string): { precision?: number; scale?: number } {
  const match = declared.match(/^\s*(?:NUMERIC|DECIMAL)\s*\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\)\s*$/i);
  if (!match) return {};
  const precision = Number(match[1]);
  const scale = match[2] !== undefined ? Number(match[2]) : undefined;
  return { precision, scale };
}

/**
 * SQLite stores the literal default text from the original DDL (e.g.
 * `'api'`, `5`, `CURRENT_TIMESTAMP`, `NULL`). Decode those back into the
 * connector's `ColumnDefault` shape so reflection round-trips through
 * `defineSchema(...)` without surprises.
 */
function parseDefaultValue(raw: unknown, kind: ColumnKind): ColumnDefault | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (s.toUpperCase() === 'NULL') return null;
  if (s.toUpperCase() === 'CURRENT_TIMESTAMP') return 'currentTimestamp';
  // SQLite stores string defaults wrapped in single quotes and escapes inner
  // quotes by doubling them.
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (kind === 'boolean') {
    if (s === '1') return true;
    if (s === '0') return false;
  }
  if (kind === 'integer' || kind === 'bigint' || kind === 'float' || kind === 'decimal') {
    const num = Number(s);
    return Number.isFinite(num) ? num : s;
  }
  return s;
}

/**
 * Pull the declared text for a single column out of a `CREATE TABLE` DDL so
 * we can detect SQLite-specific markers (currently just `AUTOINCREMENT`)
 * that aren't surfaced via `PRAGMA table_info`.
 */
function extractColumnDdl(ddl: string, columnName: string): string {
  // Strip the leading `CREATE TABLE "name" (` and matching trailing `)`.
  const inner = ddl.replace(/^\s*CREATE\s+TABLE\s+[^(]+\(/i, '').replace(/\)\s*$/, '');
  // Naive split — column / constraint definitions are comma-separated at the
  // top level. Good enough for autoincrement detection (no nested parens
  // appear inside a single autoincrement column declaration).
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  for (const part of parts) {
    const trimmed = part.trim();
    if (
      trimmed.startsWith(`"${columnName}"`) ||
      trimmed.startsWith(`\`${columnName}\``) ||
      trimmed.startsWith(`${columnName} `) ||
      trimmed === columnName
    ) {
      return trimmed;
    }
  }
  return '';
}
