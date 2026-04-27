import type { Dict, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ScalarQuery<T = unknown> implements PromiseLike<T> {
  protected memo: Promise<T> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
    public readonly projection: Projection,
  ) {}

  // STUB until Task 25 wires materialize to connector.queryScoped.
  protected materialize(): Promise<T> {
    if (!this.memo) {
      const result = this.isCountAggregate() ? (0 as T) : (undefined as T);
      this.memo = Promise.resolve(result);
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
