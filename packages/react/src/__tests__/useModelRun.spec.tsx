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

    const { result } = renderHook(() => useModel(Todo as any), {
      wrapper: wrapWithProvider,
    });

    const rows = await act(() => (result.current as any).all().run());
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    // Tagged shells are Proxy-wrapped; their `update`/`delete` are functions.
    expect(typeof (rows as object[])[0]).toBe('object');
    expect(typeof ((rows as any)[0] as { update: unknown }).update).toBe('function');
  });

  it('first().run() returns a tagged shell or undefined', async () => {
    const { result } = renderHook(() => useModel(Todo as any), {
      wrapper: wrapWithProvider,
    });

    expect(await act(() => (result.current as any).first().run())).toBeUndefined();

    await Todo.create({ title: 'a', done: false });
    const row = (await act(() => (result.current as any).first().run())) as
      | { title: string; update: (p: object) => Promise<unknown> }
      | undefined;
    expect(row).toBeDefined();
    expect(row?.title).toBe('a');
  });

  it('find(pk).run() returns the tagged row, or undefined when missing', async () => {
    const created = (await Todo.create({ title: 'a', done: false })) as {
      id: number;
    };

    const { result } = renderHook(() => useModel(Todo as any), {
      wrapper: wrapWithProvider,
    });

    const row = (await act(() => (result.current as any).find(created.id).run())) as
      | { id: number; title: string }
      | undefined;
    expect(row?.id).toBe(created.id);
    expect(row?.title).toBe('a');

    expect(await act(() => (result.current as any).find(99999).run())).toBeUndefined();
  });

  it('shell mutation via .update() refires a sibling .watch() without manual invalidate', async () => {
    const created = (await Todo.create({ title: 'old', done: false })) as { id: number };

    // Both hooks mounted under one Provider so they share a Store.
    const { result } = renderHook(
      () => {
        const ops = useModel(Todo as any) as any;
        const watch = ops.filterBy({ id: created.id }).first().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect((result.current.watch.data as { title: string } | undefined)?.title).toBe('old');

    const row = (await act(() => result.current.ops.find(created.id).run())) as {
      update: (p: object) => Promise<unknown>;
    };
    await act(() => row.update({ title: 'new' }));

    await waitFor(() =>
      expect((result.current.watch.data as { title: string } | undefined)?.title).toBe('new'),
    );
  });

  it('shell .delete() drops the row and refires a sibling .all().watch()', async () => {
    const created = (await Todo.create({ title: 'a', done: false })) as { id: number };
    await Todo.create({ title: 'b', done: false });

    const { result } = renderHook(
      () => {
        const ops = useModel(Todo as any) as any;
        const watch = ops.all().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect((result.current.watch.data as unknown[]).length).toBe(2);

    const row = (await act(() => result.current.ops.find(created.id).run())) as {
      delete: () => Promise<unknown>;
    };
    await act(() => row.delete());

    await waitFor(() => expect((result.current.watch.data as unknown[]).length).toBe(1));
    expect(
      (result.current.watch.data as Array<{ id: number }>).find((r) => r.id === created.id),
    ).toBeUndefined();
  });
});
