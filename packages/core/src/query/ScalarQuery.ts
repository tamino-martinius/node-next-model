import type { Dict, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import { PersistenceError } from '../errors.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ScalarQuery<T = unknown> implements PromiseLike<T> {
  protected memo: Promise<T> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
    public readonly projection: Projection,
  ) {}

  protected async materialize(): Promise<T> {
    if (!this.memo) {
      this.memo = (async () => {
        if (this.state.nullScoped) return this.emptyResult();
        const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
        const builderForLower =
          resolvedFilter !== this.state.filter
            ? new (this.constructor as any)(this.model, { ...this.state, filter: resolvedFilter }, this.projection)
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
        // For column projection on an InstanceQuery (limit 1 path), result is array; take [0]
        if (typeof this.projection === 'object' && this.projection.kind === 'column') {
          return ((result as unknown[])[0] as T) ?? (undefined as T);
        }
        return result as T;
      })();
    }
    return this.memo;
  }

  // Empty-set semantics for the nullScoped short-circuit:
  //   count → 0,  sum → 0,  avg/min/max → undefined,  column → undefined.
  private emptyResult(): T {
    if (typeof this.projection === 'object' && this.projection.kind === 'aggregate') {
      const { op } = this.projection;
      if (op === 'count' || op === 'sum') return 0 as T;
    }
    return undefined as T;
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
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
