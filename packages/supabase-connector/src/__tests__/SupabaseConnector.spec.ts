import { defineSchema, UnsupportedOperationError } from '@next-model/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyFilters } from '../filters.js';
import { MockSupabaseClient } from '../MockSupabaseClient.js';
import { SupabaseConnector } from '../SupabaseConnector.js';
import type { PostgrestBuilderLike } from '../types.js';
import { harnesses } from './harness.js';

const schema = defineSchema({
  cats: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

describe('SupabaseConnector construction', () => {
  it('accepts a bare client', () => {
    const c = new SupabaseConnector(new MockSupabaseClient());
    expect(c).toBeInstanceOf(SupabaseConnector);
  });
  it('accepts a { client } wrapper and exposes the attached schema', () => {
    const c = new SupabaseConnector({ client: new MockSupabaseClient() }, { schema });
    expect(c.schema).toBe(schema);
  });
  it('resolves the primary key from the attached schema', () => {
    const c = new SupabaseConnector(new MockSupabaseClient(), { schema }) as unknown as {
      pk(t: string): string;
    };
    expect(c.pk('cats')).toBe('id');
    expect(c.pk('unknown')).toBe('id');
  });
});

describe('applyFilters', () => {
  function recorder() {
    const calls: Array<[string, unknown[]]> = [];
    const b = new Proxy({} as PostgrestBuilderLike, {
      get(_t, prop: string) {
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return b;
        };
      },
    });
    return { b, calls };
  }

  it('maps equality and comparison operators', () => {
    const { b, calls } = recorder();
    applyFilters(b, { name: 'ada', $gte: { age: 5 }, $lt: { age: 10 } });
    expect(calls).toContainEqual(['eq', ['name', 'ada']]);
    expect(calls).toContainEqual(['gte', ['age', 5]]);
    expect(calls).toContainEqual(['lt', ['age', 10]]);
  });

  it('maps $in / $null / $between / $or', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $in: { age: [1, 2] } });
    expect(calls).toContainEqual(['in', ['age', [1, 2]]]);
    const r2 = recorder();
    applyFilters(r2.b, { $null: 'name' });
    expect(r2.calls).toContainEqual(['is', ['name', null]]);
    const r3 = recorder();
    applyFilters(r3.b, { $between: { age: { from: 1, to: 9 } } });
    expect(r3.calls).toContainEqual(['gte', ['age', 1]]);
    expect(r3.calls).toContainEqual(['lte', ['age', 9]]);
    const r4 = recorder();
    applyFilters(r4.b, { $or: [{ name: 'a' }, { $gt: { age: 3 } }] });
    expect(r4.calls).toContainEqual(['or', ['name.eq.a,age.gt.3']]);
  });

  it('maps $notBetween to an OR of lt/gt bounds', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $notBetween: { age: { from: 1, to: 9 } } });
    expect(calls).toContainEqual(['or', ['age.lt.1,age.gt.9']]);
  });

  it('maps $not over a nested comparison operator', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $not: { $gt: { age: 5 } } });
    expect(calls).toContainEqual(['not', ['age', 'gt', 5]]);
  });

  it('maps $not over plain equality', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $not: { name: 'ada' } });
    expect(calls).toContainEqual(['not', ['name', 'eq', 'ada']]);
  });

  it('throws FilterError on $not over an unsupported operator', () => {
    const { b } = recorder();
    expect(() => applyFilters(b, { $not: { $or: [] } })).toThrow();
  });

  it('groups multi-condition $or branches with AND', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $or: [{ name: 'a', age: 5 }, { active: true }] });
    expect(calls).toContainEqual(['or', ['and(name.eq.a,age.eq.5),active.eq.true']]);
  });

  it('maps $notIn / $notNull / $like', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $notIn: { age: [1, 2] } });
    expect(calls).toContainEqual(['not', ['age', 'in', '(1,2)']]);
    const r2 = recorder();
    applyFilters(r2.b, { $notNull: 'name' });
    expect(r2.calls).toContainEqual(['not', ['name', 'is', null]]);
    const r3 = recorder();
    applyFilters(r3.b, { $like: { name: 'a%' } });
    expect(r3.calls).toContainEqual(['like', ['name', 'a%']]);
  });

  it('throws FilterError on $raw', () => {
    const { b } = recorder();
    expect(() => applyFilters(b, { $raw: { $query: 'age > 1' } } as never)).toThrow();
  });

  it('throws FilterError on $async', () => {
    const { b } = recorder();
    expect(() => applyFilters(b, { $async: Promise.resolve({}) } as never)).toThrow();
  });
});

