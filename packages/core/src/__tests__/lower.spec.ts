import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { lower } from '../query/lower.js';
import { ModelClass } from '../Model.js';

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

describe('lower', () => {
  it('lowers a flat CollectionQuery to a no-parent-scope QueryScopedSpec', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true });
    const spec = lower(q, 'rows');
    expect(spec.parentScopes).toEqual([]);
    expect(spec.target.tableName).toBe('todos');
    expect(spec.filter).toEqual({ active: true });
    expect(spec.projection).toBe('rows');
  });

  it('flattens parent chain into ParentScope entries (closest parent last)', () => {
    const userInst = CollectionQuery.fromModel(User as any).findBy({ email: 'a@b' });
    const todosForUser = CollectionQuery.fromModel(Todo as any).withParent(userInst, {
      childColumn: 'userId',
      parentColumn: 'id',
      direction: 'hasMany',
    });
    const spec = lower(todosForUser, 'rows');
    expect(spec.parentScopes).toHaveLength(1);
    const parent = spec.parentScopes[0];
    expect(parent.parentTable).toBe('users');
    expect(parent.parentFilter).toEqual({ email: 'a@b' });
    expect(parent.parentLimit).toBe(1);
    expect(parent.link.direction).toBe('hasMany');
  });

  it('flattens multi-level parent chain (closest parent last)', () => {
    const userInst = CollectionQuery.fromModel(User as any).findBy({ email: 'a@b' });
    // Imagine User.posts then post.comments — single belongsTo to User
    // Here we just nest withParent twice on placeholder builders.
    const intermediate = CollectionQuery.fromModel(Todo as any)
      .withParent(userInst, { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' })
      .first();
    const leaf = CollectionQuery.fromModel(Todo as any).withParent(intermediate, {
      childColumn: 'parentTodoId',
      parentColumn: 'id',
      direction: 'hasMany',
    });
    const spec = lower(leaf, 'rows');
    expect(spec.parentScopes).toHaveLength(2);
    // Closest parent (intermediate) should be last
    expect(spec.parentScopes[1].parentTable).toBe('todos');
    expect(spec.parentScopes[1].parentLimit).toBe(1); // intermediate had .first() applied
    expect(spec.parentScopes[0].parentTable).toBe('users');
    expect(spec.parentScopes[0].parentLimit).toBe(1); // outermost had findBy (limit 1)
  });
});
