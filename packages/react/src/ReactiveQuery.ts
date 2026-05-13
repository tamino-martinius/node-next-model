import type { Dict } from '@next-model/core';
import type { AsyncResult } from './useAsyncTerminal.js';
import type { WatchResult } from './useWatch.js';

export type TerminalKind =
  | 'build'
  | 'find'
  | 'findBy'
  | 'findOrFail'
  | 'first'
  | 'last'
  | 'all'
  | 'count'
  | 'sum'
  | 'min'
  | 'max'
  | 'avg'
  | 'pluck'
  | 'exists';

interface ChainStep {
  method: string;
  args: unknown[];
}

export interface QueryPlan {
  ModelClass: { tableName: string };
  steps: ChainStep[];
  terminal?: TerminalKind;
  terminalArgs?: unknown[];
}

/**
 * A pending query that has not yet invoked a React hook.
 * Call `.fetch()` for a one-shot async result or `.watch()` for a live subscription.
 */
export interface PendingResult<T> {
  fetch(): AsyncResult<T>;
  watch(options?: { keys?: (string | symbol)[] }): WatchResult<T>;
}

/**
 * Extract the instance type from a Model class.
 * Uses `ReturnType<M['build']>` which is typed as
 * `InstanceType<M> & PersistentProps & Readonly<keyMap>` by core.
 */
export type ModelInstanceType<M extends { build: (props?: any) => any }> = ReturnType<M['build']>;

/**
 * Extract the create-props type from a Model class.
 */
export type ModelCreatePropsType<M> = M extends { build(props: infer P): any } ? P : never;

/**
 * The full reactive query surface returned by `useModel(ModelClass)`.
 *
 * Chain methods return the same builder, preserving the surface.
 * Terminal chain methods (`all`, `find`, etc.) return a `PendingResult<T>` — no hook is
 * invoked yet. Call `.fetch()` or `.watch()` on the result to invoke a hook.
 *
 * Shortcut: `.fetch()` and `.watch()` on the root query default to `'all'`.
 */
export interface ReactiveModelQuery<I, P> {
  // chain methods
  filterBy(filter: Partial<P> | object): ReactiveModelQuery<I, P>;
  where(...args: unknown[]): ReactiveModelQuery<I, P>;
  orderBy(...args: unknown[]): ReactiveModelQuery<I, P>;
  limit(n: number): ReactiveModelQuery<I, P>;
  skip(n: number): ReactiveModelQuery<I, P>;
  joins(...names: string[]): ReactiveModelQuery<I, P>;
  includes(...args: unknown[]): ReactiveModelQuery<I, P>;
  withoutIncludes(): ReactiveModelQuery<I, P>;
  whereMissing(name: string): ReactiveModelQuery<I, P>;
  none(): ReactiveModelQuery<I, P>;

  // sync terminal — stable shell with .reset(props?)
  build(props?: Partial<P>): I & { reset(props?: Partial<P>): void };

  // chain terminals (record terminal in plan, return Pending — no hooks)
  all(): PendingResult<I[]>;
  find(pk: string | number): PendingResult<I | undefined>;
  findBy(filter: Partial<P> | object): PendingResult<I | undefined>;
  first(): PendingResult<I | undefined>;
  last(): PendingResult<I | undefined>;
  findOrFail(pk: string | number): PendingResult<I>;
  count(): PendingResult<number>;
  sum(col: string): PendingResult<number | undefined>;
  min(col: string): PendingResult<number | undefined>;
  max(col: string): PendingResult<number | undefined>;
  avg(col: string): PendingResult<number | undefined>;
  pluck(col: string): PendingResult<unknown[]>;
  exists(): PendingResult<boolean>;

  // shortcut: implicit-all .fetch() / .watch()
  fetch(): AsyncResult<I[]>;
  watch(options?: { keys?: (string | symbol)[] }): WatchResult<I[]>;
}

export class ReactiveQuery<M extends { tableName: string }> {
  constructor(public readonly plan: QueryPlan) {}

  static fromModel<M extends { tableName: string }>(ModelClass: M): ReactiveQuery<M> {
    return new ReactiveQuery<M>({ ModelClass, steps: [] });
  }

  private chain(method: string, args: unknown[]): ReactiveQuery<M> {
    return new ReactiveQuery<M>({
      ModelClass: this.plan.ModelClass,
      steps: [...this.plan.steps, { method, args }],
    });
  }

  filterBy(filter: Dict<unknown>): ReactiveQuery<M> {
    return this.chain('filterBy', [filter]);
  }
  where(...a: unknown[]): ReactiveQuery<M> {
    return this.chain('where', a);
  }
  orderBy(...a: unknown[]): ReactiveQuery<M> {
    return this.chain('orderBy', a);
  }
  limit(n: number): ReactiveQuery<M> {
    return this.chain('limit', [n]);
  }
  skip(n: number): ReactiveQuery<M> {
    return this.chain('skip', [n]);
  }
  joins(...names: string[]): ReactiveQuery<M> {
    return this.chain('joins', names);
  }
  includes(...args: unknown[]): ReactiveQuery<M> {
    return this.chain('includes', args);
  }
  withoutIncludes(): ReactiveQuery<M> {
    return this.chain('withoutIncludes', []);
  }
  whereMissing(name: string): ReactiveQuery<M> {
    return this.chain('whereMissing', [name]);
  }
  none(): ReactiveQuery<M> {
    return this.chain('none', []);
  }

  hash(
    terminal: TerminalKind,
    terminalArgs: unknown[] = [],
    options: { watchKeys?: (string | symbol)[] } = {},
  ): string {
    return JSON.stringify({
      table: this.plan.ModelClass.tableName,
      steps: this.plan.steps.map((s) => [s.method, s.args]),
      terminal,
      terminalArgs,
      watchKeys: options.watchKeys?.map((k) =>
        typeof k === 'symbol' ? `sym:${k.description ?? ''}@${k.toString()}` : k,
      ),
    });
  }
}
