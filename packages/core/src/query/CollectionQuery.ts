import type { Dict, KeyType } from '../types.js';
import type { QueryState } from './QueryState.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
  ) {}

  static fromModel(M: typeof import('../Model.js').ModelClass): CollectionQuery {
    return new CollectionQuery(M, {
      Model: M,
      filter: M.filter,
      order: [...M.order],
      limit: M.limit,
      skip: M.skip,
      selectedFields: M.selectedFields,
      selectedIncludes: [...M.selectedIncludes],
      includeStrategy: M.includeStrategy,
      pendingJoins: [...M.pendingJoins],
      havingPredicate: M.havingPredicate,
      softDelete: M.softDelete,
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
