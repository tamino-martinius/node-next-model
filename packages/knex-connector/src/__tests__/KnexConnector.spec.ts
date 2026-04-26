import { runModelConformance } from '@next-model/conformance';
import { FilterError, Model } from '@next-model/core';
import type { Knex } from 'knex';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KnexConnector } from '../index.js';

const TEST_CLIENT = process.env.KNEX_TEST_CLIENT ?? 'sqlite3';

function buildConnector(): KnexConnector {
  switch (TEST_CLIENT) {
    case 'sqlite3':
      return new KnexConnector({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });
    case 'pg':
      return new KnexConnector({
        client: 'pg',
        connection:
          process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
        pool: { min: 1, max: 1 },
      });
    case 'mysql2':
      return new KnexConnector({
        client: 'mysql2',
        connection: process.env.DATABASE_URL ?? 'mysql://root:mysql@127.0.0.1:3306/test',
        pool: { min: 1, max: 1 },
      });
    default:
      throw new Error(`Unknown KNEX_TEST_CLIENT: ${TEST_CLIENT}`);
  }
}

const connector = buildConnector();

const tableName = 'users';

class User extends Model({
  tableName,
  init: (props: { name: string | null; age: number }) => props,
  connector,
}) {}

async function seedTable(): Promise<void> {
  await connector.knex.schema.dropTableIfExists(tableName);
  await connector.knex.schema.createTable(tableName, (table: Knex.CreateTableBuilder) => {
    table.increments('id').primary().unsigned();
    table.string('name');
    table.integer('age');
    table.dateTime('createdAt');
    table.dateTime('updatedAt');
  });
}

