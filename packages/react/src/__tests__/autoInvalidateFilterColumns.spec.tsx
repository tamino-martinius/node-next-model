import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
});

describe('collection watches auto-refetch on filter-column mutations', () => {
  it('shell.update() that flips a filtered column drops the row from the watch', async () => {
    await Todo.create({ title: 'open', done: false });
    const closed = (await Todo.create({ title: 'open-too', done: false })) as { id: number };

    const { result } = renderHook(
      () => {
        const ops = useModel(Todo as any) as any;
        const watch = ops.filterBy({ done: false }).all().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect((result.current.watch.data as unknown[]).length).toBe(2);

    const row = (await act(() => result.current.ops.find(closed.id).run())) as {
      update: (p: object) => Promise<unknown>;
    };
    await act(() => row.update({ done: true }));

    await waitFor(() => expect((result.current.watch.data as unknown[]).length).toBe(1));
    expect(
      (result.current.watch.data as Array<{ id: number }>).find((r) => r.id === closed.id),
    ).toBeUndefined();
  });

  it('shell.update() that flips a $null filter brings a previously-hidden row INTO the watch', async () => {
    // Seed two rows: one matching the $null filter, one not.
    await Todo.create({ title: 'visible', done: false });
    const hidden = (await Todo.create({ title: 'archived', done: false, userId: 99 })) as {
      id: number;
    };

    const { result } = renderHook(
      () => {
        const ops = useModel(Todo as any) as any;
        // userId is nullable; treat "userId IS NULL" as the visibility filter.
        const watch = ops.filterBy({ $null: 'userId' }).all().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    expect((result.current.watch.data as unknown[]).length).toBe(1);

    const row = (await act(() => result.current.ops.find(hidden.id).run())) as {
      update: (p: object) => Promise<unknown>;
    };
    await act(() => row.update({ userId: null }));

    await waitFor(() => expect((result.current.watch.data as unknown[]).length).toBe(2));
  });

  it('shell.update() on a column NOT named in any filter does not refetch the collection', async () => {
    const a = (await Todo.create({ title: 'old', done: false })) as { id: number };

    const { result } = renderHook(
      () => {
        const ops = useModel(Todo as any) as any;
        // Filter is on `done`; we'll update only `title`.
        const watch = ops.filterBy({ done: false }).all().watch();
        return { ops, watch };
      },
      { wrapper: wrapWithProvider },
    );
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    const before = result.current.watch.data;

    const row = (await act(() => result.current.ops.find(a.id).run())) as {
      update: (p: object) => Promise<unknown>;
    };
    await act(() => row.update({ title: 'new' }));

    // Row still in result, just with its updated title visible through the shell.
    expect((result.current.watch.data as Array<{ id: number; title: string }>).length).toBe(1);
    expect((result.current.watch.data as Array<{ title: string }>)[0]!.title).toBe('new');
    // No row added/removed.
    expect((result.current.watch.data as unknown[]).length).toBe(
      (before as unknown[]).length,
    );
  });
});
