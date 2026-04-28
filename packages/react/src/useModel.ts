import { useMemo, useRef, useSyncExternalStore } from 'react';
import { useStore } from './Provider.js';
import { ReactiveQuery, type TerminalKind } from './ReactiveQuery.js';
import { wrapInstance } from './ReactiveInstance.js';
import { emitterFor, tagStore } from './instanceState.js';
import { useAsyncTerminal, type AsyncResult } from './useAsyncTerminal.js';

type ModelStatic<P> = {
  tableName: string;
  build(props?: Partial<P>): object;
};

const TERMINALS: Array<[string, TerminalKind]> = [
  ['all', 'all'], ['first', 'first'], ['last', 'last'],
  ['find', 'find'], ['findBy', 'findBy'], ['findOrFail', 'findOrFail'],
  ['count', 'count'], ['sum', 'sum'], ['min', 'min'], ['max', 'max'], ['avg', 'avg'],
  ['pluck', 'pluck'], ['exists', 'exists'],
];

const CHAIN_METHODS = [
  'filterBy', 'where', 'orderBy', 'limit', 'skip',
  'joins', 'includes', 'withoutIncludes', 'whereMissing', 'none',
];

class HookQuery<M extends { tableName: string }> extends ReactiveQuery<M> {
  constructor(plan: ConstructorParameters<typeof ReactiveQuery>[0]) { super(plan); }
}

function attachTerminals(query: HookQuery<{ tableName: string }>) {
  for (const [name, kind] of TERMINALS) {
    Object.defineProperty(query, name, {
      configurable: true,
      value: (...args: unknown[]) => useAsyncTerminal(query, kind, args),
    });
  }
}

function attachChain(query: HookQuery<{ tableName: string }>) {
  for (const m of CHAIN_METHODS) {
    const original = (query as any)[m].bind(query);
    Object.defineProperty(query, m, {
      configurable: true,
      value: (...args: unknown[]) => {
        const next = original(...args) as ReactiveQuery<{ tableName: string }>;
        // Re-cast as HookQuery and attach the surface so chained calls keep terminals
        Object.setPrototypeOf(next, HookQuery.prototype);
        attachTerminals(next as HookQuery<{ tableName: string }>);
        attachChain(next as HookQuery<{ tableName: string }>);
        return next;
      },
    });
  }
}

export function useModel<P, M extends ModelStatic<P>>(ModelClass: M) {
  const store = useStore();
  const query = useMemo(() => new HookQuery<M>({ ModelClass, steps: [] }), [ModelClass]);
  const buildShellRef = useRef<{ instance: object; shell: object } | null>(null);

  Object.defineProperty(query, 'build', {
    configurable: true,
    value: (props?: Partial<P>) => {
      if (!buildShellRef.current) {
        const instance = (ModelClass as ModelStatic<P>).build(props);
        tagStore(instance, store);
        const shell = wrapInstance(instance, { resettable: true });
        buildShellRef.current = { instance, shell };
      }
      const { instance, shell } = buildShellRef.current;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useSyncExternalStore(
        (cb) => emitterFor(instance).subscribe(cb),
        () => emitterFor(instance),
        () => emitterFor(instance),
      );
      return shell;
    },
  });

  attachTerminals(query);
  attachChain(query);

  return query as HookQuery<M> & {
    build(props?: Partial<P>): unknown;
    all(): AsyncResult<unknown[]>;
    find(pk: unknown): AsyncResult<unknown>;
    findBy(filter: unknown): AsyncResult<unknown>;
    findOrFail(pk: unknown): AsyncResult<unknown>;
    first(): AsyncResult<unknown>;
    last(): AsyncResult<unknown>;
    count(): AsyncResult<number>;
    sum(col: string): AsyncResult<number | undefined>;
    min(col: string): AsyncResult<number | undefined>;
    max(col: string): AsyncResult<number | undefined>;
    avg(col: string): AsyncResult<number | undefined>;
    pluck(col: string): AsyncResult<unknown[]>;
    exists(): AsyncResult<boolean>;
  };
}
