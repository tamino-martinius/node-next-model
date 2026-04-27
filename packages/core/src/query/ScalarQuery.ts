import type { Dict, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';
import { lower } from './lower.js';
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
        if (this.state.nullScoped) {
          return this.isCountAggregate() ? (0 as T) : (undefined as T);
        }
        const spec = lower(this, this.projection);
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

  private isCountAggregate(): boolean {
    return (
      typeof this.projection === 'object' &&
      this.projection.kind === 'aggregate' &&
      this.projection.op === 'count'
    );
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
