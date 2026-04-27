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
});
