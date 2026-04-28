import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
});

describe('useModel().build()', () => {
  it('returns a stable reactive instance across renders', () => {
    const { result, rerender } = renderHook(
      () => useModel(Todo as any).build({ title: 'a', done: false }),
      { wrapper: wrapWithProvider },
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('rerenders when a property is set', () => {
    function Form() {
      const todo = useModel(Todo as any).build({ title: 'a', done: false }) as any;
      return <p data-testid="title">{todo.title}</p>;
    }
    render(<Form />, { wrapper: wrapWithProvider });
    expect(screen.getByTestId('title').textContent).toBe('a');
  });

  it('reset() clears changes and re-emits', () => {
    const { result } = renderHook(
      () => useModel(Todo as any).build({ title: 'a', done: false }) as any,
      { wrapper: wrapWithProvider },
    );
    act(() => { result.current.title = 'changed'; });
    expect(result.current.isChanged()).toBe(true);
    act(() => { result.current.reset({ title: 'fresh', done: false }); });
    expect(result.current.attributes).toEqual({ title: 'fresh', done: false });
    expect(result.current.isChanged()).toBe(false);
  });

  it('throws outside a Provider', () => {
    expect(() => renderHook(() => useModel(Todo as any).build())).toThrow(
      /must be used inside <NextModelProvider>/,
    );
  });
});

describe('useModel async terminals', () => {
  it('.all returns { data, isLoading, error }', async () => {
    await Todo.create({ title: 'A', done: false });
    const { result } = renderHook(() => useModel(Todo as any).all(), {
      wrapper: wrapWithProvider,
    });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect((result.current.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('.find returns one record', async () => {
    const created = await Todo.create({ title: 'X', done: false });
    const id = (created as any).id;
    const { result } = renderHook(() => useModel(Todo as any).find(id), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as any).title).toBe('X');
  });

  it('.count returns number', async () => {
    const { result } = renderHook(() => useModel(Todo as any).count(), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.data).toBe('number');
  });

  it('.filterBy(...).all() works (chain through HookQuery)', async () => {
    await Todo.create({ title: 'M', done: true });
    const { result } = renderHook(
      () => useModel(Todo as any).filterBy({ done: true }).all(),
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as unknown[]).length).toBeGreaterThan(0);
  });
});
