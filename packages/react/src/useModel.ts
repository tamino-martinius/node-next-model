import { useMemo, useRef, useSyncExternalStore } from 'react';
import { decorate } from './adoptInstance.js';
import { emitterFor, tagStore } from './instanceState.js';
import { useStore } from './Provider.js';
import { wrapInstance } from './ReactiveInstance.js';
import {
  type ModelCreatePropsType,
  type ModelInstanceType,
  type ReactiveModelQuery,
  ReactiveQuery,
  type TerminalKind,
} from './ReactiveQuery.js';
import type { Store } from './Store.js';
import { runQuery } from './runQuery.js';
import { useAsyncTerminal } from './useAsyncTerminal.js';
import { useWatch } from './useWatch.js';

const PENDING_TERMINALS: Array<[string, TerminalKind]> = [
  ['all', 'all'],
  ['first', 'first'],
  ['last', 'last'],
  ['find', 'find'],
  ['findBy', 'findBy'],
  ['findOrFail', 'findOrFail'],
  ['count', 'count'],
  ['sum', 'sum'],
  ['min', 'min'],
  ['max', 'max'],
  ['avg', 'avg'],
  ['pluck', 'pluck'],
  ['exists', 'exists'],
];

const CHAIN_METHODS = [
  'filterBy',
  'where',
  'orderBy',
  'limit',
  'skip',
  'joins',
  'includes',
  'withoutIncludes',
  'whereMissing',
  'none',
];

class HookQuery<M extends { tableName: string }> extends ReactiveQuery<M> {}

/**
 * Attaches `.fetch()`, `.watch()`, and `.run()` to a query.
 * Uses the plan's `terminal`/`terminalArgs` if set, defaulting to `'all'`.
 *
 * `.run()` captures the store from the enclosing `useModel(M)` call so
 * the returned promise can be awaited in async event handlers without
 * any hook-rules issues; the resolved instances are store-tagged shells.
 */
function attachFetchAndWatch(query: HookQuery<{ tableName: string }>, store: Store) {
  Object.defineProperty(query, 'fetch', {
    configurable: true,
    value: () => {
      const terminal = query.plan.terminal ?? 'all';
      const terminalArgs = query.plan.terminalArgs ?? [];
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAsyncTerminal(query, terminal, terminalArgs);
    },
  });
  Object.defineProperty(query, 'watch', {
    configurable: true,
    value: (options: { keys?: (string | symbol)[] } = {}) => {
      const terminal = query.plan.terminal ?? 'all';
      const terminalArgs = query.plan.terminalArgs ?? [];
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useWatch(query, terminal, terminalArgs, options);
    },
  });
  Object.defineProperty(query, 'run', {
    configurable: true,
    value: async () => {
      const terminal = query.plan.terminal ?? 'all';
      const terminalArgs = query.plan.terminalArgs ?? [];
      const raw = await runQuery(query, terminal, terminalArgs);
      return decorate(raw, query.plan.ModelClass.tableName, store);
    },
  });
}

/**
 * Attaches terminal chain methods (all, find, findBy, etc.) to a query.
 * Each terminal method returns a NEW HookQuery with the terminal recorded in the plan,
 * and with `.fetch()` / `.watch()` attached — no hook is invoked yet.
 */
function attachPendingTerminals(query: HookQuery<{ tableName: string }>, store: Store) {
  for (const [name, kind] of PENDING_TERMINALS) {
    Object.defineProperty(query, name, {
      configurable: true,
      value: (...args: unknown[]) => {
        const next = new HookQuery<{ tableName: string }>({
          ModelClass: query.plan.ModelClass,
          steps: query.plan.steps,
          terminal: kind,
          terminalArgs: args,
        });
        attachFetchAndWatch(next, store);
        return next;
      },
    });
  }
}

/**
 * Attaches chain methods (filterBy, where, etc.) to a query.
 * Each chain method returns a new query with the full surface re-attached.
 */
function attachChain(query: HookQuery<{ tableName: string }>, store: Store) {
  for (const m of CHAIN_METHODS) {
    const original = (query as any)[m].bind(query);
    Object.defineProperty(query, m, {
      configurable: true,
      value: (...args: unknown[]) => {
        const next = original(...args) as HookQuery<{ tableName: string }>;
        Object.setPrototypeOf(next, HookQuery.prototype);
        attachPendingTerminals(next, store);
        attachChain(next, store);
        attachFetchAndWatch(next, store);
        return next;
      },
    });
  }
}

export function useModel<M extends { tableName: string; build: (props?: any) => any }>(
  ModelClass: M,
): ReactiveModelQuery<ModelInstanceType<M>, ModelCreatePropsType<M>> {
  const store = useStore();
  const query = useMemo(() => new HookQuery<M>({ ModelClass, steps: [] }), [ModelClass]);
  const buildShellRef = useRef<{ instance: object; shell: object } | null>(null);

  Object.defineProperty(query, 'build', {
    configurable: true,
    value: (props?: ModelCreatePropsType<M>) => {
      if (!buildShellRef.current) {
        const instance = (ModelClass as { build: (props?: any) => object }).build(props);
        tagStore(instance, store);
        const shell = wrapInstance(instance, { resettable: true });
        buildShellRef.current = { instance, shell };
      }
      const { instance, shell } = buildShellRef.current;
      // biome-ignore lint/correctness/useHookAtTopLevel: .build() runs inside render; hook order is stable per component
      useSyncExternalStore(
        (cb) => emitterFor(instance).subscribe(cb),
        () => emitterFor(instance).getVersion(),
        () => emitterFor(instance).getVersion(),
      );
      return shell;
    },
  });

  attachPendingTerminals(query, store);
  attachChain(query, store);
  attachFetchAndWatch(query, store);

  return query as unknown as ReactiveModelQuery<ModelInstanceType<M>, ModelCreatePropsType<M>>;
}
