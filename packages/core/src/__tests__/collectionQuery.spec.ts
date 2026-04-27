import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ModelClass } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';

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

  it('tolerates a Model class with uninitialized array statics', () => {
    class Bare extends ModelClass {
      static tableName = 'bare';
      static keys = { id: 1 } as any;
      static connector = { query: async () => [] } as any;
    }
    expect(() => CollectionQuery.fromModel(Bare as any)).not.toThrow();
    const q = CollectionQuery.fromModel(Bare as any);
    expect(q.state.order).toEqual([]);
    expect(q.state.selectedIncludes).toEqual([]);
    expect(q.state.pendingJoins).toEqual([]);
    expect(q.state.softDelete).toBe(false);
  });
});

describe('CollectionQuery thenable contract', () => {
  // Stub-driven tests: Task 23 will replace materialize() with the real
  // queryScoped path. These guard the thenable interface stays intact.
  class StubMaterialize<Items> extends CollectionQuery<Items> {
    constructor(model: any, state: any, private stub: () => Promise<Items>) {
      super(model, state);
    }
    protected materialize() {
      if (!this.memo) this.memo = this.stub();
      return this.memo;
    }
  }

  const seedState = (M: any) => CollectionQuery.fromModel(M).state;

  it('await resolves to the materialize() result', async () => {
    const q = new StubMaterialize(Todo as any, seedState(Todo), async () => [
      { id: 1 },
    ] as unknown[]);
    expect(await q).toEqual([{ id: 1 }]);
  });

  it('memoizes — multiple awaits trigger materialize once', async () => {
    let calls = 0;
    const q = new StubMaterialize(Todo as any, seedState(Todo), async () => {
      calls += 1;
      return [];
    });
    await q;
    await q;
    expect(calls).toBe(1);
  });

  it('catch routes rejections through the chain', async () => {
    const q = new StubMaterialize(Todo as any, seedState(Todo), async () => {
      throw new Error('boom');
    });
    const recovered = await q.catch((e: Error) => e.message);
    expect(recovered).toBe('boom');
  });
});

describe('CollectionQuery materialize', () => {
  class TestModel extends ModelClass {
    static tableName = 'items';
    static keys = { id: 1 } as any;
    static order = [] as any;
    // connector populated per-test
    static connector = new MemoryConnector({
      storage: { items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] },
    });
  }

  it('awaiting CollectionQuery materializes via connector.queryScoped', async () => {
    const items = await CollectionQuery.fromModel(TestModel as any);
    expect(items).toHaveLength(2);
  });

  it('hydrates rows into Model instances', async () => {
    const items = (await CollectionQuery.fromModel(TestModel as any)) as any[];
    expect(items[0]).toBeInstanceOf(TestModel);
    expect(items[0].name).toBe('a');
  });

  it('honours filterBy when materializing', async () => {
    const items = (await CollectionQuery.fromModel(TestModel as any).filterBy({ id: 1 })) as any[];
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(1);
  });

  it('short-circuits when state.nullScoped is true (returns empty without hitting connector)', async () => {
    const items = await CollectionQuery.fromModel(TestModel as any).none();
    expect(items).toEqual([]);
  });
});

describe('bare Model class is not thenable', () => {
  // The base class itself is intentionally NOT a PromiseLike — only
  // CollectionQuery / InstanceQuery / ScalarQuery (returned by chain methods)
  // are. Awaiting a bare class is a runtime no-op (typeof Class is 'function')
  // and resolves to the class itself, NOT a record list. Users must call at
  // least one chain method (`.all()`, `.filterBy(...)`, etc.) to obtain a
  // thenable builder. This test pins the invariant.
  class BareTodo extends ModelClass {
    static tableName = 'bare-todos';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = new MemoryConnector({ storage: { 'bare-todos': [{ id: 1 }] } });
  }

  it('await on the bare Model class does not return records (use .all())', async () => {
    const result = await BareTodo;
    // `await` on a non-thenable resolves to the value itself — i.e. the class.
    expect(result).toBe(BareTodo);
    // Sanity: the same class has working chain methods that DO return records.
    const items = await CollectionQuery.fromModel(BareTodo as any).all();
    expect(items).toHaveLength(1);
  });
});
