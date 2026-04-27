import { describe, expect, it } from 'vitest';
import { baseQueryScoped } from '../query/baseQueryScoped.js';
import { MemoryConnector } from '../MemoryConnector.js';
import { KeyType } from '../types.js';

describe('baseQueryScoped', () => {
  it('returns rows for the simple no-parent-scope case', async () => {
    const c = new MemoryConnector({
      storage: { users: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] },
    });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'users', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: 'rows',
    });
    expect(rows).toHaveLength(2);
  });

  it('resolves a parent scope into an $in filter', async () => {
    const c = new MemoryConnector({
      storage: {
        users: [{ id: 1, email: 'a@b' }, { id: 2, email: 'c@d' }],
        todos: [{ id: 10, userId: 1 }, { id: 11, userId: 2 }],
      },
    });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'todos', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: 'users',
          parentKeys: { id: KeyType.number },
          parentFilter: { email: 'a@b' },
          parentLimit: 1,
          link: { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    });
    expect(rows).toEqual([expect.objectContaining({ id: 10 })]);
  });

  it('aggregate projection returns a scalar', async () => {
    const c = new MemoryConnector({
      storage: { orders: [{ id: 1, total: 5 }, { id: 2, total: 7 }] },
    });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'orders', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'sum', column: 'total' },
    });
    expect(result).toBe(12);
  });
});
