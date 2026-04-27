import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ModelClass } from '../Model.js';
import { SortDirection } from '../types.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('CollectionQuery chain methods', () => {
  it('filterBy merges into state.filter', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true });
    expect(q.state.filter).toEqual({ active: true });
  });

  it('orderBy appends to state.order', () => {
    const q = CollectionQuery.fromModel(Todo as any).orderBy({ key: 'createdAt' as any });
    expect(q.state.order).toEqual([{ key: 'createdAt' }]);
  });

  it('reorder replaces state.order', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .orderBy({ key: 'a' as any })
      .reorder({ key: 'b' as any });
    expect(q.state.order).toEqual([{ key: 'b' }]);
  });

  it('limitBy / skipBy / unlimited / unskipped', () => {
    const q = CollectionQuery.fromModel(Todo as any).limitBy(5).skipBy(2);
    expect(q.state.limit).toBe(5);
    expect(q.state.skip).toBe(2);
    expect(q.unlimited().state.limit).toBeUndefined();
    expect(q.unskipped().state.skip).toBeUndefined();
  });

  it('unfiltered clears state.filter', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).unfiltered();
    expect(q.state.filter).toBeUndefined();
  });

  it('reverse flips order direction', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .orderBy({ key: 'a' as any, dir: SortDirection.Asc })
      .reverse();
    expect(q.state.order[0].dir).toBe(SortDirection.Desc);
  });

  it('reverse without an explicit order sorts by primary key descending', () => {
    const q = CollectionQuery.fromModel(Todo as any).reverse();
    expect(q.state.order).toEqual([{ key: 'id', dir: SortDirection.Desc }]);
  });

  it('orFilterBy with no prior filter sets the new filter directly (no $or wrap)', () => {
    const q = CollectionQuery.fromModel(Todo as any).orFilterBy({ x: 1 });
    expect(q.state.filter).toEqual({ x: 1 });
  });

  it('orFilterBy ORs the new filter against the current scope', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .orFilterBy({ archived: true });
    expect(q.state.filter).toEqual({ $or: [{ active: true }, { archived: true }] });
  });

  it('unscoped clears every scope state', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ a: 1 })
      .orderBy({ key: 'a' as any })
      .limitBy(1)
      .unscoped();
    expect(q.state.filter).toBeUndefined();
    expect(q.state.order).toEqual([]);
    expect(q.state.limit).toBeUndefined();
  });

  it('does not mutate the receiver (immutable chain)', () => {
    const a = CollectionQuery.fromModel(Todo as any);
    const b = a.filterBy({ x: 1 });
    expect(a.state.filter).toBeUndefined();
    expect(b.state.filter).toEqual({ x: 1 });
  });

  it('joins(name) appends a select-mode JoinClause', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        user: { belongsTo: Todo, foreignKey: 'userId' } as any,
      };
    }
    const q = CollectionQuery.fromModel(Post as any).joins('user');
    expect(q.state.pendingJoins).toHaveLength(1);
    expect(q.state.pendingJoins[0].mode).toBe('select');
  });

  it('whereMissing(name) appends an antiJoin LEFT JOIN', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        comments: { hasMany: Todo, foreignKey: 'postId' } as any,
      };
    }
    const q = CollectionQuery.fromModel(Post as any).whereMissing('comments');
    expect(q.state.pendingJoins).toHaveLength(1);
    expect(q.state.pendingJoins[0].kind).toBe('left');
    expect(q.state.pendingJoins[0].mode).toBe('antiJoin');
  });

  it('whereMissing rejects belongsTo associations', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        user: { belongsTo: Todo, foreignKey: 'userId' } as any,
      };
    }
    expect(() => CollectionQuery.fromModel(Post as any).whereMissing('user')).toThrow(
      /only supports hasMany/,
    );
  });

  it('joins/whereMissing throw when association is unknown', () => {
    class Bare extends ModelClass {
      static tableName = 'bare';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
    }
    expect(() => CollectionQuery.fromModel(Bare as any).joins('missing')).toThrow(
      /requires the Model factory to declare 'associations'/,
    );
  });

  it('joins throws Unknown association when name not declared on a model that has associations', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = { user: { belongsTo: Todo, foreignKey: 'userId' } as any };
    }
    expect(() => CollectionQuery.fromModel(Post as any).joins('comments')).toThrow(
      /Unknown association 'comments'/,
    );
  });

  it('whereMissing throws Unknown association when name not declared on a model that has associations', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = { user: { belongsTo: Todo, foreignKey: 'userId' } as any };
    }
    expect(() => CollectionQuery.fromModel(Post as any).whereMissing('comments')).toThrow(
      /Unknown association 'comments'/,
    );
  });

  it('filterBy with an association-named key promotes to a JOIN', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        user: { belongsTo: Todo, foreignKey: 'userId' } as any,
      };
    }
    const q = CollectionQuery.fromModel(Post as any).filterBy({ user: { active: true } });
    expect(q.state.pendingJoins).toHaveLength(1);
    expect(q.state.pendingJoins[0].mode).toBe('select');
    expect(q.state.pendingJoins[0].filter).toEqual({ active: true });
  });

  it('filterBy with mixed association-key and column-key splits correctly', () => {
    class Post extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        user: { belongsTo: Todo, foreignKey: 'userId' } as any,
      };
    }
    const q = CollectionQuery.fromModel(Post as any).filterBy({
      user: { active: true },
      status: 'published',
    });
    expect(q.state.pendingJoins).toHaveLength(1);
    expect(q.state.filter).toEqual({ status: 'published' });
  });
});
