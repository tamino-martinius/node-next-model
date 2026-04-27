import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ModelClass } from '../Model.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static filter = { active: true } as any;
  static order = [{ key: 'createdAt' }] as any;
  static limit = 25;
  static skip = 0;
  static connector = { query: async () => [] } as any;
}

describe('CollectionQuery.fromModel', () => {
  it('seeds state from default scope on the Model', () => {
    const q = CollectionQuery.fromModel(Todo as any);
    expect(q.state.filter).toEqual({ active: true });
    expect(q.state.order).toEqual([{ key: 'createdAt' }]);
    expect(q.state.limit).toBe(25);
    expect(q.state.skip).toBe(0);
  });

  it('snapshots arrays so later Model mutations do not bleed in', () => {
    Todo.order = [{ key: 'a' }] as any;
    const q = CollectionQuery.fromModel(Todo as any);
    Todo.order.push({ key: 'b' } as any);
    expect(q.state.order).toEqual([{ key: 'a' }]);
  });
});
