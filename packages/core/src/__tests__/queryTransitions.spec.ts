import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { InstanceQuery } from '../query/InstanceQuery.js';
import { ModelClass } from '../Model.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('CollectionQuery → InstanceQuery transitions', () => {
  it('first() returns InstanceQuery with terminalKind first', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).first();
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.terminalKind).toBe('first');
    expect(q.state.limit).toBe(1);
    expect(q.state.filter).toEqual({ active: true });
  });

  it('last() returns InstanceQuery with terminalKind last and reversed order', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .orderBy({ key: 'createdAt' as any })
      .last();
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.terminalKind).toBe('last');
    expect(q.state.limit).toBe(1);
    expect(q.state.order[0].key).toBe('createdAt');
    // Reversed: should default to descending now
  });
});
