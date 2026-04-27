import { normalizeFilterShape } from '../FilterEngine.js';
import { type Filter, type Order, SortDirection } from '../types.js';
import type { Dict, KeyType } from '../types.js';
import { mergeFilters, mergeOrders, type QueryState } from './QueryState.js';

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
    const f = normalizeFilterShape(input);
    return this.with({ filter: mergeFilters(this.state.filter, f) });
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
