import { FilterError, Model } from '@next-model/core';
import type Knex from 'knex';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataApiConnector } from '../index.js';
import { MockDataApiClient } from '../MockDataApiClient.js';

const mockClient = new MockDataApiClient();
const connector = new DataApiConnector({ client: mockClient });

const tableName = 'users';

class User extends Model({
  tableName,
  init: (props: { name: string | null; age: number }) => props,
  connector,
}) {}

async function seedTable(): Promise<void> {
  await mockClient.knex.schema.dropTableIfExists(tableName);
  await mockClient.knex.schema.createTable(tableName, (table: Knex.CreateTableBuilder) => {
    table.increments('id').primary().unsigned();
    table.string('name');
    table.integer('age');
    table.dateTime('createdAt');
    table.dateTime('updatedAt');
  });
}

async function dropTable(): Promise<void> {
  await mockClient.knex.schema.dropTableIfExists(tableName);
}

let alice: User;
let bob: User;
let carol: User;

async function seed(): Promise<void> {
  await seedTable();
  alice = await User.create({ name: 'alice', age: 18 });
  bob = await User.create({ name: null, age: 21 });
  carol = await User.create({ name: 'bar', age: 21 });
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

afterEach(dropTable);
afterAll(() => mockClient.destroy());

describe('DataApiConnector', () => {
  describe('#query', () => {
    beforeEach(seed);

    it('returns all rows for an empty filter', async () => {
      const rows = await connector.query({ tableName });
      expect(ids(rows as any)).toEqual([alice.id, bob.id, carol.id]);
    });

    it('filters by property equality', async () => {
      const rows = await connector.query({ tableName, filter: { age: 21 } });
      expect(ids(rows as any)).toEqual([bob.id, carol.id]);
    });

    it('respects limit and skip', async () => {
      const rows = await connector.query({ tableName, limit: 1, skip: 1 });
      expect(ids(rows as any)).toEqual([bob.id]);
    });

    it('orders rows', async () => {
      const rows = await connector.query({ tableName, order: [{ key: 'name' }] });
      expect((rows as any[]).map((r) => r.name)).toEqual([null, 'alice', 'bar']);
    });

    describe('filter operators', () => {
      it('$and', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $and: [{ age: 21 }, { name: 'bar' }] },
        });
        expect(ids(rows as any)).toEqual([carol.id]);
      });

      it('$or', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $or: [{ id: alice.id }, { id: carol.id }] },
        });
        expect(ids(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$not', async () => {
        const rows = await connector.query({ tableName, filter: { $not: { id: bob.id } } });
        expect(ids(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$in', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $in: { id: [alice.id, carol.id] } },
        });
        expect(ids(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$notIn', async () => {
        const rows = await connector.query({ tableName, filter: { $notIn: { id: [alice.id] } } });
        expect(ids(rows as any)).toEqual([bob.id, carol.id]);
      });

      it('$null', async () => {
        const rows = await connector.query({ tableName, filter: { $null: 'name' } });
        expect(ids(rows as any)).toEqual([bob.id]);
      });

      it('$notNull', async () => {
        const rows = await connector.query({ tableName, filter: { $notNull: 'name' } });
        expect(ids(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$between', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $between: { age: { from: 20, to: 30 } } },
        });
        expect(ids(rows as any)).toEqual([bob.id, carol.id]);
      });

      it('$notBetween', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $notBetween: { age: { from: 20, to: 30 } } },
        });
        expect(ids(rows as any)).toEqual([alice.id]);
      });

      it('$gt / $gte / $lt / $lte', async () => {
        expect(
          ids((await connector.query({ tableName, filter: { $gt: { age: 20 } } })) as any),
        ).toEqual([bob.id, carol.id]);
        expect(
          ids((await connector.query({ tableName, filter: { $gte: { age: 21 } } })) as any),
        ).toEqual([bob.id, carol.id]);
        expect(
          ids((await connector.query({ tableName, filter: { $lt: { age: 21 } } })) as any),
        ).toEqual([alice.id]);
        expect(
          ids((await connector.query({ tableName, filter: { $lte: { age: 18 } } })) as any),
        ).toEqual([alice.id]);
      });

      it('$like', async () => {
        const rows = await connector.query({ tableName, filter: { $like: { name: 'ali%' } } });
        expect(ids(rows as any)).toEqual([alice.id]);
      });

      it('$raw', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $raw: { $query: 'age = ?', $bindings: [18] } },
        });
        expect(ids(rows as any)).toEqual([alice.id]);
      });

      it('$async resolves lazy filters', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $async: Promise.resolve({ age: 18 }) },
        });
        expect(ids(rows as any)).toEqual([alice.id]);
      });

      it('rejects filter with multiple keys in $gt with FilterError', async () => {
        await expect(
          connector.query({ tableName, filter: { $gt: { age: 20, id: 1 } } }),
        ).rejects.toBeInstanceOf(FilterError);
      });

      it('rejects filter with zero keys in $in with FilterError', async () => {
        await expect(connector.query({ tableName, filter: { $in: {} } })).rejects.toBeInstanceOf(
          FilterError,
        );
      });
    });
  });

  describe('#count', () => {
    beforeEach(seed);

    it('returns total row count as a number', async () => {
      const count = await connector.count({ tableName });
      expect(count).toBe(3);
      expect(typeof count).toBe('number');
    });

    it('respects a filter', async () => {
      expect(await connector.count({ tableName, filter: { age: 21 } })).toBe(2);
      expect(await connector.count({ tableName, filter: { $null: 'name' } })).toBe(1);
    });

    it('returns 0 for an empty table', async () => {
      await connector.deleteAll({ tableName });
      expect(await connector.count({ tableName })).toBe(0);
    });
  });

  describe('#select', () => {
    beforeEach(seed);

    it('returns only the requested columns', async () => {
      const rows = await connector.select({ tableName }, 'name');
      expect(rows).toEqual([{ name: 'alice' }, { name: null }, { name: 'bar' }]);
    });

    it('respects filter and order', async () => {
      const rows = await connector.select(
        { tableName, filter: { age: 21 }, order: [{ key: 'name' }] },
        'name',
        'age',
      );
      expect(rows).toEqual([
        { name: null, age: 21 },
        { name: 'bar', age: 21 },
      ]);
    });
  });

  describe('#updateAll', () => {
    beforeEach(seed);

    it('updates matching rows and returns them', async () => {
      const updated = await connector.updateAll(
        { tableName, filter: { age: 21 } },
        { name: 'renamed' },
      );
      expect(updated).toHaveLength(2);
      expect(updated.every((r) => r.name === 'renamed')).toBe(true);
    });

    it('leaves non-matching rows unchanged', async () => {
      await connector.updateAll({ tableName, filter: { id: alice.id } }, { name: 'renamed' });
      const bobRow = await connector.query({ tableName, filter: { id: bob.id } });
      expect((bobRow[0] as any).name).toBeNull();
    });

    it('returns an empty array when no rows match', async () => {
      const updated = await connector.updateAll(
        { tableName, filter: { age: 999 } },
        { name: 'unused' },
      );
      expect(updated).toEqual([]);
    });
  });

  describe('#atomicUpdate', () => {
    beforeEach(seed);

    it('exposes an atomicUpdate method', () => {
      expect(typeof connector.atomicUpdate).toBe('function');
    });

    it('applies a positive delta in a single round-trip', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { id: alice.id },
        deltas: [{ column: 'age', by: 4 }],
      });
      expect(affected).toBe(1);
      const reloaded = await connector.query({ tableName, filter: { id: alice.id } });
      expect((reloaded[0] as any).age).toBe(22);
    });

    it('applies a negative delta', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { id: bob.id },
        deltas: [{ column: 'age', by: -1 }],
      });
      expect(affected).toBe(1);
      const reloaded = await connector.query({ tableName, filter: { id: bob.id } });
      expect((reloaded[0] as any).age).toBe(20);
    });

    it('updates every matching row and returns the affected count', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { age: 21 },
        deltas: [{ column: 'age', by: 5 }],
      });
      expect(affected).toBe(2);
      const ages = (await connector.query({ tableName, filter: { age: 26 } })).map(
        (r: any) => r.age,
      );
      expect(ages).toEqual([26, 26]);
    });

    it('applies absolute set fields alongside deltas', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { id: alice.id },
        deltas: [{ column: 'age', by: 1 }],
        set: { name: 'renamed' },
      });
      expect(affected).toBe(1);
      const reloaded = await connector.query({ tableName, filter: { id: alice.id } });
      expect((reloaded[0] as any).age).toBe(19);
      expect((reloaded[0] as any).name).toBe('renamed');
    });

    it('returns 0 when no row matches', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { id: 999_999 },
        deltas: [{ column: 'age', by: 1 }],
      });
      expect(affected).toBe(0);
    });

    it('is a no-op when both deltas and set are empty', async () => {
      const affected = await connector.atomicUpdate({
        tableName,
        filter: { id: alice.id },
        deltas: [],
      });
      expect(affected).toBe(0);
    });
  });

  describe('#deleteAll', () => {
    beforeEach(seed);

    it('deletes matching rows and returns what was deleted', async () => {
      const deleted = await connector.deleteAll({ tableName, filter: { age: 21 } });
      expect(ids(deleted as any).sort()).toEqual([bob.id, carol.id].sort());
      const remaining = await connector.query({ tableName });
      expect(ids(remaining as any)).toEqual([alice.id]);
    });

    it('returns an empty array when no rows match', async () => {
      const deleted = await connector.deleteAll({ tableName, filter: { id: 9999 } });
      expect(deleted).toEqual([]);
    });
  });

  describe('#batchInsert', () => {
    beforeEach(seedTable);

    it('inserts one row and returns it with generated id', async () => {
      const rows = await connector.batchInsert(tableName, { id: 1 } as any, [
        { name: 'solo', age: 42 },
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBeGreaterThan(0);
      expect(rows[0].name).toBe('solo');
      expect(rows[0].age).toBe(42);
    });

    it('inserts many rows in a single call and preserves order', async () => {
      const rows = await connector.batchInsert(tableName, { id: 1 } as any, [
        { name: 'a', age: 1 },
        { name: 'b', age: 2 },
        { name: 'c', age: 3 },
      ]);
      expect(rows.map((r) => r.name)).toEqual(['a', 'b', 'c']);
      expect(rows.every((r) => typeof r.id === 'number')).toBe(true);
    });

    it('returns an empty array for an empty items list', async () => {
      const rows = await connector.batchInsert(tableName, { id: 1 } as any, []);
      expect(rows).toEqual([]);
    });
  });

  describe('#aggregate', () => {
    beforeEach(seed);

    it('computes sum', async () => {
      expect(await connector.aggregate({ tableName }, 'sum', 'age')).toBe(60);
    });

    it('computes min', async () => {
      expect(await connector.aggregate({ tableName }, 'min', 'age')).toBe(18);
    });

    it('computes max', async () => {
      expect(await connector.aggregate({ tableName }, 'max', 'age')).toBe(21);
    });

    it('computes avg', async () => {
      expect(await connector.aggregate({ tableName }, 'avg', 'age')).toBe(20);
    });

    it('respects filter scope', async () => {
      expect(await connector.aggregate({ tableName, filter: { age: 21 } }, 'sum', 'age')).toBe(42);
    });

    it('returns undefined when no rows match', async () => {
      expect(
        await connector.aggregate({ tableName, filter: { age: 999 } }, 'sum', 'age'),
      ).toBeUndefined();
    });
  });

  describe('#execute', () => {
    beforeEach(seed);

    it('runs raw SQL with positional bindings', async () => {
      const rows = await connector.execute('SELECT * FROM users WHERE age = ?', [18]);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('alice');
    });
  });

  describe('#transaction', () => {
    beforeEach(seed);

    it('commits when the callback resolves', async () => {
      await connector.transaction(async () => {
        await User.create({ name: 'dave', age: 30 });
        await User.create({ name: 'erin', age: 31 });
      });
      expect(await User.count()).toBe(5);
    });

    it('rolls back when the callback throws', async () => {
      await expect(
        connector.transaction(async () => {
          await User.create({ name: 'fred', age: 40 });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await User.count()).toBe(3);
      const names = (await User.all()).map((u) => u.name);
      expect(names).not.toContain('fred');
    });

    it('nests by joining the outer transaction (inner rollback affects outer)', async () => {
      await expect(
        connector.transaction(async () => {
          await User.create({ name: 'outer', age: 50 });
          await connector.transaction(async () => {
            await User.create({ name: 'inner', age: 51 });
            throw new Error('inner failure');
          });
        }),
      ).rejects.toThrow('inner failure');
      expect(await User.count()).toBe(3);
      const names = (await User.all()).map((u) => u.name);
      expect(names).not.toContain('outer');
      expect(names).not.toContain('inner');
    });
  });
});
