import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ColumnQuery<Shape = unknown> implements PromiseLike<Shape> {
  protected memo: Promise<Shape> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly column: string,
    private readonly execute: () => Promise<Shape>,
  ) {}

  protected materialize() {
    if (!this.memo) this.memo = this.execute();
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
