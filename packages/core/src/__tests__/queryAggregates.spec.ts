import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';
import { ModelClass } from '../Model.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('count', () => {
  it('returns ScalarQuery awaitable to a number', async () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).count();
    expect(q).toBeInstanceOf(ScalarQuery);
    expect(typeof (await q)).toBe('number');
  });

  it('count carries the upstream filter into state', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).count();
    expect(q.state.filter).toEqual({ active: true });
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'count' });
  });
});
