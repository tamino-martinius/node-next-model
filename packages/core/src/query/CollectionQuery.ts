import { normalizeFilterShape } from '../FilterEngine.js';
import { PersistenceError } from '../errors.js';
import {
  type AssociationDefinition,
  type SimpleAssociationDefinition,
  type IncludeOptions,
  compileHaving,
  type HavingPredicate,
  NullConnector,
  resolveAssociationTarget,
} from '../Model.js';
import { type AssociationLink, type Filter, type JoinClause, type Order, SortDirection } from '../types.js';
import type { Dict, KeyType } from '../types.js';
import { mergeFilters, mergeOrders, type ParentRef, type QueryState } from './QueryState.js';
import { InstanceQuery } from './InstanceQuery.js';
import { ScalarQuery } from './ScalarQuery.js';
import { ColumnQuery } from './ColumnQuery.js';
import { lower, resolveSubqueryFilters } from './lower.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

// Build a temp Model subclass carrying QueryState fields as static properties
// so Model.all()'s `this.<x>` reads see the chained scope. The `connector`
// option lets `none()` keep working: `state.nullScoped` is reflected as a
// short-circuiting connector (the materialize path handles nullScoped first,
// but we mirror it here for completeness when callers reach into the
// scoped subclass directly).
function makeScopedSubclass(M: any, state: QueryState): any {
  // The static state.nullScoped flag means this scope must short-circuit
  // every connector call to an empty result. NullConnector returns empty
  // arrays / 0 from every CRUD entry point.
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

// Resolve subquery parentScopes (CollectionQuery / InstanceQuery values
// embedded as top-level filter values) into a single $in / $and filter
// fragment that the legacy Model.all() path can consume. Mirrors the
// nested loop in baseQueryScoped that walks parentScopes outermost-first.
async function resolveParentScopesToFilter(
  connector: any,
  parentScopes: NonNullable<ReturnType<typeof lower>['parentScopes']>,
): Promise<Filter<any>> {
  const fragments: Filter<any>[] = [];
  let prevValues: unknown[] | undefined;
  let prevChildColumn: string | undefined;
  for (const parent of parentScopes) {
    let augmented: Filter<any> | undefined = parent.parentFilter;
    if (prevValues !== undefined && prevChildColumn !== undefined) {
      const inFilter: Filter<any> = { $in: { [prevChildColumn]: prevValues } } as Filter<any>;
      augmented = mergeFilters(augmented, inFilter);
    }
    const rows = await connector.select(
      {
        tableName: parent.parentTable,
        filter: augmented,
        order: parent.parentOrder,
        limit: parent.parentLimit,
      },
      parent.link.parentColumn,
    );
    const seen = new Set<unknown>();
    const values: unknown[] = [];
    for (const row of rows) {
      const v = (row as Dict<any>)[parent.link.parentColumn];
      if (v == null || seen.has(v)) continue;
      seen.add(v);
      values.push(v);
    }
    if (values.length === 0) {
      // Empty intermediate → final result is empty. Encode that by returning
      // a $in: [] filter so the outer query short-circuits to no matches.
      fragments.push({ $in: { [parent.link.childColumn]: [] } } as Filter<any>);
      prevValues = undefined;
      prevChildColumn = undefined;
      continue;
    }
    prevValues = values;
    prevChildColumn = parent.link.childColumn;
  }
  if (prevValues !== undefined && prevChildColumn !== undefined) {
    fragments.push({ $in: { [prevChildColumn]: prevValues } } as Filter<any>);
  }
  return fragments.length === 1 ? fragments[0]! : ({ $and: fragments } as Filter<any>);
}

function mergeFiltersForLegacy(
  current: Filter<any> | undefined,
  next: Filter<any>,
): Filter<any> {
  if (!current) return next;
  return { $and: [current, next] } as Filter<any>;
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
  'modelScope',
  'modelScopeBase',
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
 * Attach Model-class extras (named scopes, enum scopes, factory-time
 * scopes, find/findBy/find/findOrFail/all/first/last shapes) onto a
 * CollectionQuery instance so existing chain forms keep dispatching to
 * the legacy Model machinery on a state-projected subclass. Idempotent —
 * skips entries already defined on the prototype.
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

  // Backward-compat getters: legacy chain methods produced Model subclasses
  // that exposed `static filter`, `static order` etc. After migration the
  // chain methods return a CollectionQuery whose state lives in `.state`,
  // but plenty of existing call sites (and tests) read these as direct
  // properties. Surface them as read-only getters that defer to state.
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
      throw new PersistenceError(`CollectionQuery.joins(...) requires at least one association name.`);
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

  unfiltered(): this { return this.with({ filter: undefined }); }

  orderBy(order: Order<any>): this {
    const next = Array.isArray(order) ? order : [order];
    return this.with({ order: mergeOrders(this.state.order, next) });
  }

  reorder(order: Order<any>): this {
    return this.with({ order: Array.isArray(order) ? [...order] : [order] });
  }

  unordered(): this { return this.with({ order: [] }); }

  reverse(): this {
    const pk = Object.keys(this.model.keys)[0] ?? 'id';
    const existing = this.state.order.length > 0 ? this.state.order : [{ key: pk } as any];
    const flipped = existing.map((c) => ({
      key: c.key,
      dir: (c.dir ?? SortDirection.Asc) === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc,
    }));
    return this.with({ order: flipped });
  }

  limitBy(n: number): this { return this.with({ limit: n }); }
  unlimited(): this { return this.with({ limit: undefined }); }
  skipBy(n: number): this { return this.with({ skip: n }); }
  unskipped(): this { return this.with({ skip: undefined }); }

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
    return new ScalarQuery<number>(this.model, this.state, { kind: 'aggregate', op: 'sum', column });
  }

  average(column: string): ScalarQuery<number> {
    return new ScalarQuery<number>(this.model, this.state, { kind: 'aggregate', op: 'avg', column });
  }

  minimum<T = unknown>(column: string): ScalarQuery<T | undefined> {
    return new ScalarQuery<T | undefined>(this.model, this.state, { kind: 'aggregate', op: 'min', column });
  }

  maximum<T = unknown>(column: string): ScalarQuery<T | undefined> {
    return new ScalarQuery<T | undefined>(this.model, this.state, { kind: 'aggregate', op: 'max', column });
  }

  pluck(column: string, ...moreColumns: string[]): ColumnQuery<unknown[]> | Promise<unknown[]> {
    if (moreColumns.length > 0) {
      // Multi-column pluck → tuples; defer to legacy via temp subclass.
      return this.toScopedSubclass().pluck(column, ...moreColumns) as Promise<unknown[]>;
    }
    return new ColumnQuery<unknown[]>(this.model, column, this.state, { kind: 'column', column });
  }

  // Legacy parity methods — these are mutations / iterators / batch
  // primitives that historically lived on the Model subclass produced by
  // the chain methods. Forward to a state-projected temp subclass that
  // calls the legacy Model.<method>(...) (which reads `this.<x>` static
  // properties).
  pluckUnique(key: string): Promise<unknown[]> {
    return this.toScopedSubclass().pluckUnique(key);
  }
  ids(): Promise<unknown[]> {
    return this.toScopedSubclass().ids();
  }
  countBy(key: string): Promise<Map<any, number>> {
    return this.toScopedSubclass().countBy(key);
  }
  exists(filter?: Filter<any>): Promise<boolean> {
    return this.toScopedSubclass().exists(filter);
  }
  groupBy(key: string): Promise<Map<any, unknown[]>> {
    return this.toScopedSubclass().groupBy(key);
  }
  updateAll(attrs: Dict<any>): Promise<unknown[]> {
    return this.toScopedSubclass().updateAll(attrs);
  }
  deleteAll(): Promise<unknown[]> {
    return this.toScopedSubclass().deleteAll();
  }
  destroyAll(): Promise<unknown[]> {
    return this.toScopedSubclass().destroyAll();
  }
  increment(column: string, by = 1): Promise<number> {
    return this.toScopedSubclass().increment(column, by);
  }
  decrement(column: string, by = 1): Promise<number> {
    return this.toScopedSubclass().decrement(column, by);
  }
  paginate(page: number, perPage = 25) {
    return this.toScopedSubclass().paginate(page, perPage);
  }
  paginateCursor(options?: { after?: string; before?: string; limit?: number }) {
    return this.toScopedSubclass().paginateCursor(options);
  }
  inBatchesOf(size: number) {
    return this.toScopedSubclass().inBatchesOf(size);
  }
  findEach(size?: number) {
    return this.toScopedSubclass().findEach(size);
  }
  select(...keys: any[]) {
    return this.toScopedSubclass().select(...keys);
  }

  /**
   * Project this CollectionQuery's state onto a temp Model subclass so
   * legacy Model statics can be called against the chained scope. Used by
   * mutation / batch / pagination methods that aren't yet ported to the
   * builder pipeline.
   */
  protected toScopedSubclass(): any {
    return makeScopedSubclass(this.model as any, this.state);
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
   * Materialise via a state-projected temp subclass that delegates to the
   * Model's legacy `all()`. This preserves afterFind callbacks, includes
   * preload/join, STI dispatch via inheritColumn → inheritRegistry, and the
   * `queryWithJoins` fast path on connectors that implement it. Used when
   * the CollectionQuery is awaited directly (e.g. `await Model.filterBy(x)`),
   * via `await Model.filterBy(x).all()`, and via `Model.first()`/etc which
   * route through the same chain.
   */
  private async runMaterialize(): Promise<Items> {
    if (this.state.nullScoped) return [] as unknown as Items;
    const M = this.model as any;
    // Resolve any builder-typed filter values to literals (e.g. {id: scalarQuery})
    // BEFORE we hand off to Model.all(); the legacy connector path doesn't know
    // how to resolve subquery builders embedded in filters.
    const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
    // Always run lower() so we extract parentScopes (from state.parent and
    // from top-level builder values embedded in the filter). The legacy
    // Model.all() path doesn't understand parentScopes — we resolve them
    // upfront here into literal $in filter fragments.
    const builderForLower =
      resolvedFilter !== this.state.filter
        ? new (this.constructor as any)(this.model, { ...this.state, filter: resolvedFilter })
        : this;
    const spec = lower(builderForLower, 'rows');
    let cleanFilter: Filter<any> | undefined = spec.filter;
    if (spec.parentScopes && spec.parentScopes.length > 0) {
      const fragmentFilter = await resolveParentScopesToFilter(M.connector, spec.parentScopes);
      cleanFilter = mergeFiltersForLegacy(cleanFilter, fragmentFilter);
    }
    // Build a temp subclass that carries this CollectionQuery's state as
    // static properties — Model.runQueryRecords() reads from `this.<x>` so
    // the projection makes the legacy machinery operate on our scope.
    const Temp = makeScopedSubclass(M, { ...this.state, filter: cleanFilter });
    return (await Temp.runQueryRecords()) as unknown as Items;
  }

  // Lightweight row → record hydrate used by tests that bypass the
  // delegated Model.runQueryRecords() path. The production materialize
  // always goes through runQueryRecords, which handles afterFind callbacks,
  // includes attach/preload, STI dispatch, and the `queryWithJoins` fast path.
  protected hydrate(rows: Dict<any>[]): unknown[] {
    const M = this.model as any;
    return rows.map((row) => {
      const keys: Dict<any> = {};
      const data: Dict<any> = { ...row };
      for (const k in M.keys) {
        keys[k] = data[k];
        delete data[k];
      }
      return new M(data, keys);
    });
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
