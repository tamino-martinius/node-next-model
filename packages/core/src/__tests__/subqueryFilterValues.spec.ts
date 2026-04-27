import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { lower } from '../query/lower.js';
import { ModelClass } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';
import { ColumnQuery } from '../query/ColumnQuery.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

class User extends ModelClass {
  static tableName = 'users';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('subquery filter values', () => {
  it('CollectionQuery as filter value lowers to a parent scope (IN)', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      userId: CollectionQuery.fromModel(User as any).filterBy({ active: true }),
    });
    const spec = lower(q, 'rows');
    // The filter is rewritten — the CollectionQuery is extracted as a parent scope
    expect(spec.parentScopes).toHaveLength(1);
    const parent = spec.parentScopes[0];
    expect(parent.parentTable).toBe('users');
    expect(parent.parentFilter).toEqual({ active: true });
    expect(parent.link.childColumn).toBe('userId');
    expect(parent.link.parentColumn).toBe('id'); // implicit pk projection
  });

  it('InstanceQuery as filter value lowers with parent scope at LIMIT 1', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      userId: CollectionQuery.fromModel(User as any).first(),
    });
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toHaveLength(1);
    expect(spec.parentScopes[0].parentLimit).toBe(1);
  });

  it('ColumnQuery as filter value uses the projected column', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      ownerEmail: CollectionQuery.fromModel(User as any).filterBy({ active: true }).pluck('email'),
    });
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toHaveLength(1);
    expect(spec.parentScopes[0].link.parentColumn).toBe('email');
  });

  it('integrates with MemoryConnector via baseQueryScoped fallback', async () => {
    const connector = new MemoryConnector({
      storage: {
        users: [{ id: 1, active: true }, { id: 2, active: false }],
        todos: [{ id: 10, userId: 1 }, { id: 11, userId: 2 }],
      },
    });
    class TodoM extends ModelClass {
      static tableName = 'todos';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    class UserM extends ModelClass {
      static tableName = 'users';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    const todos = (await CollectionQuery.fromModel(TodoM as any).filterBy({
      userId: CollectionQuery.fromModel(UserM as any).filterBy({ active: true }),
    })) as any[];
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(10);
  });

  it('extracts builder values from $and arms (recursive descent)', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      $and: [
        { userId: CollectionQuery.fromModel(User as any).filterBy({ active: true }) },
        { archived: false },
      ],
    } as any);
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toHaveLength(1);
    expect(spec.parentScopes[0].link.childColumn).toBe('userId');
    // The cleaned filter should still carry the non-builder $and arm but
    // with the builder-keyed object emptied out.
    expect(spec.filter).toMatchObject({ $and: [{}, { archived: false }] });
  });

  it('extracts builder values from $or arms', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      $or: [
        { userId: CollectionQuery.fromModel(User as any).filterBy({ active: true }) },
        { ownerId: CollectionQuery.fromModel(User as any).filterBy({ admin: true }) },
      ],
    } as any);
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toHaveLength(2);
    expect(spec.parentScopes.map((p) => p.link.childColumn).sort()).toEqual(['ownerId', 'userId']);
  });

  it('extracts builder values from $not branch', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({
      $not: { userId: CollectionQuery.fromModel(User as any).filterBy({ banned: true }) },
    } as any);
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toHaveLength(1);
    expect(spec.parentScopes[0].parentFilter).toEqual({ banned: true });
  });

  it('ScalarQuery embedded in $gt operator splices the resolved value', async () => {
    const connector = new MemoryConnector({
      storage: {
        orders: [{ id: 1, total: 10 }, { id: 2, total: 20 }, { id: 3, total: 30 }],
        orderItems: [{ id: 1, orderId: 99, amount: 15 }, { id: 2, orderId: 99, amount: 25 }],
      },
    });
    class OrderM extends ModelClass {
      static tableName = 'orders';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    class OrderItemM extends ModelClass {
      static tableName = 'orderItems';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    const total = CollectionQuery.fromModel(OrderItemM as any)
      .filterBy({ orderId: 99 })
      .sum('amount'); // = 40
    const orders = (await CollectionQuery.fromModel(OrderM as any).filterBy({
      total: { $gt: total },
    } as any)) as any[];
    // total > 40 → no rows from {10, 20, 30}
    expect(orders).toEqual([]);
  });

  it('ColumnQuery embedded in $in operator splices the resolved values', async () => {
    const connector = new MemoryConnector({
      storage: {
        users: [{ id: 1, role: 'admin' }, { id: 2, role: 'user' }],
        todos: [{ id: 10, userId: 1 }, { id: 11, userId: 2 }, { id: 12, userId: 3 }],
      },
    });
    class TodoM extends ModelClass {
      static tableName = 'todos';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    class UserM extends ModelClass {
      static tableName = 'users';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = connector;
    }
    const adminIds = CollectionQuery.fromModel(UserM as any).filterBy({ role: 'admin' }).pluck('id');
    const todos = (await CollectionQuery.fromModel(TodoM as any).filterBy({
      userId: { $in: adminIds },
    } as any)) as any[];
    expect(todos.map((t: any) => t.id).sort()).toEqual([10]);
  });
});
