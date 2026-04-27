import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { lower } from '../query/lower.js';
import { ModelClass } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';

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
});
