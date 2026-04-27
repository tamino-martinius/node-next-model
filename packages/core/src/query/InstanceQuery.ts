import { NotFoundError } from '../errors.js';
import type { Dict, KeyType } from '../types.js';
import type { QueryState, TerminalKind } from './QueryState.js';

export type { TerminalKind };

type ModelLike = { tableName: string; keys: Dict<KeyType>; name?: string };

export class InstanceQuery<Result = unknown> implements PromiseLike<Result> {
  protected memo: Promise<Result> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly terminalKind: TerminalKind,
    public readonly state: QueryState,
  ) {}

  // STUB until Task 24 wires materialize to connector.queryScoped.
  // Always resolves undefined → find/findOrFail terminals always throw
  // until Task 24 lands. Tests use a StubMaterialize subclass to inject
  // results; do not invoke this on a real InstanceQuery before Task 24.
  protected materialize(): Promise<Result> {
    if (!this.memo) {
      this.memo = Promise.resolve(undefined as Result).then((result) => {
        if (
          (result as unknown) === undefined &&
          (this.terminalKind === 'find' || this.terminalKind === 'findOrFail')
        ) {
          const label = this.model.name || this.model.tableName || 'Record';
          throw new NotFoundError(`${label} not found`);
        }
        return result;
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
