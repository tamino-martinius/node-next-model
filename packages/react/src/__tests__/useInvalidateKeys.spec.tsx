import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useInvalidateKeys } from '../useInvalidateKeys.js';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
  await Todo.create({ title: 'a', done: false });
});

describe('useInvalidateKeys', () => {
  it('triggers refetch with isRefetching=true and stale data preserved', async () => {
    function useBoth() {
      const watch = useModel(Todo as any).watch({ keys: ['todos'] });
      const invalidate = useInvalidateKeys();
      return { watch, invalidate };
    }
    const { result } = renderHook(() => useBoth(), { wrapper: wrapWithProvider });
    await waitFor(() => expect(result.current.watch.isLoading).toBe(false));
    const stale = result.current.watch.data;

    await act(async () => {
      await Todo.create({ title: 'b', done: false });
    });
    expect(result.current.watch.data).toBe(stale); // unchanged until invalidate

    await act(async () => {
      result.current.invalidate(['todos']);
    });
    await waitFor(() => expect((result.current.watch.data as any[]).length).toBe(2));
  });

  it('throws outside a Provider', () => {
    expect(() => renderHook(() => useInvalidateKeys())).toThrow(
      /must be used inside <NextModelProvider>/,
    );
  });
});
