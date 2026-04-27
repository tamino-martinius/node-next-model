import { describe, expect, it } from 'vitest';
import { MemoryConnector } from '../MemoryConnector.js';
import { ModelClass } from '../Model.js';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ColumnQuery } from '../query/ColumnQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('CollectionQuery.pluck', () => {
  it('returns ColumnQuery with column projection', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ active: true })
      .pluck('email');
    expect(q).toBeInstanceOf(ColumnQuery);
    expect(q.column).toBe('email');
    expect(q.projection).toEqual({ kind: 'column', column: 'email' });
    expect(q.state.filter).toEqual({ active: true });
  });
});

describe('InstanceQuery.pluck', () => {
  it('returns ScalarQuery with column projection (single-record)', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .first()
      .pluck('email');
    expect(q).toBeInstanceOf(ScalarQuery);
    expect(q.projection).toEqual({ kind: 'column', column: 'email' });
    expect(q.state.limit).toBe(1);
  });
});

describe('ColumnQuery materialize', () => {
  class TestModel extends ModelClass {
    static tableName = 'items';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = new MemoryConnector({
      storage: {
        items: [
          { id: 1, email: 'a@b' },
          { id: 2, email: 'c@d' },
        ],
      },
    });
  }

  it('pluck materializes to an array of column values', async () => {
    const emails = await CollectionQuery.fromModel(TestModel as any).pluck('email');
    expect(emails).toEqual(['a@b', 'c@d']);
  });

  it('honours filterBy when materializing', async () => {
    const emails = await CollectionQuery.fromModel(TestModel as any)
      .filterBy({ id: 1 })
      .pluck('email');
    expect(emails).toEqual(['a@b']);
  });

  it('nullScoped short-circuits to empty array', async () => {
    const emails = await CollectionQuery.fromModel(TestModel as any)
      .none()
      .pluck('email');
    expect(emails).toEqual([]);
  });
});

describe('InstanceQuery.pluck materialize', () => {
  class TestModel extends ModelClass {
    static tableName = 'items2';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = new MemoryConnector({
      storage: { items2: [{ id: 1, email: 'first@b' }] },
    });
  }

  it('first().pluck materializes to a single column value', async () => {
    const email = await CollectionQuery.fromModel(TestModel as any)
      .first()
      .pluck('email');
    expect(email).toBe('first@b');
  });

  it('returns undefined when no row matches', async () => {
    const email = await CollectionQuery.fromModel(TestModel as any)
      .filterBy({ id: 999 })
      .first()
      .pluck('email');
    expect(email).toBeUndefined();
  });
});
