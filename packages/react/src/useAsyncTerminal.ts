import { useEffect, useRef, useState } from 'react';
import { decorate } from './adoptInstance.js';
import { useStore } from './Provider.js';
import type { ReactiveQuery, TerminalKind } from './ReactiveQuery.js';
import { runQuery } from './runQuery.js';

export interface AsyncResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | undefined;
}

const ARRAY_TERMINALS = new Set<TerminalKind>(['all', 'pluck']);

function initialData<T>(kind: TerminalKind): T {
  return (ARRAY_TERMINALS.has(kind) ? [] : undefined) as T;
}

export function useAsyncTerminal<T>(
  query: ReactiveQuery<{ tableName: string }>,
  terminal: TerminalKind,
  terminalArgs: unknown[],
): AsyncResult<T> {
  const store = useStore();
  const tableName = query.plan.ModelClass.tableName;
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
        setState({ data: decorate(raw, tableName, store) as T, isLoading: false, error: undefined });
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
