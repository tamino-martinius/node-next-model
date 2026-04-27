import { describe, expect, it } from 'vitest';
import { MemoryConnector } from '../MemoryConnector.js';
import { baseQueryScoped } from '../query/baseQueryScoped.js';
import { KeyType } from '../types.js';

describe('baseQueryScoped', () => {
  it('returns rows for the simple no-parent-scope case', async () => {
    const c = new MemoryConnector({
      storage: {
        users: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
        ],
      },
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
        users: [
          { id: 1, email: 'a@b' },
          { id: 2, email: 'c@d' },
        ],
        todos: [
          { id: 10, userId: 1 },
          { id: 11, userId: 2 },
        ],
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
      storage: {
        orders: [
          { id: 1, total: 5 },
          { id: 2, total: 7 },
        ],
      },
    });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'orders', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'sum', column: 'total' },
    });
    expect(result).toBe(12);
  });

  it('count projection routes to connector.count', async () => {
    const c = new MemoryConnector({
      storage: { orders: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'orders', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'count' },
    });
    expect(result).toBe(3);
  });

  it('pk projection returns the primary-key column values', async () => {
    const c = new MemoryConnector({
      storage: { users: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'users', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'pk' },
    });
    expect(result).toEqual([1, 2, 3]);
  });

  it('column projection returns the named column values', async () => {
    const c = new MemoryConnector({
      storage: {
        users: [
          { id: 1, email: 'a@b' },
          { id: 2, email: 'c@d' },
        ],
      },
    });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'users', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'column', column: 'email' },
    });
    expect(result).toEqual(['a@b', 'c@d']);
  });

  it('nests two parent scopes — outer scope feeds inner scope as $in constraint', async () => {
    const c = new MemoryConnector({
      storage: {
        teams: [
          { id: 1, region: 'EU' },
          { id: 2, region: 'US' },
        ],
        users: [
          { id: 10, teamId: 1 },
          { id: 11, teamId: 2 },
        ],
        todos: [
          { id: 100, userId: 10 },
          { id: 101, userId: 11 },
        ],
      },
    });
    // teams[region=EU] resolves to [1].
    // users with teamId IN [1] resolves to [10].
    // todos with userId IN [10] yields id=100.
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'todos', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: 'teams',
          parentKeys: { id: KeyType.number },
          parentFilter: { region: 'EU' },
          link: { childColumn: 'teamId', parentColumn: 'id', direction: 'hasMany' },
        },
        {
          parentTable: 'users',
          parentKeys: { id: KeyType.number },
          link: { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    });
    expect(rows).toEqual([expect.objectContaining({ id: 100 })]);
  });

  it('short-circuits to empty result when a parent scope matches no rows', async () => {
    const c = new MemoryConnector({
      storage: {
        users: [{ id: 1, email: 'a@b' }],
        todos: [{ id: 10, userId: 1 }],
      },
    });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'todos', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: 'users',
          parentKeys: { id: KeyType.number },
          parentFilter: { email: 'missing@example' },
          link: { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    });
    expect(rows).toEqual([]);
  });

  it('dedups parent-column values before building the $in filter', async () => {
    const c = new MemoryConnector({
      storage: {
        users: [
          { id: 1, role: 'a' },
          { id: 1, role: 'a' },
          { id: 1, role: 'a' },
        ],
        todos: [{ id: 10, userId: 1 }],
      },
    });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'todos', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: 'users',
          parentKeys: { id: KeyType.number },
          parentFilter: { role: 'a' },
          link: { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    });
    expect(rows).toEqual([expect.objectContaining({ id: 10 })]);
  });

  it('throws PersistenceError on aggregate sum/min/max/avg without a column', async () => {
    const c = new MemoryConnector({ storage: { orders: [{ id: 1 }] } });
    await expect(
      baseQueryScoped(c, {
        target: { tableName: 'orders', keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [],
        projection: { kind: 'aggregate', op: 'sum' } as any,
      }),
    ).rejects.toThrow(/requires a column/);
  });
});
