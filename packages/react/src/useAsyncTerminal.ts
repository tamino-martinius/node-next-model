import { useEffect, useRef, useState } from 'react';
import { tagStore } from './instanceState.js';
import { useStore } from './Provider.js';
import { wrapInstance } from './ReactiveInstance.js';
import type { ReactiveQuery, TerminalKind } from './ReactiveQuery.js';
import { runQuery } from './runQuery.js';
import type { Store } from './Store.js';

export interface AsyncResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | undefined;
}

const ARRAY_TERMINALS = new Set<TerminalKind>(['all', 'pluck']);

function initialData<T>(kind: TerminalKind): T {
  return (ARRAY_TERMINALS.has(kind) ? [] : undefined) as T;
}

function isModelInstance(x: unknown): x is object {
  return Boolean(x && typeof x === 'object' && 'attributes' in (x as object));
}

function adopt(raw: unknown, store: Store): unknown {
  if (Array.isArray(raw)) {
    return raw.map((row) => {
      if (!isModelInstance(row)) return row;
      tagStore(row, store);
      return wrapInstance(row);
    });
  }
  if (isModelInstance(raw)) {
    tagStore(raw, store);
    return wrapInstance(raw);
  }
  return raw;
}

export function useAsyncTerminal<T>(
  query: ReactiveQuery<{ tableName: string }>,
  terminal: TerminalKind,
  terminalArgs: unknown[],
): AsyncResult<T> {
  const store = useStore();
  const queryKey = query.hash(terminal, terminalArgs);

  const [state, setState] = useState<AsyncResult<T>>(() => ({
    data: initialData<T>(terminal),
    isLoading: true,
    error: undefined,
  }));
  const inflightRef = useRef(0);
  const hasFetchedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey hashes query+terminal+args
  useEffect(() => {
    const id = ++inflightRef.current;
    setState((s) => ({ data: s.data, isLoading: !hasFetchedRef.current, error: undefined }));

    runQuery(query, terminal, terminalArgs).then(
      (raw) => {
        if (inflightRef.current !== id) return;
        hasFetchedRef.current = true;
        setState({ data: adopt(raw, store) as T, isLoading: false, error: undefined });
      },
      (error: unknown) => {
        if (inflightRef.current !== id) return;
        hasFetchedRef.current = true;
        setState((s) => ({ data: s.data, isLoading: false, error: error as Error }));
      },
    );

    return () => {
      inflightRef.current++;
    };
  }, [queryKey]);

  return state;
}
