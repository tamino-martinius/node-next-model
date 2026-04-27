import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { InstanceQuery } from '../query/InstanceQuery.js';
import { ModelClass } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';
import { SortDirection } from '../types.js';

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
      .orderBy({ key: 'createdAt' as any, dir: SortDirection.Asc })
      .last();
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.terminalKind).toBe('last');
    expect(q.state.limit).toBe(1);
    expect(q.state.order[0].key).toBe('createdAt');
    expect(q.state.order[0].dir).toBe(SortDirection.Desc);
  });

  it('last() with no explicit order falls back to primary key descending', () => {
    const q = CollectionQuery.fromModel(Todo as any).last();
    expect(q.state.order).toEqual([{ key: 'id', dir: SortDirection.Desc }]);
  });

  it('findBy returns InstanceQuery scoped by the filter with terminalKind findBy', () => {
    const q = CollectionQuery.fromModel(Todo as any).findBy({ id: 1 });
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.terminalKind).toBe('findBy');
    expect(q.state.filter).toEqual({ id: 1 });
    expect(q.state.limit).toBe(1);
  });

  it('find narrows by primary key with terminalKind find', () => {
    const q = CollectionQuery.fromModel(Todo as any).find(42);
    expect(q.terminalKind).toBe('find');
    expect(q.state.filter).toEqual({ id: 42 });
  });

  it('findOrFail with terminalKind findOrFail', () => {
    const q = CollectionQuery.fromModel(Todo as any).findOrFail({ slug: 'abc' });
    expect(q.terminalKind).toBe('findOrFail');
    expect(q.state.filter).toEqual({ slug: 'abc' });
  });

  it('find composes with prior chain ops', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .find(7);
    // Both the active filter and the id filter should be present (AND-merged).
    // mergeFilters flat-merges disjoint columns.
    expect(q.state.filter).toEqual({ active: true, id: 7 });
  });
});

describe('InstanceQuery materialize', () => {
  class FixtureModel extends ModelClass {
    static tableName = 'items';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = new MemoryConnector({
      storage: { items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] },
    });
  }

  it('first() returns the first row hydrated as a Model instance', async () => {
    const result = await CollectionQuery.fromModel(FixtureModel as any).first();
    expect(result).toBeInstanceOf(FixtureModel);
    expect((result as any).id).toBe(1);
  });

  it('findBy returns undefined when no row matches', async () => {
    const result = await CollectionQuery.fromModel(FixtureModel as any).findBy({ id: 999 });
    expect(result).toBeUndefined();
  });

  it('find throws NotFoundError when no row matches', async () => {
    const q = CollectionQuery.fromModel(FixtureModel as any).find(999);
    await expect(q).rejects.toThrow(/not found/i);
  });

  it('findOrFail throws NotFoundError when no row matches', async () => {
    const q = CollectionQuery.fromModel(FixtureModel as any).findOrFail({ id: 999 });
    await expect(q).rejects.toThrow(/not found/i);
  });

  it('findOrFail returns the row when one matches', async () => {
    const result = await CollectionQuery.fromModel(FixtureModel as any).findOrFail({ id: 1 });
    expect(result).toBeInstanceOf(FixtureModel);
  });
});
