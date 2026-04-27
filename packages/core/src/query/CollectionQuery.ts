import { PersistenceError } from '../errors.js';
import { normalizeFilterShape } from '../FilterEngine.js';
import {
  type AssociationDefinition,
  compileHaving,
  type HavingPredicate,
  type IncludeOptions,
  NullConnector,
  resolveAssociationTarget,
  type SimpleAssociationDefinition,
} from '../Model.js';
import type { Dict, KeyType } from '../types.js';
import {
  type AssociationLink,
  type Callback,
  type Connector,
  type Filter,
  type JoinClause,
  type Order,
  SortDirection,
} from '../types.js';
import { ColumnQuery } from './ColumnQuery.js';
import { decodeCompositeCursor, encodeCompositeCursor, encodeCursor } from './cursor.js';
import { InstanceQuery } from './InstanceQuery.js';
import { applyIncludes, attachIncludesPayload } from './includes.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import { mergeFilters, mergeOrders, type ParentRef, type QueryState } from './QueryState.js';
import { ScalarQuery } from './ScalarQuery.js';
import {
  andMergeFilters,
  builderScopeBase,
  resolveParentScopesToFilter,
  resolvePendingJoinsToScope,
} from './scope.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

// Build a temp Model subclass carrying QueryState fields as static properties.
// Used by chain methods that delegate to a Model static (named scopes, enum
// scopes, etc.) so the static reads `this.<x>` sees the chained scope.
function makeScopedSubclass(M: any, state: QueryState): any {
  const Sub = class extends (M as any) {
    static filter = state.filter;
    static order = [...state.order];
    static limit = state.limit;
    static skip = state.skip;
    static selectedFields = state.selectedFields;
    static selectedIncludes = [...state.selectedIncludes];
    static includeStrategy = state.includeStrategy;
    static pendingJoins = [...state.pendingJoins];
    static havingPredicate = state.havingPredicate;
    static softDelete = state.softDelete;
    static connector = state.nullScoped ? new NullConnector() : (M as any).connector;
  };
  return Sub;
}

// Built-in static methods on ModelClass / Model factory subclass we don't
// want to surface on the CollectionQuery (saving / persistence / table-defining).
const STATIC_BLACKLIST = new Set<string>([
  'tableName',
  'init',
  'keys',
  'connector',
  'createdAtColumn',
  'updatedAtColumn',
  'softDeleteColumn',
  'enums',
  'lockVersionColumn',
  'inheritColumn',
  'inheritType',
  'inheritRegistry',
  'storeAccessors',
  'cascadeMap',
  'normalizers',
  'secureTokenColumns',
  'validators',
  'callbacks',
  'associations',
  'transaction',
  'on',
  'skipCallbacks',
  'inherit',
  'build',
  'buildScoped',
  'create',
  'createScoped',
  'createMany',
  'upsert',
  'upsertAll',
  'runUpsert',
  'aggregate',
  // Constants from primitive Function:
  'name',
  'length',
  'prototype',
  'caller',
  'arguments',
]);

/**
 * Attach user-defined Model-class extras (named scopes, enum scopes, factory
 * scopes) onto a CollectionQuery instance so chain forms like
 * `User.adminScope().filterBy({...})` keep working. The user-defined static
 * is invoked against a state-projected subclass, so its `this.<x>` reads
 * see the chained scope. Idempotent — skips entries already defined on the
 * prototype (CollectionQuery's own filterBy, all, etc. always win).
 */
