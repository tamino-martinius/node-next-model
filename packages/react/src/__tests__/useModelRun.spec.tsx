import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
});

describe('useModel(M).<terminal>.run()', () => {
  it('all().run() returns tagged shells for every row', async () => {
    await Todo.create({ title: 'a', done: false });
    await Todo.create({ title: 'b', done: true });

    const { result } = renderHook(() => useModel(Todo), {
      wrapper: wrapWithProvider,
    });

    const rows = await act(() => result.current.all().run());
    expect(rows).toHaveLength(2);
    // Tagged shells expose `.update` / `.delete` — verifies the proxy wrap.
    expect(typeof rows[0]!.update).toBe('function');
    expect(typeof rows[0]!.delete).toBe('function');
  });

  it('first().run() returns a tagged shell or undefined', async () => {
    const { result } = renderHook(() => useModel(Todo), {
      wrapper: wrapWithProvider,
    });

    expect(await act(() => result.current.first().run())).toBeUndefined();

    await Todo.create({ title: 'a', done: false });
    const row = await act(() => result.current.first().run());
    expect(row).toBeDefined();
    expect(row?.title).toBe('a');
  });

  it('find(pk).run() returns the tagged row, or undefined when missing', async () => {
    const created = await Todo.create({ title: 'a', done: false });

    const { result } = renderHook(() => useModel(Todo), {
      wrapper: wrapWithProvider,
    });

    const row = await act(() => result.current.find(created.id).run());
    expect(row?.id).toBe(created.id);
    expect(row?.title).toBe('a');

    expect(await act(() => result.current.find(99999).run())).toBeUndefined();
  });

  it('shell mutation via .update() refires a sibling .watch() without manual invalidate', async () => {
    const created = await Todo.create({ title: 'old', done: false });

    // Both hooks mounted under one Provider so they share a Store.
    const { result } = renderHook(
      () => {
        const ops = useModel(Todo);
        const watch = ops.filterBy({ id: created.id }).first().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect(result.current.watch.data?.title).toBe('old');

    const row = await act(() => result.current.ops.find(created.id).run());
    await act(() => row!.update({ title: 'new' }));

    await waitFor(() => expect(result.current.watch.data?.title).toBe('new'));
  });

  it('shell .delete() drops the row and refires a sibling .all().watch()', async () => {
    const created = await Todo.create({ title: 'a', done: false });
    await Todo.create({ title: 'b', done: false });

    const { result } = renderHook(
      () => {
        const ops = useModel(Todo);
        const watch = ops.all().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect(result.current.watch.data).toHaveLength(2);

    const row = await act(() => result.current.ops.find(created.id).run());
    await act(() => row!.delete());

    await waitFor(() => expect(result.current.watch.data).toHaveLength(1));
    expect(result.current.watch.data.find((r) => r.id === created.id)).toBeUndefined();
  });
});