async function dropTable(): Promise<void> {
  await connector.knex.schema.dropTableIfExists(tableName);
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
const sortedIds = (rows: { id: number }[]) =>
  ids(rows)
    .slice()
    .sort((a, b) => a - b);

afterEach(dropTable);
afterAll(() => connector.knex.destroy());

describe('KnexConnector', () => {
  describe('#query', () => {
    beforeEach(seed);

    it('returns all rows for an empty filter', async () => {
      const rows = await connector.query({ tableName });
      expect(sortedIds(rows as any)).toEqual([alice.id, bob.id, carol.id]);
    });

    it('filters by property equality', async () => {
      const rows = await connector.query({ tableName, filter: { age: 21 } });
      expect(sortedIds(rows as any)).toEqual([bob.id, carol.id]);
    });

    it('respects limit and skip', async () => {
      const rows = await connector.query({
        tableName,
        order: [{ key: 'id' }],
        limit: 1,
        skip: 1,
      });
      expect(ids(rows as any)).toEqual([bob.id]);
    });

    it('orders rows ascending by a numeric column', async () => {
      const rows = await connector.query({
        tableName,
        order: [{ key: 'age' }, { key: 'id' }],
      });
      expect(ids(rows as any)).toEqual([alice.id, bob.id, carol.id]);
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
        expect(sortedIds(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$not', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $not: { id: bob.id } },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$in', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $in: { id: [alice.id, carol.id] } },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$notIn', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $notIn: { id: [alice.id] } },
        });
        expect(sortedIds(rows as any)).toEqual([bob.id, carol.id]);
      });

      it('$null', async () => {
        const rows = await connector.query({ tableName, filter: { $null: 'name' } });
        expect(sortedIds(rows as any)).toEqual([bob.id]);
      });

      it('$notNull', async () => {
        const rows = await connector.query({ tableName, filter: { $notNull: 'name' } });
        expect(sortedIds(rows as any)).toEqual([alice.id, carol.id]);
      });

      it('$between', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $between: { age: { from: 20, to: 30 } } },
        });
        expect(sortedIds(rows as any)).toEqual([bob.id, carol.id]);
      });

      it('$notBetween', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $notBetween: { age: { from: 20, to: 30 } } },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id]);
      });

      it('$gt / $gte / $lt / $lte', async () => {
        expect(
          sortedIds((await connector.query({ tableName, filter: { $gt: { age: 20 } } })) as any),
        ).toEqual([bob.id, carol.id]);
        expect(
          sortedIds((await connector.query({ tableName, filter: { $gte: { age: 21 } } })) as any),
        ).toEqual([bob.id, carol.id]);
        expect(
          sortedIds((await connector.query({ tableName, filter: { $lt: { age: 21 } } })) as any),
        ).toEqual([alice.id]);
        expect(
          sortedIds((await connector.query({ tableName, filter: { $lte: { age: 18 } } })) as any),
        ).toEqual([alice.id]);
      });

      it('$like', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $like: { name: 'ali%' } },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id]);
      });

      it('$raw', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $raw: { $query: 'age = ?', $bindings: [18] } },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id]);
      });

      it('$async resolves lazy filters', async () => {
        const rows = await connector.query({
          tableName,
          filter: { $async: Promise.resolve({ age: 18 }) },
        });
        expect(sortedIds(rows as any)).toEqual([alice.id]);
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
      await connector.knex(tableName).del();
      expect(await connector.count({ tableName })).toBe(0);
    });
  });

  describe('#select', () => {
    beforeEach(seed);

    it('returns only the requested columns', async () => {
      const rows = await connector.select({ tableName, order: [{ key: 'id' }] }, 'name');
      expect(rows).toEqual([{ name: 'alice' }, { name: null }, { name: 'bar' }]);
    });

    it('respects filter and order', async () => {
      const rows = await connector.select(
        { tableName, filter: { age: 21 }, order: [{ key: 'id' }] },
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
      const allRows = await connector.query({ tableName });
      expect((allRows as any[]).filter((r) => r.name === 'renamed')).toHaveLength(2);
    });

    it('leaves non-matching rows unchanged', async () => {
      await connector.updateAll({ tableName, filter: { id: alice.id } }, { name: 'renamed' });
      const row = await connector.knex(tableName).where({ id: bob.id }).first();
      expect(row.name).toBeNull();
    });

    it('returns an empty array when no rows match', async () => {
      const updated = await connector.updateAll(
        { tableName, filter: { age: 999 } },
        { name: 'unused' },
      );
      expect(updated).toEqual([]);
    });
  });

  describe('#deleteAll', () => {
    beforeEach(seed);

    it('deletes matching rows and returns what was deleted', async () => {
      const deleted = await connector.deleteAll({ tableName, filter: { age: 21 } });
      expect(sortedIds(deleted as any)).toEqual([bob.id, carol.id]);
      const remaining = await connector.query({ tableName });
      expect(sortedIds(remaining as any)).toEqual([alice.id]);
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

  describe('#upsert', () => {
    const upsertTable = 'upsert_tags';

    beforeEach(async () => {
      await connector.knex.schema.dropTableIfExists(upsertTable);
      await connector.knex.schema.createTable(upsertTable, (t: Knex.CreateTableBuilder) => {
        t.increments('id').primary().unsigned();
        t.string('slug').unique();
        t.string('name');
      });
    });

    afterEach(async () => {
      await connector.knex.schema.dropTableIfExists(upsertTable);
    });

    it('exposes the upsert capability', () => {
      expect(typeof connector.upsert).toBe('function');
    });

    it('inserts new rows, returns them with generated ids', async () => {
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [
          { slug: 'js', name: 'JavaScript' },
          { slug: 'rb', name: 'Ruby' },
        ],
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => typeof r.id === 'number')).toBe(true);
      expect(rows.map((r) => r.slug)).toEqual(['js', 'rb']);
    });

    it('updates existing rows on conflict and preserves input order', async () => {
      await connector.batchInsert(upsertTable, { id: 1 } as any, [
        { slug: 'js', name: 'JS' },
        { slug: 'rb', name: 'RB' },
      ]);
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [
          { slug: 'rb', name: 'Ruby' },
          { slug: 'js', name: 'JavaScript' },
          { slug: 'py', name: 'Python' },
        ],
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows.map((r) => r.slug)).toEqual(['rb', 'js', 'py']);
      expect(rows.map((r) => r.name)).toEqual(['Ruby', 'JavaScript', 'Python']);
      expect(await connector.count({ tableName: upsertTable })).toBe(3);
    });

    it('runs in a single statement for bulk inputs (1000+ rows)', async () => {
      const input = Array.from({ length: 1000 }, (_, i) => ({
        slug: `slug-${i}`,
        name: `name-${i}`,
      }));
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: input,
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows).toHaveLength(1000);
      expect(await connector.count({ tableName: upsertTable })).toBe(1000);
    });

    it('honors ignoreOnly with DO NOTHING — conflicting rows are returned unchanged', async () => {
      await connector.batchInsert(upsertTable, { id: 1 } as any, [{ slug: 'js', name: 'JS' }]);
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [
          { slug: 'js', name: 'OVERWRITE' },
          { slug: 'rb', name: 'Ruby' },
        ],
        conflictTarget: ['slug'],
        ignoreOnly: true,
      });
      expect(rows.find((r) => r.slug === 'js')?.name).toBe('JS');
      expect(rows.find((r) => r.slug === 'rb')?.name).toBe('Ruby');
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
      expect(await connector.aggregate({ tableName, filter: { age: 999 } }, 'sum', 'age')).toBe(
        undefined,
      );
    });
  });

  describe('#execute', () => {
    beforeEach(seed);

    it('runs raw SQL with positional bindings', async () => {
      const rows = await connector.execute('SELECT * FROM users WHERE age = ?', [18]);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('alice');
    });

    it('runs raw SQL with named bindings', async () => {
      const rows = await connector.execute('SELECT * FROM users WHERE age = :age', {
        age: 18,
      } as any);
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

runModelConformance({
  name: `KnexConnector (${TEST_CLIENT})`,
  makeConnector: () => connector,
});
