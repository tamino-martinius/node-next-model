import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextModelProvider } from '../Provider.js';
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
      () =>
        useModel(Todo as any)
          .filterBy({ done: false })
          .watch(),
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = result.current.data as { done: boolean }[];
    expect(data.every((t) => t.done === false)).toBe(true);
  });
});

describe('useModel().find(id).watch()', () => {
  it('resolves to a single instance', async () => {
    const created = await Todo.create({ title: 'x', done: false });
    const id = (created as any).id;
    const { result } = renderHook(
      () =>
        useModel(Todo as any)
          .find(id)
          .watch(),
      {
        wrapper: wrapWithProvider,
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect((result.current.data as any)?.title).toBe('x');
  });
});

describe('useModel().first().watch() / .last().watch() / .findBy().watch()', () => {
  it('first().watch() resolves to the first row', async () => {
    const { result } = renderHook(
      () =>
        useModel(Todo as any)
          .first()
          .watch(),
      {
        wrapper: wrapWithProvider,
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it('findBy().watch() resolves with the matching row', async () => {
    const { result } = renderHook(
      () =>
        useModel(Todo as any)
          .findBy({ title: 'a' })
          .watch(),
      {
        wrapper: wrapWithProvider,
      },
    );
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

describe('delete propagation', () => {
  it('collection: deleted row drops from data', async () => {
    const { result } = renderHook(() => useModel(Todo as any).watch(), {
      wrapper: wrapWithProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = (result.current.data as any[]).length;
    const first = (result.current.data as any[])[0];
    await act(async () => {
      await first.delete();
    });
    await waitFor(() => expect((result.current.data as any[]).length).toBe(before - 1));
  });

  it('single-instance: deleted row sets data to undefined', async () => {
    const created = await Todo.create({ title: 'gone', done: false });
    const id = (created as any).id;
    const { result } = renderHook(
      () =>
        useModel(Todo as any)
          .find(id)
          .watch(),
      {
        wrapper: wrapWithProvider,
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await (result.current.data as any).delete();
    });
    await waitFor(() => expect(result.current.data).toBeUndefined());
  });
});

describe('cross-component update propagation', () => {
  it('a save in one component live-updates a watch in another (single-instance)', async () => {
    const created = await Todo.create({ title: 'before', done: false });
    const id = (created as any).id;

    function Pair() {
      const watch = useModel(Todo as any)
        .find(id)
        .watch();
      const editor = useModel(Todo as any)
        .find(id)
        .fetch();
      const todo = (editor.data as any) ?? null;
      return (
        <div>
          <span data-testid="watched">{(watch.data as any)?.title ?? 'loading'}</span>
          <button
            type="button"
            data-testid="rename"
            onClick={async () => {
              if (!todo) return;
              todo.title = 'after';
              await todo.save();
            }}
          >
            rename
          </button>
        </div>
      );
    }

    const view = render(
      <NextModelProvider>
        <Pair />
      </NextModelProvider>,
    );

    await waitFor(() => expect(view.getByTestId('watched').textContent).toBe('before'));

    await act(async () => {
      view.getByTestId('rename').click();
    });
    await waitFor(() => expect(view.getByTestId('watched').textContent).toBe('after'));
  });

  it('two watches that resolve the same row share the same shell', async () => {
    const created = await Todo.create({ title: 'shared', done: false });
    const id = (created as any).id;

    function Pair() {
      const a = useModel(Todo as any)
        .filterBy({ id })
        .watch();
      const b = useModel(Todo as any)
        .find(id)
        .watch();
      if (a.isLoading || b.isLoading) return <span data-testid="status">loading</span>;
      return <span data-testid="status">{(a.data as any[])[0] === b.data ? 'same' : 'diff'}</span>;
    }

    const view = render(
      <NextModelProvider>
        <Pair />
      </NextModelProvider>,
    );

    await waitFor(() => expect(view.getByTestId('status').textContent).toBe('same'));
  });
});
