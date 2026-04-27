try {
  const pg = require('pg');
  pg.types.setTypeParser(20, 'text', Number.parseInt);
} catch {}

import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
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
  type JoinClause,
  type JoinQuerySpec,
  KeyType,
  PersistenceError,
  type Projection,
  type QueryScopedSpec,
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
        `KnexConnector.queryScoped expects pendingJoins to be resolved upstream; received ${spec.pendingJoins.length} unresolved join(s). Use the CollectionQuery / ScalarQuery / ColumnQuery builders to materialise scopes with joins.`,
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
      const rows = (await builder.select('*')) as Dict<any>[];
      return rows;
    }
    if (typeof projection === 'object' && projection.kind === 'pk') {
      const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
      return builder.pluck(pkName);
    }
    if (typeof projection === 'object' && projection.kind === 'column') {
      return builder.pluck(projection.column);
    }
    if (typeof projection === 'object' && projection.kind === 'aggregate') {
      if (projection.op === 'count') {
        const rows: Dict<any>[] = await builder.count('* as c');
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
      const rows: Dict<any>[] = await (builder as any)[fn](`${projection.column} as v`);
      if (rows.length === 0) return undefined;
      const v = rows[0].v;
      return v == null ? undefined : Number(v);
    }
    throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
  }

  async queryWithJoins(spec: JoinQuerySpec): Promise<Dict<any>[]> {
    const { parent, joins } = spec;
    const parentTable = parent.tableName;
    let query = this.table(parentTable);
    query = (await this.filter(query, parent.filter)).query;
    // EXISTS / NOT EXISTS for `select` / `antiJoin` joins. These filter parent
    // rows in a single statement; no parent duplication possible.
    for (const join of joins) {
      if (join.mode === 'select') {
        query = this.applyExistsJoin(query, parentTable, join, 'whereExists');
      } else if (join.mode === 'antiJoin') {
        query = this.applyExistsJoin(query, parentTable, join, 'whereNotExists');
      }
    }
    query = this.applyOrder(query, parent.order);
    if (parent.skip !== undefined) query = query.offset(parent.skip);
    if (parent.limit !== undefined) query = query.limit(parent.limit);
    const parentRows: Dict<any>[] = await query.select(`${parentTable}.*`);
    // Attach `mode: 'includes'` children. One batched query per association
    // (`SELECT * FROM child WHERE child.fk IN (parent_pks) [AND filter]`).
    // Equivalent shape to `preloadHasMany` — same round-trip count — but kept
    // inside the connector so callers go through one capability surface.
    const includesJoins = joins.filter((j) => j.mode === 'includes');
    if (includesJoins.length === 0) return parentRows;
    for (const row of parentRows) {
      (row as Dict<any>).__includes = {};
    }
    for (const join of includesJoins) {
      const parentKeys = collectIncludeKeys(parentRows, join.on.parentColumn);
      if (parentKeys.length === 0) {
        for (const row of parentRows) {
          ((row as Dict<any>).__includes as Dict<Dict<any>[]>)[join.attachAs ?? ''] = [];
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
        const bucket = grouped.get(key) ?? [];
        ((row as Dict<any>).__includes as Dict<Dict<any>[]>)[join.attachAs ?? ''] = bucket;
      }
    }
    return parentRows;
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

  async deltaUpdate(spec: DeltaUpdateSpec): Promise<number> {
    if (spec.deltas.length === 0 && (!spec.set || Object.keys(spec.set).length === 0)) return 0;
    const table = this.table(spec.tableName);
    const { query } = await this.filter(table, spec.filter);
    const update: Dict<any> = {};
    for (const { column, by } of spec.deltas) {
      // `?? + ?` quotes the column identifier and binds the delta as a parameter,
      // producing e.g. `"col" + 3` on pg, `` `col` + 3 `` on mysql/mariadb, `"col" + 3` on sqlite.
      // COALESCE so NULL columns are treated as 0.
      update[column] = this.knex.raw('COALESCE(??, 0) + ?', [column, by]);
    }
    if (spec.set) {
      for (const k of Object.keys(spec.set)) update[k] = spec.set[k];
    }
    const affected = (await query.update(update)) as unknown;
    return typeof affected === 'number' ? affected : Number(affected ?? 0);
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

  async alterTable(spec: AlterTableSpec): Promise<void> {
    if (spec.ops.length === 0) return;
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    const builder = this.schemaBuilder();
    switch (op.op) {
      case 'addColumn':
        await builder.alterTable(tableName, (table) => {
          applyColumnDefinition(table, this.knex, op.name, op.type, op.options);
        });
        return;
      case 'removeColumn':
        await builder.alterTable(tableName, (table) => {
          table.dropColumn(op.name);
        });
        return;
      case 'renameColumn':
        await builder.alterTable(tableName, (table) => {
          table.renameColumn(op.from, op.to);
        });
        return;
      case 'changeColumn':
        await builder.alterTable(tableName, (table) => {
          applyColumnDefinition(table, this.knex, op.name, op.type, op.options, true);
        });
        return;
      case 'addIndex':
        await builder.alterTable(tableName, (table) => {
          if (op.unique) table.unique(op.columns, { indexName: op.name });
          else table.index(op.columns, op.name);
        });
        return;
      case 'removeIndex':
        await builder.alterTable(tableName, (table) => {
          if (typeof op.nameOrColumns === 'string') {
            // Knex needs columns to drop a non-unique index without a name. Try
            // dropping by name first; if that errors at runtime callers can fall
            // back to passing the column array.
            table.dropIndex([], op.nameOrColumns);
          } else {
            table.dropIndex(op.nameOrColumns);
          }
        });
        return;
      case 'renameIndex':
        await builder.alterTable(tableName, (table) => {
          if (typeof (table as any).renameIndex === 'function') {
            (table as any).renameIndex(op.from, op.to);
            return;
          }
          throw new PersistenceError(
            `renameIndex is not supported by this Knex client; drop and recreate the index instead`,
          );
        });
        return;
      case 'addForeignKey': {
        const localColumn = op.column ?? `${op.toTable}Id`;
        const constraintName = op.name ?? foreignKeyName(tableName, op.toTable);
        await builder.alterTable(tableName, (table) => {
          const fk = table
            .foreign(localColumn, constraintName)
            .references(op.primaryKey ?? 'id')
            .inTable(op.toTable);
          if (op.onDelete) fk.onDelete(toSqlAction(op.onDelete));
          if (op.onUpdate) fk.onUpdate(toSqlAction(op.onUpdate));
        });
        return;
      }
      case 'removeForeignKey': {
        const constraint = op.nameOrTable.startsWith('fk_')
          ? op.nameOrTable
          : foreignKeyName(tableName, op.nameOrTable);
        await builder.alterTable(tableName, (table) => {
          table.dropForeign([], constraint);
        });
        return;
      }
      case 'addCheckConstraint':
        await builder.alterTable(tableName, (table) => {
          if (typeof (table as any).check === 'function') {
            (table as any).check(op.expression, undefined, op.name);
            return;
          }
          throw new PersistenceError(
            `addCheckConstraint requires Knex >= 2.5; this version doesn't expose t.check()`,
          );
        });
        return;
      case 'removeCheckConstraint':
        await builder.alterTable(tableName, (table) => {
          if (typeof (table as any).dropChecks === 'function') {
            (table as any).dropChecks(op.name);
            return;
          }
          throw new PersistenceError(
            `removeCheckConstraint requires Knex >= 2.5; this version doesn't expose t.dropChecks()`,
          );
        });
        return;
    }
  }
}

function collectIncludeKeys(rows: Dict<any>[], column: string): unknown[] {
  const seen = new Set<unknown>();
  const result: unknown[] = [];
  for (const row of rows) {
    const v = (row as Dict<any>)[column];
    if (v == null || seen.has(v)) continue;
    seen.add(v);
    result.push(v);
  }
  return result;
}

function buildKnexColumn(
  table: Knex.CreateTableBuilder,
  col: ColumnDefinition,
): Knex.ColumnBuilder {
  return columnByKind(table, col.name, col.type, col);
}

function columnByKind(
  table: Knex.CreateTableBuilder | Knex.AlterTableBuilder,
  name: string,
  type: ColumnKind,
  col: { limit?: number; precision?: number; scale?: number },
): Knex.ColumnBuilder {
  switch (type) {
    case 'string':
      return table.string(name, col.limit ?? 255);
    case 'text':
      return table.text(name);
    case 'integer':
      return table.integer(name);
    case 'bigint':
      return table.bigInteger(name);
    case 'float':
      return table.float(name);
    case 'decimal':
      return table.decimal(name, col.precision, col.scale);
    case 'boolean':
      return table.boolean(name);
    case 'date':
      return table.date(name);
    case 'datetime':
    case 'timestamp':
      return table.timestamp(name);
    case 'json':
      return table.json(name);
  }
}

function applyColumnDefinition(
  table: Knex.AlterTableBuilder,
  knex: Knex,
  name: string,
  type: ColumnKind,
  options: ColumnOptions = {},
  alter = false,
): void {
  if (options.autoIncrement) {
    const auto = table.increments(name);
    if (options.unique) auto.unique();
    if (alter) auto.alter();
    return;
  }
  const col = columnByKind(table, name, type, options);
  if (options.primary) col.primary();
  if (options.unique) col.unique();
  if (options.null === false) col.notNullable();
  else col.nullable();
  if (options.default !== undefined) {
    if (options.default === 'currentTimestamp') {
      col.defaultTo(knex.fn.now());
    } else {
      col.defaultTo(options.default as any);
    }
  }
  if (alter) col.alter();
}

function toSqlAction(action: ForeignKeyAction): string {
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

export default KnexConnector;
