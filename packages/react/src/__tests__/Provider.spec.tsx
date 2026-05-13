import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextModelProvider, useStore } from '../Provider.js';
import { Store } from '../Store.js';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

describe('NextModelProvider', () => {
  it('provides a Store via context', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NextModelProvider>{children}</NextModelProvider>
    );
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current).toBeInstanceOf(Store);
  });

  it('disposes the Store on unmount', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NextModelProvider>{children}</NextModelProvider>
    );
    const { result, unmount } = renderHook(() => useStore(), { wrapper });
    const store = result.current;
    unmount();
    expect(store.isDisposed()).toBe(true);
  });

  it('throws when useStore is called outside a Provider', () => {
    expect(() => renderHook(() => useStore())).toThrow(/must be used inside <NextModelProvider>/);
  });
});

const { Todo, reset } = makeFixtures();

describe('post-dispose save', () => {
  beforeEach(async () => {
    await reset();
    await Todo.create({ title: 'x', done: false });
  });

  it('save() on a held instance after Provider unmount does not throw', async () => {
    const all = await Todo.all();
    const id = (all[0] as any).id;
    const view = renderHook(
      () =>
        useModel(Todo as any)
          .find(id)
          .fetch(),
      {
        wrapper: wrapWithProvider,
      },
    );
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    const todo = view.result.current.data as any;
    view.unmount();
    await expect(todo.save()).resolves.toBeDefined();
  });
});
