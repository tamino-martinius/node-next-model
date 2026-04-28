import type { Dict } from '@next-model/core';

export type TerminalKind =
  | 'build'
  | 'find' | 'findBy' | 'findOrFail' | 'first' | 'last'
  | 'all'
  | 'count' | 'sum' | 'min' | 'max' | 'avg'
  | 'pluck' | 'exists';

interface ChainStep { method: string; args: unknown[] }

export interface QueryPlan {
  ModelClass: { tableName: string };
  steps: ChainStep[];
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

  filterBy(filter: Dict<unknown>): ReactiveQuery<M> { return this.chain('filterBy', [filter]); }
  where(...a: unknown[]): ReactiveQuery<M> { return this.chain('where', a); }
  orderBy(...a: unknown[]): ReactiveQuery<M> { return this.chain('orderBy', a); }
  limit(n: number): ReactiveQuery<M> { return this.chain('limit', [n]); }
  skip(n: number): ReactiveQuery<M> { return this.chain('skip', [n]); }
  joins(...names: string[]): ReactiveQuery<M> { return this.chain('joins', names); }
  includes(...args: unknown[]): ReactiveQuery<M> { return this.chain('includes', args); }
  withoutIncludes(): ReactiveQuery<M> { return this.chain('withoutIncludes', []); }
  whereMissing(name: string): ReactiveQuery<M> { return this.chain('whereMissing', [name]); }
  none(): ReactiveQuery<M> { return this.chain('none', []); }

  hash(terminal: TerminalKind, terminalArgs: unknown[] = [], options: { watchKeys?: (string | symbol)[] } = {}): string {
    return JSON.stringify({
      table: this.plan.ModelClass.tableName,
      steps: this.plan.steps.map((s) => [s.method, s.args]),
      terminal,
      terminalArgs,
      watchKeys: options.watchKeys?.map((k) =>
        typeof k === 'symbol'
          ? `sym:${k.description ?? ''}@${k.toString()}`
          : k,
      ),
    });
  }
}
