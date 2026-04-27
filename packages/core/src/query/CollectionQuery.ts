import { normalizeFilterShape } from '../FilterEngine.js';
import { PersistenceError } from '../errors.js';
import {
  type AssociationDefinition,
  type IncludeOptions,
  compileHaving,
  type HavingPredicate,
  resolveAssociationTarget,
} from '../Model.js';
import { type Filter, type JoinClause, type Order, SortDirection } from '../types.js';
import type { Dict, KeyType } from '../types.js';
import { mergeFilters, mergeOrders, type QueryState } from './QueryState.js';
import { InstanceQuery } from './InstanceQuery.js';
import { ScalarQuery } from './ScalarQuery.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
  ) {}

  protected with(patch: Partial<QueryState>): this {
    return new (this.constructor as any)(this.model, { ...this.state, ...patch });
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
          const resolved = resolveAssociationTarget(assoc);
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
      const normalized: AssociationDefinition =
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
    if ('belongsTo' in spec) {
      throw new PersistenceError(
        `CollectionQuery.whereMissing(...) only supports hasMany / hasOne associations; '${name}' is belongsTo. Use filterBy({ $null: '${spec.foreignKey}' }) instead.`,
      );
    }
    const resolved = resolveAssociationTarget(spec);
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

  static fromModel(M: typeof import('../Model.js').ModelClass): CollectionQuery {
    return new CollectionQuery(M, {
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
  }

  // STUB until Task 23 wires materialize to connector.queryScoped.
  protected materialize(): Promise<Items> {
    if (!this.memo) this.memo = Promise.resolve([] as unknown as Items);
    return this.memo;
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
