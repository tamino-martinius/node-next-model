import type { Dict, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import { PersistenceError } from '../errors.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ColumnQuery<Shape = unknown> implements PromiseLike<Shape> {
  protected memo: Promise<Shape> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly column: string,
    public readonly state: QueryState,
    public readonly projection: Projection,
  ) {}

  protected async materialize(): Promise<Shape> {
    if (!this.memo) {
      this.memo = (async () => {
        if (this.state.nullScoped) return [] as unknown as Shape;
        const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
        const builderForLower =
          resolvedFilter !== this.state.filter
            ? new (this.constructor as any)(
                this.model,
                this.column,
                { ...this.state, filter: resolvedFilter },
                this.projection,
              )
            : this;
        const spec = lower(builderForLower, this.projection);
        const M = this.model as any;
        const connector = M.connector;
        if (!connector || typeof connector.queryScoped !== 'function') {
          throw new PersistenceError(
            `${M.name || M.tableName || 'Model'}.connector does not implement queryScoped(spec).`,
          );
        }
        const result = await connector.queryScoped(spec);
        return result as Shape;
      })();
    }
    return this.memo;
  }

  then<R1 = Shape, R2 = never>(
    onFulfilled?: ((value: Shape) => R1 | PromiseLike<R1>) | null,
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
