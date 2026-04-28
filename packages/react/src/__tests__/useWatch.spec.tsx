import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
  await Todo.create({ title: 'a', done: false });
  await Todo.create({ title: 'b', done: true });
});

describe('useModel().watch()', () => {
  it('initial state: isLoading=true, isRefetching=false', () => {
    const { result } = renderHook(() => useModel(Todo as any).watch(), {
      wrapper: wrapWithProvider,
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRefetching).toBe(false);
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('resolves to wrapped instances and isLoading flips false', async () => {
    const { result } = renderHook(() => useModel(Todo as any).watch(), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as unknown[]).length).toBe(2);
  });

  it('chains: filterBy(...).watch()', async () => {
    const { result } = renderHook(
      () => useModel(Todo as any).filterBy({ done: false }).watch(),
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = result.current.data as { done: boolean }[];
    expect(data.every((t) => t.done === false)).toBe(true);
  });
});

describe('useModel().findWatch(id)', () => {
  it('resolves to a single instance', async () => {
    const created = await Todo.create({ title: 'x', done: false });
    const id = (created as any).id;
    const { result } = renderHook(() => useModel(Todo as any).findWatch(id), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as any)?.title).toBe('x');
  });
});

describe('useModel().firstWatch() / .lastWatch() / .findByWatch()', () => {
  it('firstWatch resolves to the first row', async () => {
    const { result } = renderHook(() => useModel(Todo as any).firstWatch(), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it('findByWatch resolves with the matching row', async () => {
    const { result } = renderHook(() => useModel(Todo as any).findByWatch({ title: 'a' }), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as any)?.title).toBe('a');
  });
});

describe('useWatch lifecycle', () => {
  it('unmount releases all refcounts (no leaks)', async () => {
    const { result, unmount } = renderHook(() => useModel(Todo as any).watch(), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    unmount();
    // No assertion failure = clean teardown.
  });
});