for (const harness of harnesses) {
  describe(`SupabaseConnector CRUD — ${harness.name}`, () => {
    let h: Awaited<ReturnType<typeof harness.makeConnector>>;
    beforeEach(async () => {
      h = await harness.makeConnector();
      await h.provision(
        'CREATE TABLE cats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)',
      );
      // Seed via raw provision SQL so this task does not depend on batchInsert
      // (added in Task 6). Ids land as 1=ada, 2=bo, 3=cy.
      await h.provision("INSERT INTO cats (name, age) VALUES ('ada', 3), ('bo', 7), ('cy', 5)");
    });
    afterEach(() => h.teardown());

    it('queries with filter + order + limit', async () => {
      const rows = await h.connector.query({
        tableName: 'cats',
        filter: { $gte: { age: 5 } },
        order: [{ key: 'age', dir: -1 }],
        limit: 1,
      });
      expect(rows).toEqual([{ id: 2, name: 'bo', age: 7 }]);
    });

    it('counts with a filter', async () => {
      expect(await h.connector.count({ tableName: 'cats', filter: { $gt: { age: 4 } } })).toBe(2);
    });

    it('selects specific columns', async () => {
      const rows = await h.connector.select({ tableName: 'cats', filter: { name: 'ada' } }, 'name');
      expect(rows).toEqual([{ name: 'ada' }]);
    });

    it('batchInsert returns inserted rows; empty input returns []', async () => {
      expect(await h.connector.batchInsert('cats', {}, [])).toEqual([]);
      const rows = await h.connector.batchInsert('cats', {}, [{ name: 'di', age: 1 }]);
      expect(rows).toEqual([{ id: 4, name: 'di', age: 1 }]);
    });

    it('updateAll updates matching rows and returns them', async () => {
      const rows = await h.connector.updateAll(
        { tableName: 'cats', filter: { name: 'ada' } },
        { age: 4 },
      );
      expect(rows).toEqual([{ id: 1, name: 'ada', age: 4 }]);
    });

    it('updateAll with empty attrs returns the matched rows unchanged', async () => {
      const rows = await h.connector.updateAll({ tableName: 'cats', filter: { name: 'bo' } }, {});
      expect(rows).toEqual([{ id: 2, name: 'bo', age: 7 }]);
    });

    it('deleteAll deletes matching rows and returns them', async () => {
      const rows = await h.connector.deleteAll({ tableName: 'cats', filter: { name: 'cy' } });
      expect(rows).toEqual([{ id: 3, name: 'cy', age: 5 }]);
      expect(await h.connector.count({ tableName: 'cats' })).toBe(2);
    });

    it('aggregates sum/min/max/avg client-side, undefined on empty', async () => {
      expect(await h.connector.aggregate({ tableName: 'cats' }, 'sum', 'age')).toBe(15);
      expect(await h.connector.aggregate({ tableName: 'cats' }, 'min', 'age')).toBe(3);
      expect(await h.connector.aggregate({ tableName: 'cats' }, 'max', 'age')).toBe(7);
      expect(await h.connector.aggregate({ tableName: 'cats' }, 'avg', 'age')).toBe(5);
      expect(
        await h.connector.aggregate({ tableName: 'cats', filter: { age: 999 } }, 'sum', 'age'),
      ).toBeUndefined();
    });

    it('deltaUpdate increments matching rows and returns the count', async () => {
      const n = await h.connector.deltaUpdate({
        tableName: 'cats',
        filter: { name: 'ada' },
        deltas: [{ column: 'age', by: 10 }],
      });
      expect(n).toBe(1);
      const [ada] = await h.connector.query({ tableName: 'cats', filter: { name: 'ada' } });
      expect(ada.age).toBe(13);
    });
  });

  describe(`SupabaseConnector upsert — ${harness.name}`, () => {
    let h: Awaited<ReturnType<typeof harness.makeConnector>>;
    beforeEach(async () => {
      h = await harness.makeConnector();
      await h.provision(
        'CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT)',
      );
      await h.connector.batchInsert('items', {}, [{ slug: 'a', name: 'first' }]);
    });
    afterEach(() => h.teardown());

    it('inserts new and updates conflicting, in input order', async () => {
      const rows = await h.connector.upsert({
        tableName: 'items',
        keys: {},
        rows: [
          { slug: 'a', name: 'updated' },
          { slug: 'b', name: 'new' },
        ],
        conflictTarget: ['slug'],
      });
      expect(rows.map((r) => [r.slug, r.name])).toEqual([
        ['a', 'updated'],
        ['b', 'new'],
      ]);
    });

    it('ignoreOnly keeps existing values and returns them', async () => {
      const rows = await h.connector.upsert({
        tableName: 'items',
        keys: {},
        rows: [{ slug: 'a', name: 'ignored' }],
        conflictTarget: ['slug'],
        ignoreOnly: true,
      });
      expect(rows[0].name).toBe('first');
    });

    it('updateColumns restricts which columns change on conflict', async () => {
      await h.provision('ALTER TABLE items ADD COLUMN note TEXT');
      await h.connector.updateAll({ tableName: 'items', filter: { slug: 'a' } }, { note: 'keep' });
      const rows = await h.connector.upsert({
        tableName: 'items',
        keys: {},
        rows: [{ slug: 'a', name: 'renamed', note: 'DROP' }],
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows[0].name).toBe('renamed');
      expect(rows[0].note).toBe('keep');
    });

    it('handles a multi-column conflict target, returning both rows in input order', async () => {
      await h.provision('CREATE TABLE pairs (a TEXT, b TEXT, label TEXT, PRIMARY KEY (a, b))');
      await h.provision("INSERT INTO pairs (a, b, label) VALUES ('x', 'y', 'orig')");
      const rows = await h.connector.upsert({
        tableName: 'pairs',
        keys: {},
        rows: [
          { a: 'x', b: 'y', label: 'updated' },
          { a: 'x', b: 'z', label: 'new' },
        ],
        conflictTarget: ['a', 'b'],
      });
      expect(rows.map((r) => [r.a, r.b, r.label])).toEqual([
        ['x', 'y', 'updated'],
        ['x', 'z', 'new'],
      ]);
    });

    it('matches an existing row even when the conflict value is submitted with a different type (regression)', async () => {
      await h.provision('CREATE TABLE nums (id INTEGER PRIMARY KEY, name TEXT)');
      await h.provision("INSERT INTO nums (id, name) VALUES (5, 'old')");
      const rows = await h.connector.upsert({
        tableName: 'nums',
        keys: {},
        // `id` submitted as a STRING while the DB column/PK is an INTEGER —
        // the row must still be recognized as a conflict and updated in place,
        // not silently dropped from the returned array.
        rows: [{ id: '5', name: 'new' }],
        conflictTarget: ['id'],
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('new');
    });
  });

  describe(`SupabaseConnector $or multi-key filter — ${harness.name}`, () => {
    let h: Awaited<ReturnType<typeof harness.makeConnector>>;
    beforeEach(async () => {
      h = await harness.makeConnector();
      await h.provision(
        'CREATE TABLE critters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)',
      );
      // Two rows share the name 'ada' at different ages, so a naive parser
      // that shatters the `and(...)` group emitted for the first $or branch
      // would incorrectly match the age-99 row too.
      await h.provision(
        "INSERT INTO critters (name, age) VALUES ('ada', 3), ('ada', 99), ('cy', 5)",
      );
    });
    afterEach(() => h.teardown());

    it('parses a multi-key $or branch (and(...)) alongside a single-key branch', async () => {
      const rows = await h.connector.query({
        tableName: 'critters',
        filter: { $or: [{ name: 'ada', age: 3 }, { name: 'cy' }] },
      });
      expect(rows.map((r) => [r.name, r.age]).sort()).toEqual([
        ['ada', 3],
        ['cy', 5],
      ]);
    });
  });

  describe(`SupabaseConnector unsupported ops — ${harness.name}`, () => {
    let h: Awaited<ReturnType<typeof harness.makeConnector>>;
    beforeEach(async () => {
      h = await harness.makeConnector();
    });
    afterEach(() => h.teardown());

    it('throws UnsupportedOperationError for DDL, execute, transaction', async () => {
      const c = h.connector;
      await expect(c.execute('SELECT 1', [])).rejects.toThrow(UnsupportedOperationError);
      await expect(c.transaction(async () => 1)).rejects.toThrow(UnsupportedOperationError);
      await expect(c.hasTable('cats')).rejects.toThrow(UnsupportedOperationError);
      await expect(c.createTable('cats', () => {})).rejects.toThrow(UnsupportedOperationError);
      await expect(c.dropTable('cats')).rejects.toThrow(UnsupportedOperationError);
      await expect(c.ensureSchema!()).rejects.toThrow(UnsupportedOperationError);
    });
  });
}
