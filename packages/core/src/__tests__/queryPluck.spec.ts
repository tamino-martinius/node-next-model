import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ColumnQuery } from '../query/ColumnQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';
import { ModelClass } from '../Model.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('CollectionQuery.pluck', () => {
  it('returns ColumnQuery with column projection', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).pluck('email');
    expect(q).toBeInstanceOf(ColumnQuery);
    expect(q.column).toBe('email');
    expect(q.projection).toEqual({ kind: 'column', column: 'email' });
    expect(q.state.filter).toEqual({ active: true });
  });
});

describe('InstanceQuery.pluck', () => {
  it('returns ScalarQuery with column projection (single-record)', () => {
    const q = CollectionQuery.fromModel(Todo as any).first().pluck('email');
    expect(q).toBeInstanceOf(ScalarQuery);
    expect(q.projection).toEqual({ kind: 'column', column: 'email' });
    expect(q.state.limit).toBe(1);
  });
});
