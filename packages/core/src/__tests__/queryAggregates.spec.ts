import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';
import { ModelClass } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = new MemoryConnector({ storage: { todos: [] } });
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

  it('average returns ScalarQuery with op avg and carries upstream filter', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .average('priority');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'avg', column: 'priority' });
    expect(q.state.filter).toEqual({ active: true });
  });

  it('minimum returns ScalarQuery with op min and carries upstream filter', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .minimum('createdAt');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'min', column: 'createdAt' });
    expect(q.state.filter).toEqual({ active: true });
  });

  it('maximum returns ScalarQuery with op max and carries upstream filter', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .maximum('priority');
    expect(q.projection).toEqual({ kind: 'aggregate', op: 'max', column: 'priority' });
    expect(q.state.filter).toEqual({ active: true });
  });
});

describe('aggregates materialize', () => {
  class Order extends ModelClass {
    static tableName = 'orders';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = new MemoryConnector({
      storage: { orders: [{ id: 1, total: 5 }, { id: 2, total: 7 }, { id: 3, total: 12 }] },
    });
  }

  it('count returns the number of matching rows', async () => {
    const n = await CollectionQuery.fromModel(Order as any).count();
    expect(n).toBe(3);
  });

  it('count honours filterBy', async () => {
    const n = await CollectionQuery.fromModel(Order as any).filterBy({ id: 1 }).count();
    expect(n).toBe(1);
  });

  it('sum aggregates a column', async () => {
    const total = await CollectionQuery.fromModel(Order as any).sum('total');
    expect(total).toBe(24);
  });

  it('average aggregates a column', async () => {
    const avg = await CollectionQuery.fromModel(Order as any).average('total');
    expect(avg).toBe(8);
  });

  it('minimum returns the smallest value', async () => {
    const m = await CollectionQuery.fromModel(Order as any).minimum('total');
    expect(m).toBe(5);
  });

  it('maximum returns the largest value', async () => {
    const m = await CollectionQuery.fromModel(Order as any).maximum('total');
    expect(m).toBe(12);
  });

  it('count nullScoped returns 0', async () => {
    const n = await CollectionQuery.fromModel(Order as any).none().count();
    expect(n).toBe(0);
  });
});
