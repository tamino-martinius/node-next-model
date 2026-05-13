import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReactiveQuery } from '../ReactiveQuery.js';
import { useAsyncTerminal } from '../useAsyncTerminal.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
  await Todo.create({ title: 'a', done: false });
  await Todo.create({ title: 'b', done: true });
});

describe('useAsyncTerminal', () => {
  it('initial state: isLoading=true, no error', () => {
    const query = ReactiveQuery.fromModel(Todo as any);
    const { result } = renderHook(() => useAsyncTerminal(query, 'all', []), {
      wrapper: wrapWithProvider,
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('resolves to data array', async () => {
    const query = ReactiveQuery.fromModel(Todo as any);
    const { result } = renderHook(() => useAsyncTerminal(query, 'all', []), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as unknown[]).length).toBe(2);
    expect(result.current.error).toBeUndefined();
  });

  it('captures error on connector throw', async () => {
    const bogus = ReactiveQuery.fromModel({ tableName: 'no_such', build: () => ({}) } as any);
    const { result } = renderHook(() => useAsyncTerminal(bogus, 'all', []), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });

  it('count returns a number, not wrapped', async () => {
    const query = ReactiveQuery.fromModel(Todo as any);
    const { result } = renderHook(() => useAsyncTerminal<number>(query, 'count', []), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.data).toBe('number');
  });
});