function attachModelExtras(q: CollectionQuery, M: any): void {
  if (!M) return;
  const seen = new Set<string>();
  // Walk the prototype chain to collect every static method declared on the
  // Model factory subclass + ModelClass. Properties already on the
  // CollectionQuery prototype (filterBy, all, etc.) win — we won't shadow them.
  let proto: any = M;
  while (proto && proto !== Function.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (STATIC_BLACKLIST.has(name)) continue;
      if (name in q) continue;
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      if (!desc) continue;
      const value = desc.value;
      if (typeof value !== 'function') continue;
      Object.defineProperty(q, name, {
        value: function (this: CollectionQuery, ...args: any[]) {
          const Sub = makeScopedSubclass(this.model as any, this.state);
          return value.apply(Sub, args);
        },
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
    proto = Object.getPrototypeOf(proto);
  }
}

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
  ) {}

  // Static-property accessors: chain methods cast their CollectionQuery
  // return value back to `typeof Model`, so callers (and tests) read fields
  // like `.filter`, `.order`, `.connector` directly. Surface them as
  // read-only getters that defer to state / the underlying ModelLike.
  get filter(): Filter<any> | undefined {
    return this.state.filter;
  }
  get order() {
    return this.state.order;
  }
  get limit(): number | undefined {
    return this.state.limit;
  }
  get skip(): number | undefined {
    return this.state.skip;
  }
  get pendingJoins(): JoinClause[] {
    return this.state.pendingJoins;
  }
  get selectedIncludes(): string[] {
    return this.state.selectedIncludes;
  }
  get includeStrategy() {
    return this.state.includeStrategy;
  }
  get selectedFields(): string[] | undefined {
    return this.state.selectedFields;
  }
  get havingPredicate() {
    return this.state.havingPredicate;
  }
  get softDelete() {
    return this.state.softDelete;
  }
  get softDeleteColumn(): string {
    return (this.model as any).softDeleteColumn ?? 'discardedAt';
  }
  get tableName(): string {
    return this.model.tableName;
  }
  get keys() {
    return this.model.keys;
  }
  get connector(): any {
    return (this.model as any).connector;
  }
  get associations() {
    return (this.model as any).associations;
  }
  get inheritColumn(): string | undefined {
    return (this.model as any).inheritColumn;
  }
  get inheritType(): string | undefined {
    return (this.model as any).inheritType;
  }
  get inheritRegistry() {
    return (this.model as any).inheritRegistry;
  }
  get callbacks(): any {
    return (this.model as any).callbacks;
  }
  get name(): string | undefined {
    return (this.model as any).name;
  }

  protected with(patch: Partial<QueryState>): this {
    const next = new (this.constructor as any)(this.model, { ...this.state, ...patch });
    attachModelExtras(next, this.model as any);
    return next;
  }

  filterBy(input: Filter<any>): this {
    const andFilter = normalizeFilterShape(input);
    const associations = (this.model as any).associations as
      | Record<string, AssociationDefinition>
      | undefined;
    const associationJoins: JoinClause[] = [];
    let columnFilter: Dict<any> = andFilter as Dict<any>;
    if (associations) {
      const keys = Object.keys(andFilter);
      const matched: string[] = [];
      for (const key of keys) {
        if (key.startsWith('$')) continue;
        if (associations[key]) matched.push(key);
      }
      if (matched.length > 0) {
        const filtered: Dict<any> = {};
        for (const key of keys) {
          if (matched.includes(key)) continue;
          filtered[key] = (andFilter as any)[key];
        }
        columnFilter = filtered;
        for (const name of matched) {
          const assoc = associations[name];
          if ('hasManyThrough' in assoc) {
            throw new PersistenceError(
              `CollectionQuery.filterBy({ ${name}: ... }) does not support hasManyThrough associations. Traverse the chain explicitly via the association accessor instead.`,
            );
          }
          const resolved = resolveAssociationTarget(assoc as SimpleAssociationDefinition);
          const childFilterInput = (andFilter as any)[name];
          const childFilter =
            childFilterInput && typeof childFilterInput === 'object'
              ? normalizeFilterShape(childFilterInput as Filter<any>)
              : (childFilterInput as Filter<any>);
          associationJoins.push({
            kind: 'inner',
            childTableName: resolved.target.tableName,
            on: { parentColumn: resolved.parentColumn, childColumn: resolved.childColumn },
            filter: childFilter,
            mode: 'select',
            childPrimaryKey: Object.keys(resolved.target.keys)[0] ?? 'id',
            target: resolved.target,
          });
        }
      }
    }
    const merged = mergeFilters(this.state.filter, columnFilter as Filter<any>);
    const nextJoins =
      associationJoins.length > 0
        ? [...this.state.pendingJoins, ...associationJoins]
        : this.state.pendingJoins;
    return this.with({ filter: merged, pendingJoins: nextJoins });
  }

  joins(...names: string[]): this {
    const associations = (this.model as any).associations as
      | Record<string, AssociationDefinition>
      | undefined;
    if (!associations) {
      throw new PersistenceError(
        `CollectionQuery.joins(...) requires the Model factory to declare 'associations'.`,
      );
    }
    if (names.length === 0) {
      throw new PersistenceError(
        `CollectionQuery.joins(...) requires at least one association name.`,
      );
    }
    const parentDefaultPk = Object.keys(this.model.keys)[0] ?? 'id';
    const newJoins: JoinClause[] = [];
    for (const name of names) {
      const spec = associations[name];
      if (!spec) {
        throw new PersistenceError(
          `Unknown association '${name}'. Declared associations: [${Object.keys(associations).join(', ')}]`,
        );
      }
      if ('hasManyThrough' in spec) {
        throw new PersistenceError(
          `CollectionQuery.joins(...) does not support hasManyThrough associations. Use query builder traversal instead.`,
        );
      }
      const normalized: SimpleAssociationDefinition =
        'belongsTo' in spec
          ? { belongsTo: spec.belongsTo, foreignKey: spec.foreignKey, primaryKey: spec.primaryKey }
          : 'hasMany' in spec
            ? {
                hasMany: spec.hasMany,
                foreignKey: spec.foreignKey,
                primaryKey: spec.primaryKey ?? parentDefaultPk,
              }
            : {
                hasOne: spec.hasOne,
                foreignKey: spec.foreignKey,
                primaryKey: spec.primaryKey ?? parentDefaultPk,
              };
      const resolved = resolveAssociationTarget(normalized);
      newJoins.push({
        kind: 'inner',
        childTableName: resolved.target.tableName,
        on: { parentColumn: resolved.parentColumn, childColumn: resolved.childColumn },
        mode: 'select',
        childPrimaryKey: Object.keys(resolved.target.keys)[0] ?? 'id',
        target: resolved.target,
      });
    }
    return this.with({ pendingJoins: [...this.state.pendingJoins, ...newJoins] });
  }

  whereMissing(name: string): this {
    const associations = (this.model as any).associations as
      | Record<string, AssociationDefinition>
      | undefined;
    if (!associations) {
      throw new PersistenceError(
        `CollectionQuery.whereMissing(...) requires the Model factory to declare 'associations'.`,
      );
    }
    const spec = associations[name];
    if (!spec) {
      throw new PersistenceError(
        `Unknown association '${name}'. Declared associations: [${Object.keys(associations).join(', ')}]`,
      );
    }
    if ('hasManyThrough' in spec) {
      throw new PersistenceError(
        `CollectionQuery.whereMissing(...) does not support hasManyThrough associations.`,
      );
    }
    if ('belongsTo' in spec) {
      throw new PersistenceError(
        `CollectionQuery.whereMissing(...) only supports hasMany / hasOne associations; '${name}' is belongsTo. Use filterBy({ $null: '${spec.foreignKey}' }) instead.`,
      );
    }
    const resolved = resolveAssociationTarget(spec as SimpleAssociationDefinition);
    const join: JoinClause = {
      kind: 'left',
      childTableName: resolved.target.tableName,
      on: { parentColumn: resolved.parentColumn, childColumn: resolved.childColumn },
      mode: 'antiJoin',
      childPrimaryKey: Object.keys(resolved.target.keys)[0] ?? 'id',
      target: resolved.target,
    };
    return this.with({ pendingJoins: [...this.state.pendingJoins, join] });
  }

  orFilterBy(input: Filter<any>): this {
    const f = normalizeFilterShape(input);
    if (Object.keys(f).length === 0) return this;
    const next = this.state.filter ? ({ $or: [this.state.filter, f] } as Filter<any>) : f;
    return this.with({ filter: next });
  }

  unfiltered(): this {
    return this.with({ filter: undefined });
  }

  orderBy(order: Order<any>): this {
    const next = Array.isArray(order) ? order : [order];
    return this.with({ order: mergeOrders(this.state.order, next) });
  }

  reorder(order: Order<any>): this {
    return this.with({ order: Array.isArray(order) ? [...order] : [order] });
  }

  unordered(): this {
    return this.with({ order: [] });
  }

  reverse(): this {
    const pk = Object.keys(this.model.keys)[0] ?? 'id';
    const existing = this.state.order.length > 0 ? this.state.order : [{ key: pk } as any];
    const flipped = existing.map((c) => ({
      key: c.key,
      dir:
        (c.dir ?? SortDirection.Asc) === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc,
    }));
    return this.with({ order: flipped });
  }

  limitBy(n: number): this {
    return this.with({ limit: n });
  }
  unlimited(): this {
    return this.with({ limit: undefined });
  }
  skipBy(n: number): this {
    return this.with({ skip: n });
  }
  unskipped(): this {
    return this.with({ skip: undefined });
  }

  includes(...args: Array<string | IncludeOptions>): this {
    let options: IncludeOptions = {};
    let names: string[];
    const last = args[args.length - 1];
    if (last !== undefined && typeof last !== 'string') {
      options = last;
      names = args.slice(0, -1) as string[];
    } else {
      names = args as string[];
    }
    const associations = (this.model as any).associations as
      | Record<string, AssociationDefinition>
      | undefined;
    if (!associations) {
      throw new PersistenceError(
        `CollectionQuery.includes(...) requires the Model factory to declare 'associations'.`,
      );
    }
    for (const name of names) {
      if (!associations[name]) {
        throw new PersistenceError(
          `Unknown association '${name}'. Declared associations: [${Object.keys(associations).join(', ')}]`,
        );
      }
    }
    const previous = this.state.selectedIncludes ?? [];
    const next = Array.from(new Set([...previous, ...names]));
    const strategy = options.strategy ?? this.state.includeStrategy ?? 'preload';
    return this.with({ selectedIncludes: next, includeStrategy: strategy });
  }

  withoutIncludes(): this {
    return this.with({ selectedIncludes: [], includeStrategy: 'preload' });
  }

  fields(...keys: string[]): this {
    return this.with({ selectedFields: keys });
  }

  allFields(): this {
    return this.with({ selectedFields: undefined });
  }

  having(predicate: HavingPredicate): this {
    return this.with({ havingPredicate: compileHaving(predicate) });
  }

  first(): InstanceQuery {
    return new InstanceQuery(this.model, 'first', { ...this.state, limit: 1 });
  }

  last(): InstanceQuery {
    // last = first with reversed order — reuse this.reverse() to flip the existing order
    const reversed = this.reverse();
    return new InstanceQuery(this.model, 'last', { ...reversed.state, limit: 1 });
  }

  findBy(filter: Filter<any>): InstanceQuery {
    const narrowed = this.filterBy(filter);
    return new InstanceQuery(this.model, 'findBy', { ...narrowed.state, limit: 1 });
  }

  find(id: string | number): InstanceQuery {
    const pk = Object.keys(this.model.keys)[0] ?? 'id';
    const narrowed = this.filterBy({ [pk]: id } as Filter<any>);
    return new InstanceQuery(this.model, 'find', { ...narrowed.state, limit: 1 });
  }

  findOrFail(filter: Filter<any>): InstanceQuery {
    const narrowed = this.filterBy(filter);
    return new InstanceQuery(this.model, 'findOrFail', { ...narrowed.state, limit: 1 });
  }

  count(): ScalarQuery<number> {
    return new ScalarQuery<number>(this.model, this.state, { kind: 'aggregate', op: 'count' });
  }

  sum(column: string): ScalarQuery<number> {
    return new ScalarQuery<number>(this.model, this.state, {
      kind: 'aggregate',
      op: 'sum',
      column,
    });
  }

  average(column: string): ScalarQuery<number> {
    return new ScalarQuery<number>(this.model, this.state, {
      kind: 'aggregate',
      op: 'avg',
      column,
    });
  }

  minimum<T = unknown>(column: string): ScalarQuery<T | undefined> {
    return new ScalarQuery<T | undefined>(this.model, this.state, {
      kind: 'aggregate',
      op: 'min',
      column,
    });
  }

  maximum<T = unknown>(column: string): ScalarQuery<T | undefined> {
    return new ScalarQuery<T | undefined>(this.model, this.state, {
      kind: 'aggregate',
      op: 'max',
      column,
    });
  }

  pluck(...keys: string[]): ColumnQuery<unknown[]> | Promise<unknown[]> {
    if (keys.length === 0) return Promise.resolve([]);
    if (keys.length > 1) {
      // Multi-column pluck → tuples. Walk the connector's `select` directly
      // and project each row into a tuple of column values in the requested
      // order — matches the legacy Model.pluck(...) tuple shape.
      return (async () => {
        if (this.state.nullScoped) return [];
        const M = this.model as any;
        const scope = await this.resolvedScope();
        const rows = await M.connector.select(scope, ...keys);
        return rows.map((row: Dict<any>) => keys.map((k) => row[k]));
      })();
    }
    const column = keys[0]!;
    return new ColumnQuery<unknown[]>(this.model, column, this.state, { kind: 'column', column });
  }

  /**
   * `pluck` deduplicated — equivalent to a SQL `SELECT DISTINCT`. Mirrors the
   * legacy `Model.pluckUnique(key)` — preserves the order of first appearance.
   */
  async pluckUnique(key: string): Promise<unknown[]> {
    const values = (await this.pluck(key)) as unknown[];
    const seen = new Set<unknown>();
    const result: unknown[] = [];
    for (const v of values) {
      if (seen.has(v)) continue;
      seen.add(v);
      result.push(v);
    }
    return result;
  }

  /**
   * Pluck the primary-key column. One-line shorthand for `pluck(<pk>)` —
   * mirrors the legacy `Model.ids()` static.
   */
  ids(): Promise<unknown[]> {
    const pk = Object.keys(this.model.keys)[0] ?? 'id';
    return this.pluck(pk) as Promise<unknown[]>;
  }

  /**
   * Group rows by the value of `key` and count each bucket. Honours the
   * `having(...)` predicate when present (drops buckets the predicate rejects).
   */
  async countBy(key: string): Promise<Map<unknown, number>> {
    const values = (await this.pluck(key)) as unknown[];
    const result = new Map<unknown, number>();
    for (const value of values) {
      result.set(value, (result.get(value) ?? 0) + 1);
    }
    const predicate = this.state.havingPredicate;
    if (predicate) {
      for (const [bucket, count] of result) {
        if (!predicate(count)) result.delete(bucket);
      }
    }
    return result;
  }

  /**
   * Cheap existence probe — `count() > 0` on the chained scope. Pass `filter`
   * to narrow further before testing without mutating the chain.
   */
  async exists(filter?: Filter<any>): Promise<boolean> {
    const scoped = filter === undefined ? this : this.filterBy(filter);
    return (await scoped.count()) > 0;
  }

  /**
   * Group rows by the value of `key`. Materialises every record (so callbacks
   * fire) and buckets them by attribute value. Use `countBy` when only counts
   * are needed — that path avoids hydrating records.
   */
  async groupBy(key: string): Promise<Map<unknown, unknown[]>> {
    const items = (await this.materialize()) as unknown as any[];
    const result = new Map<unknown, unknown[]>();
    for (const item of items) {
      const bucket = (item.attributes as Dict<any>)[key];
      const list = result.get(bucket);
      if (list) list.push(item);
      else result.set(bucket, [item]);
    }
    return result;
  }

  /**
   * Bulk UPDATE on the chained scope. Auto-stamps `updatedAt` (when the Model
   * declares one) and forwards the resolved scope (with parentScopes /
   * pendingJoins / soft-delete / STI implicit filters all folded into the
   * filter) to `connector.updateAll`. Per-row `beforeUpdate` / `afterUpdate`
   * callbacks DO NOT fire — use `findEach` + `record.update(...)` for that.
   */
  async updateAll(attrs: Dict<any>): Promise<unknown[]> {
    if (this.state.nullScoped) return [];
    const M = this.model as any;
    const effectiveAttrs = { ...attrs };
    const updatedCol = M.updatedAtColumn as string | undefined;
    if (updatedCol && effectiveAttrs[updatedCol] === undefined) {
      effectiveAttrs[updatedCol] = new Date();
    }
    const scope = await this.resolvedScope();
    return await (M.connector as Connector).updateAll(scope, effectiveAttrs);
  }

  /**
   * Bulk DELETE on the chained scope. Per-row `beforeDelete` / `afterDelete`
   * callbacks DO NOT fire — use `destroyAll()` for that. Returns the deleted
   * row payloads from the connector.
   */
  async deleteAll(): Promise<unknown[]> {
    if (this.state.nullScoped) return [];
    const M = this.model as any;
    const scope = await this.resolvedScope();
    return await (M.connector as Connector).deleteAll(scope);
  }

  /**
   * Materialise every matching record, then call `.delete()` on each so
   * per-row callbacks fire and any `cascade` config takes effect. Slower than
   * `deleteAll()` (N round-trips) but matches Rails' `destroy_all` semantics.
   */
  async destroyAll(): Promise<unknown[]> {
    const records = (await this.materialize()) as unknown as any[];
    for (const record of records) {
      await record.delete();
    }
    return records;
  }

  /**
   * Atomic `column = column + by` on the chained scope. Routes through the
   * connector's `deltaUpdate(spec)` so each connector picks the most efficient
   * native shape. Returns the affected row count.
   */
  async increment(column: string, by = 1): Promise<number> {
    if (this.state.nullScoped) return 0;
    const M = this.model as any;
    const updatedCol = M.updatedAtColumn as string | undefined;
    const scope = await this.resolvedScope();
    const set: Dict<any> | undefined = updatedCol ? { [updatedCol]: new Date() } : undefined;
    return await (M.connector as Connector).deltaUpdate({
      tableName: scope.tableName,
      filter: scope.filter,
      deltas: [{ column, by }],
      set,
    });
  }

  /** Sugar for `increment(column, -by)`. */
  async decrement(column: string, by = 1): Promise<number> {
    return this.increment(column, -by);
  }

  /**
   * Offset-based pagination on the chained scope. Returns the page items,
   * total count, and computed metadata (total pages, hasNext, hasPrev).
   * Shape mirrors the legacy `Model.paginate(page, perPage)`.
   */
  async paginate(
    page: number,
    perPage = 25,
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const safePage = Math.max(1, Math.floor(page));
    const safePerPage = Math.max(1, Math.floor(perPage));
    const skip = (safePage - 1) * safePerPage;
    const scoped = this.limitBy(safePerPage).skipBy(skip);
    const [items, total] = await Promise.all([
      scoped.all() as Promise<unknown[]>,
      this.unlimited().unskipped().count(),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / safePerPage);
    return {
      items,
      total,
      page: safePage,
      perPage: safePerPage,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    };
  }

  /**
   * Cursor-based pagination on the chained scope. Avoids the O(skip) cost of
   * `paginate(...)`'s LIMIT/OFFSET path. Pass `after` to advance, `before` to
   * walk backward; without either, returns the first page. The chain's lead
   * `orderBy` column is the cursor key; the primary key is always included as
   * a tie-breaker so identical sort values paginate deterministically.
   */
  async paginateCursor(options: { after?: string; before?: string; limit?: number } = {}): Promise<{
    items: unknown[];
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
  }> {
    const limit = Math.max(1, Math.floor(options.limit ?? 25));
    const primaryKey = Object.keys(this.model.keys)[0] ?? 'id';
    const leadOrder = this.state.order[0];
    const orderKey = (leadOrder?.key as string | undefined) ?? primaryKey;
    const orderDir = leadOrder?.dir ?? SortDirection.Asc;
    const usesPrimaryOnly = orderKey === primaryKey;
    let scoped: this = this;
    let reverse = false;

    const stepDirection = (walk: 'after' | 'before'): 'forward' | 'backward' => {
      const forward = walk === 'after';
      if (orderDir === SortDirection.Desc) return forward ? 'backward' : 'forward';
      return forward ? 'forward' : 'backward';
    };

    const buildFilter = (token: string, walk: 'after' | 'before'): Filter<any> => {
      const payload = decodeCompositeCursor(token);
      const orderValue = payload[orderKey];
      const primaryValue = payload[primaryKey];
      const direction = stepDirection(walk);
      const cmp = direction === 'forward' ? '$gt' : '$lt';
      if (usesPrimaryOnly) {
        return { [cmp]: { [primaryKey]: primaryValue } } as Filter<any>;
      }
      return {
        $or: [
          { [cmp]: { [orderKey]: orderValue } },
          {
            $and: [{ [orderKey]: orderValue }, { [cmp]: { [primaryKey]: primaryValue } }],
          },
        ],
      } as Filter<any>;
    };

    if (options.after !== undefined) {
      scoped = scoped.filterBy(buildFilter(options.after, 'after'));
    } else if (options.before !== undefined) {
      scoped = scoped.filterBy(buildFilter(options.before, 'before')).reverse();
      reverse = true;
    }
    const fetched = (await scoped.limitBy(limit + 1).materialize()) as unknown as any[];
    const hasMore = fetched.length > limit;
    let items = hasMore ? fetched.slice(0, limit) : fetched;
    if (reverse) items = items.reverse();
    const first = items[0] as Dict<any> | undefined;
    const last = items[items.length - 1] as Dict<any> | undefined;
    const tokenFor = (row: Dict<any>): string =>
      usesPrimaryOnly
        ? encodeCursor(row[primaryKey], primaryKey)
        : encodeCompositeCursor({
            [orderKey]: row[orderKey],
            [primaryKey]: row[primaryKey],
          });
    return {
      items: items as unknown[],
      nextCursor: hasMore && last ? tokenFor(last) : undefined,
      prevCursor: first ? tokenFor(first) : undefined,
      hasMore,
    };
  }

  /**
   * Yield batches of records of size `size` from the chained scope. Walks via
   * keyset pagination on the chain's existing order (or primary key when
   * unset) so each batch is one round-trip.
   */
  async *inBatchesOf(size: number): AsyncGenerator<unknown[], void, void> {
    const batchSize = Math.max(1, Math.floor(size));
    const primaryKey = Object.keys(this.model.keys)[0] ?? 'id';
    const ordered = this.state.order.length > 0 ? this : this.orderBy({ key: primaryKey });
    const baseSkip = this.state.skip ?? 0;
    const totalLimit = this.state.limit;
    let offset = 0;
    while (true) {
      const remaining = totalLimit === undefined ? batchSize : totalLimit - offset;
      if (remaining <= 0) return;
      const take = Math.min(batchSize, remaining);
      const batch = (await ordered
        .unlimited()
        .unskipped()
        .skipBy(baseSkip + offset)
        .limitBy(take)
        .materialize()) as unknown as unknown[];
      if (batch.length === 0) return;
      yield batch;
      if (batch.length < take) return;
      offset += batch.length;
    }
  }

  /**
   * Yield records one at a time from the chained scope, batching internally.
   * Default batch size 100. Useful for streaming large result sets without
   * loading everything into memory.
   */
  async *findEach(size = 100): AsyncGenerator<unknown, void, void> {
    for await (const batch of this.inBatchesOf(size)) {
      for (const item of batch) yield item;
    }
  }

  /**
   * Project the chained scope to specific columns via the connector's `select`.
   * Returns rows shaped with only the requested keys — does NOT hydrate Model
   * instances (use `fields(...)` + `all()` for that).
   */
  async select(...keys: string[]): Promise<Dict<any>[]> {
    if (this.state.nullScoped) return [];
    const M = this.model as any;
    const scope = await this.resolvedScope();
    return await (M.connector as Connector).select(scope, ...(keys as string[]));
  }

  /**
   * Resolve the chained state into a connector-facing `Scope` ready for
   * `updateAll` / `deleteAll` / `select` / `deltaUpdate`. Folds in:
   *   - operator-form subquery resolution (`{$gt: scalarQuery}` → `{$gt: N}`)
   *   - parent-scope resolution (state.parent + top-level builder values →
   *     `$in` filters)
   *   - soft-delete / STI implicit filters
   *   - `pendingJoins` resolution into `$in` / `$notIn` filters
   */
  private async resolvedScope() {
    const M = this.model as any;
    const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
    const builderForLower =
      resolvedFilter !== this.state.filter
        ? new (this.constructor as any)(this.model, { ...this.state, filter: resolvedFilter })
        : this;
    const spec = lower(builderForLower, 'rows');
    let cleanFilter: Filter<any> | undefined = spec.filter;
    if (spec.parentScopes && spec.parentScopes.length > 0) {
      const fragmentFilter = await resolveParentScopesToFilter(M.connector, spec.parentScopes);
      cleanFilter = andMergeFilters(cleanFilter, fragmentFilter);
    }
    return resolvePendingJoinsToScope(M, { ...this.state, filter: cleanFilter });
  }

  merge(other: typeof import('../Model.js').ModelClass | CollectionQuery): this {
    const otherFilter = other instanceof CollectionQuery ? other.state.filter : other.filter;
    const otherOrder = other instanceof CollectionQuery ? other.state.order : other.order;
    const otherLimit = other instanceof CollectionQuery ? other.state.limit : other.limit;
    const otherSkip = other instanceof CollectionQuery ? other.state.skip : other.skip;
    let q: this = this;
    if (otherFilter) q = q.filterBy(otherFilter);
    if (otherOrder && otherOrder.length > 0) q = q.reorder(otherOrder);
    if (otherLimit !== undefined) q = q.limitBy(otherLimit);
    if (otherSkip !== undefined) q = q.skipBy(otherSkip);
    return q;
  }

  none(): this {
    return this.with({ nullScoped: true });
  }

  withDiscarded(): this {
    return this.with({ softDelete: false });
  }

  onlyDiscarded(): this {
    return this.with({ softDelete: 'only' });
  }

  unscoped(): this {
    return this.with({
      filter: undefined,
      order: [],
      limit: undefined,
      skip: undefined,
      selectedFields: undefined,
      selectedIncludes: [],
      includeStrategy: 'preload',
      pendingJoins: [],
      havingPredicate: undefined,
      softDelete: false,
      unscopedAll: true,
    });
  }

  /**
   * Drop the listed columns from the Model's `defaultScope` for this builder
   * only — leaves the rest of the scope (and the chain's regular `filter`)
   * intact. Compose multiple `unscope(...)` calls or pass several keys at once
   * to remove more than one. Use `unscoped()` to suppress the entire default
   * scope (and clear every other chain bit).
   */
  unscope(...keys: string[]): this {
    if (keys.length === 0) return this;
    return this.with({
      unscopedKeys: [...(this.state.unscopedKeys ?? []), ...keys],
    });
  }

  withParent(upstream: CollectionQuery | InstanceQuery, link: AssociationLink): this {
    const parentRef: ParentRef = {
      upstream: {
        state: upstream.state,
        terminalKind: 'terminalKind' in upstream ? upstream.terminalKind : undefined,
      },
      via: link,
    };
    return this.with({ parent: parentRef });
  }

  static fromModel(M: typeof import('../Model.js').ModelClass): CollectionQuery {
    const q = new CollectionQuery(M, {
      Model: M,
      filter: M.filter,
      order: [...(M.order ?? [])],
      limit: M.limit,
      skip: M.skip,
      selectedFields: M.selectedFields,
      selectedIncludes: [...(M.selectedIncludes ?? [])],
      includeStrategy: M.includeStrategy ?? 'preload',
      pendingJoins: [...(M.pendingJoins ?? [])],
      havingPredicate: M.havingPredicate,
      softDelete: M.softDelete ?? false,
    });
    attachModelExtras(q, M);
    return q;
  }

  protected async materialize(): Promise<Items> {
    if (!this.memo) {
      this.memo = this.runMaterialize();
    }
    return this.memo;
  }

  /**
   * Materialise the chained scope into hydrated Model records. Handles:
   *   - filter shape resolution (operator-form subquery builders → literals,
   *     top-level builder values → parentScopes)
   *   - soft-delete / STI implicit filters
   *   - `pendingJoins` resolution (`joins(...)` / `whereMissing(...)` →
   *     `$in` / `$notIn` filters) for connectors without `queryWithJoins`
   *   - the `queryWithJoins` fast path when the connector supports it
   *   - includes attachment (JOIN-fast-path payload OR preload fallback)
   *   - STI dispatch via `inheritColumn` → `inheritRegistry`
   *   - `afterFind` callbacks
   * Memoised — repeat `await`s on the same builder reuse the first result.
   */
  private async runMaterialize(): Promise<Items> {
    if (this.state.nullScoped) return [] as unknown as Items;
    const M = this.model as any;

    // Resolve any builder-typed filter values to literals (e.g. {id: scalarQuery})
    // before lowering — operator-form builders are eagerly awaited.
    const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
    // Run lower() so we extract parentScopes (state.parent + top-level builder
    // values embedded in the filter). Resolve them upfront into literal $in
    // filter fragments so the legacy connector path consumes only literals.
    const builderForLower =
      resolvedFilter !== this.state.filter
        ? new (this.constructor as any)(this.model, { ...this.state, filter: resolvedFilter })
        : this;
    const spec = lower(builderForLower, 'rows');
    let cleanFilter: Filter<any> | undefined = spec.filter;
    if (spec.parentScopes && spec.parentScopes.length > 0) {
      const fragmentFilter = await resolveParentScopesToFilter(M.connector, spec.parentScopes);
      cleanFilter = andMergeFilters(cleanFilter, fragmentFilter);
    }
    const stateForRead: QueryState = { ...this.state, filter: cleanFilter };

    // nullScoped already short-circuited above, so connector here is the
    // real one declared on the Model factory.
    const connector = M.connector as Connector;
    const primaryKeys = Object.keys(this.model.keys);
    const supportsJoins = typeof connector.queryWithJoins === 'function';
    const associations = (M.associations ?? {}) as Record<string, AssociationDefinition>;
    const includeNames = stateForRead.selectedIncludes ?? [];
    const wantsIncludesViaJoin =
      includeNames.length > 0 &&
      (stateForRead.includeStrategy === 'join' ||
        (stateForRead.includeStrategy === 'auto' && supportsJoins));
    if (stateForRead.includeStrategy === 'join' && includeNames.length > 0 && !supportsJoins) {
      throw new PersistenceError(
        `Model.includes(..., { strategy: 'join' }) requires a connector that implements 'queryWithJoins'. Use 'preload' or 'auto' for connectors without JOIN execution.`,
      );
    }

    const includesViaJoin: Array<{
      name: string;
      spec: AssociationDefinition;
      cardinality: 'many' | 'one';
    }> = [];
    const joinClausesForFastPath: JoinClause[] = [];
    if (supportsJoins && (stateForRead.pendingJoins.length > 0 || wantsIncludesViaJoin)) {
      joinClausesForFastPath.push(...stateForRead.pendingJoins);
      if (wantsIncludesViaJoin) {
        for (const name of includeNames) {
          const assocSpec = associations[name];
          if (!assocSpec) continue;
          if ('hasManyThrough' in assocSpec) continue;
          const resolved = resolveAssociationTarget(assocSpec as SimpleAssociationDefinition);
          includesViaJoin.push({ name, spec: assocSpec, cardinality: resolved.cardinality });
          joinClausesForFastPath.push({
            kind: 'left',
            childTableName: resolved.target.tableName,
            on: { parentColumn: resolved.parentColumn, childColumn: resolved.childColumn },
            mode: 'includes',
            attachAs: name,
            includesCardinality: resolved.cardinality,
            childPrimaryKey: Object.keys(resolved.target.keys)[0] ?? 'id',
            target: resolved.target,
          });
        }
      }
    }

    const useFastPath = supportsJoins && joinClausesForFastPath.length > 0;
    const items = useFastPath
      ? await (connector.queryWithJoins as NonNullable<Connector['queryWithJoins']>)({
          parent: builderScopeBase(M, stateForRead),
          joins: joinClausesForFastPath,
        })
      : stateForRead.selectedFields
        ? await connector.select(
            await resolvePendingJoinsToScope(M, stateForRead),
            ...Array.from(new Set([...primaryKeys, ...stateForRead.selectedFields])),
          )
        : await connector.query(await resolvePendingJoinsToScope(M, stateForRead));

    const records = items.map((item) => {
      const includesPayload = (item as Dict<any>).__includes as Dict<Dict<any>[]> | undefined;
      delete (item as Dict<any>).__includes;
      const keys: Dict<any> = {};
      for (const key of primaryKeys) {
        keys[key] = (item as Dict<any>)[key];
        delete (item as Dict<any>)[key];
      }
      let Constructor: any = M;
      if (M.inheritColumn && M.inheritRegistry) {
        const typeValue = (item as Dict<any>)[M.inheritColumn];
        const registered = typeValue != null ? M.inheritRegistry.get(typeValue) : undefined;
        if (registered) Constructor = registered;
      }
      const record = new Constructor(item, keys);
      if (includesPayload && includesViaJoin.length > 0) {
        attachIncludesPayload(record, includesViaJoin, includesPayload);
      }
      return record;
    });

    if (includeNames.length > 0 && includesViaJoin.length === 0) {
      // Includes were declared but didn't go through the JOIN fast path
      // (strategy === 'preload', or 'auto' on a connector without
      // `queryWithJoins`) — preload via the existing batched-IN path.
      await applyIncludes(records, M, includeNames);
    }

    const findCallbacks = (M.callbacks as any).afterFind as Callback<any>[] | undefined;
    if (findCallbacks) {
      for (const record of records) {
        for (const cb of findCallbacks) await cb(record);
      }
    }

    return records as unknown as Items;
  }

  /**
   * Awaitable terminal that resolves to the materialised records. Mirrors
   * Model.all() so existing chain forms — `Model.filterBy(x).all()` —
   * continue working after the static chain methods migrate to forward to
   * this builder.
   */
  all(): Promise<Items> {
    return this.materialize();
  }

  // biome-ignore lint/suspicious/noThenProperty: CollectionQuery intentionally implements PromiseLike so it composes with await + .then.
  then<R1 = Items, R2 = never>(
    onFulfilled?: ((value: Items) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.materialize().then(onFulfilled, onRejected);
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null) {
    return this.materialize().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null) {
    return this.materialize().finally(onFinally);
  }
}
