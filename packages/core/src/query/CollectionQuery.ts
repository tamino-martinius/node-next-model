import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;

  constructor(
    public readonly model: ModelLike,
    private readonly execute: () => Promise<Items>,
  ) {}

  protected materialize(): Promise<Items> {
    if (!this.memo) this.memo = this.execute();
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
