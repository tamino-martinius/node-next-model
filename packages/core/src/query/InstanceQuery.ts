import { NotFoundError } from '../errors.js';
import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType>; name?: string };

export type TerminalKind = 'first' | 'last' | 'findBy' | 'find' | 'findOrFail';

export class InstanceQuery<Result = unknown> implements PromiseLike<Result> {
  protected memo: Promise<Result> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly terminalKind: TerminalKind,
    private readonly execute: () => Promise<Result | undefined>,
  ) {}

  protected materialize(): Promise<Result> {
    if (!this.memo) {
      this.memo = this.execute().then((result) => {
        if (result === undefined && (this.terminalKind === 'find' || this.terminalKind === 'findOrFail')) {
          const label = this.model.name || this.model.tableName || 'Record';
          throw new NotFoundError(`${label} not found`);
        }
        return result as Result;
      });
    }
    return this.memo;
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
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
