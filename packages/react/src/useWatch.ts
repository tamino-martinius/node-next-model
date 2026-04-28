import type { Dict } from '@next-model/core';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './Provider.js';
import { tagStore } from './instanceState.js';
import { wrapInstance } from './ReactiveInstance.js';
import type { ReactiveQuery, TerminalKind } from './ReactiveQuery.js';
import { rowKey } from './pkKey.js';
import { runQuery } from './runQuery.js';
import type { Store } from './Store.js';

export interface WatchResult<T> {
  data: T;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | undefined;
}

const COLLECTION_TERMINALS = new Set<TerminalKind>(['all']);

interface HeldRow { tableName: string; keys: Dict<unknown> }

function tableNameOf(query: ReactiveQuery<{ tableName: string }>): string {
  return query.plan.ModelClass.tableName;
}

function keysOf(instance: object): Dict<unknown> {
  return ((instance as { keys?: Dict<unknown> }).keys) ?? {};
}

function isModelInstance(x: unknown): x is object {
  return Boolean(x && typeof x === 'object' && 'attributes' in (x as object));
}

function adopt(instance: object, tableName: string, store: Store): object {
  tagStore(instance, store);
  const shell = wrapInstance(instance);
  const keys = keysOf(instance);
  if (Object.keys(keys).length === 0) return shell;   // unsaved — should not happen for watch results
  const cached = store.acquire(tableName, keys);
  if (cached) return cached;
  store.softRegister(tableName, keys, shell);
  return shell;
}

function decorate(raw: unknown, tableName: string, store: Store): unknown {
  if (Array.isArray(raw)) {
    const out: object[] = [];
    for (const row of raw) {
      if (isModelInstance(row)) out.push(adopt(row, tableName, store));
    }
    return out;
  }
  if (isModelInstance(raw)) return adopt(raw, tableName, store);
  return raw;
}

export function useWatch<T>(
  query: ReactiveQuery<{ tableName: string }>,
  terminal: TerminalKind,
  terminalArgs: unknown[],
  options: { keys?: (string | symbol)[] } = {},
): WatchResult<T> {
  const store = useStore();
  const tableName = tableNameOf(query);
  const queryKey = query.hash(terminal, terminalArgs, { watchKeys: options.keys });

  const [state, setState] = useState<WatchResult<T>>(() => ({
    data: (COLLECTION_TERMINALS.has(terminal) ? [] : undefined) as T,
    isLoading: true,
    isRefetching: false,
    error: undefined,
  }));

  const inflightRef = useRef(0);
  const hasFetchedRef = useRef(false);
  const heldRowsRef = useRef<HeldRow[]>([]);
  const rowSubsRef = useRef<Array<() => void>>([]);

  const releaseAll = () => {
    for (const h of heldRowsRef.current) store.release(h.tableName, h.keys);
    heldRowsRef.current = [];
    for (const off of rowSubsRef.current) off();
    rowSubsRef.current = [];
  };

  const bindRows = (decorated: unknown) => {
    releaseAll();
    const rows: object[] = Array.isArray(decorated)
      ? (decorated as object[])
      : decorated && isModelInstance(decorated) ? [decorated as object] : [];
    for (const row of rows) {
      const keys = keysOf(row);
      if (Object.keys(keys).length === 0) continue;
      store.retain(tableName, keys);
      const handler = () => {
        setState((s) => {
          const stillAlive = !!store.acquire(tableName, keys);
          if (Array.isArray(s.data)) {
            if (stillAlive) {
              // shallow rerender — row's attributes already updated through the shell
              return { ...s };
            }
            return { ...s, data: (s.data as object[]).filter((r) => r !== row) as typeof s.data };
          }
          // single-instance branch
          if (!stillAlive) return { ...s, data: undefined as typeof s.data };
          return { ...s };
        });
      };
      const off = store.subscribe(rowKey(tableName, keys), handler);
      heldRowsRef.current.push({ tableName, keys });
      rowSubsRef.current.push(off);
    }
  };

  const fetch = (mode: 'initial' | 'refetch') => {
    const id = ++inflightRef.current;
    setState((s) => ({
      data: s.data,
      isLoading: mode === 'initial' && !hasFetchedRef.current,
      isRefetching: mode === 'refetch',
      error: undefined,
    }));
    runQuery(query, terminal, terminalArgs).then(
      (raw) => {
        if (inflightRef.current !== id) return;
        hasFetchedRef.current = true;
        const decorated = decorate(raw, tableName, store);
        bindRows(decorated);
        setState({ data: decorated as T, isLoading: false, isRefetching: false, error: undefined });
      },
      (error: unknown) => {
        if (inflightRef.current !== id) return;
        hasFetchedRef.current = true;
        setState((s) => ({ ...s, isLoading: false, isRefetching: false, error: error as Error }));
      },
    );
  };

  // Effect 1: initial fetch + refetch on dep change.
  useEffect(() => {
    fetch('initial');
    return () => {
      inflightRef.current++;
      releaseAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // Effect 2: subscribe to user-supplied keys.
  useEffect(() => {
    if (!options.keys?.length) return;
    const offs = options.keys.map((k) => store.subscribe(k, () => fetch('refetch')));
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return state;
}
