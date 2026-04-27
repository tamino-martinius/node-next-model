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

describe('aggregates', () => {
  it('sum returns ScalarQuery with op sum and column', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).sum('total');
    expect(q).toBeInstanceOf(ScalarQuery);
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'sum', column: 'total' });
    expect(q.state.filter).toEqual({ active: true });
  });

  it('average returns ScalarQuery with op avg', () => {
    const q = CollectionQuery.fromModel(Todo as any).average('priority');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'avg', column: 'priority' });
  });

  it('minimum returns ScalarQuery with op min', () => {
    const q = CollectionQuery.fromModel(Todo as any).minimum('createdAt');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'min', column: 'createdAt' });
  });

  it('maximum returns ScalarQuery with op max', () => {
    const q = CollectionQuery.fromModel(Todo as any).maximum('priority');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'max', column: 'priority' });
  });
});
