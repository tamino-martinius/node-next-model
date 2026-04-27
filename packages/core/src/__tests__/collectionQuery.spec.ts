import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';

const FakeModel = { tableName: 'todos', keys: { id: 1 } };

describe('CollectionQuery', () => {
  it('resolves to its execute() result when awaited', async () => {
    const q = new CollectionQuery(FakeModel as any, async () => [{ id: 1 }, { id: 2 }]);
    const rows = await q;
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('only executes once per await chain (memoized)', async () => {
    let calls = 0;
    const q = new CollectionQuery(FakeModel as any, async () => {
      calls += 1;
      return [];
    });
    await q;
    await q;
    expect(calls).toBe(1);
  });

  it('catch returns a chained PromiseLike', async () => {
    const q = new CollectionQuery(FakeModel as any, async () => {
      throw new Error('boom');
    });
    const recovered = await q.catch((e: Error) => e.message);
    expect(recovered).toBe('boom');
  });
});
