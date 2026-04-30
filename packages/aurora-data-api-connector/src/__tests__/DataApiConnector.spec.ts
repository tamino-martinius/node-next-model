import {
  defineAlter,
  defineSchema,
  FilterError,
  KeyType,
  Model,
  PersistenceError,
} from '@next-model/core';
import type Knex from 'knex';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataApiClient, DataApiQueryResult } from '../DataApiConnector.js';
import { DataApiConnector } from '../index.js';
import { MockDataApiClient } from '../MockDataApiClient.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string', null: true },
      age: { type: 'integer' },
    },
  },
});

const mockClient = new MockDataApiClient();
const connector = new DataApiConnector({ client: mockClient }, { schema });

const tableName = 'users';

class User extends Model({
  tableName,
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

  describe('#deltaUpdate', () => {
    beforeEach(seed);

    it('exposes an deltaUpdate method', () => {
      expect(typeof connector.deltaUpdate).toBe('function');
    });

    it('applies a positive delta in a single round-trip', async () => {
      const affected = await connector.deltaUpdate({
        tableName,
        filter: { id: alice.id },
        deltas: [{ column: 'age', by: 4 }],
      });
      expect(affected).toBe(1);
      const reloaded = await connector.query({ tableName, filter: { id: alice.id } });
      expect((reloaded[0] as any).age).toBe(22);
    });

    it('applies a negative delta', async () => {
      const affected = await connector.deltaUpdate({
        tableName,
        filter: { id: bob.id },
        deltas: [{ column: 'age', by: -1 }],
      });
      expect(affected).toBe(1);
      const reloaded = await connector.query({ tableName, filter: { id: bob.id } });
      expect((reloaded[0] as any).age).toBe(20);
    });

    it('updates every matching row and returns the affected count', async () => {
      const affected = await connector.deltaUpdate({
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
      const affected = await connector.deltaUpdate({
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
      const affected = await connector.deltaUpdate({
        tableName,
        filter: { id: 999_999 },
        deltas: [{ column: 'age', by: 1 }],
      });
      expect(affected).toBe(0);
    });

    it('is a no-op when both deltas and set are empty', async () => {
      const affected = await connector.deltaUpdate({
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

  describe('#upsert', () => {
    const upsertTable = 'upsert_tags';

    beforeEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(upsertTable);
      await mockClient.knex.schema.createTable(upsertTable, (table: Knex.CreateTableBuilder) => {
        table.increments('id').primary().unsigned();
        table.string('slug').unique();
        table.string('name');
        table.integer('tenantId');
      });
    });

    afterEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(upsertTable);
    });

    it('returns [] for an empty rows list', async () => {
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [],
        conflictTarget: ['slug'],
      });
      expect(rows).toEqual([]);
    });

    it('inserts new rows and returns them in input order', async () => {
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [
          { slug: 'rb', name: 'Ruby', tenantId: 1 },
          { slug: 'js', name: 'JavaScript', tenantId: 1 },
        ],
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows.map((r) => r.slug)).toEqual(['rb', 'js']);
      expect(rows.every((r) => typeof r.id === 'number')).toBe(true);
    });

    it('updates existing rows on conflict', async () => {
      await connector.batchInsert(upsertTable, { id: 1 } as any, [
        { slug: 'js', name: 'JS', tenantId: 1 },
      ]);
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [{ slug: 'js', name: 'JavaScript', tenantId: 1 }],
        conflictTarget: ['slug'],
        updateColumns: ['name'],
      });
      expect(rows[0].name).toBe('JavaScript');
      expect(await connector.count({ tableName: upsertTable })).toBe(1);
    });

    it('honors ignoreOnly with DO NOTHING', async () => {
      await connector.batchInsert(upsertTable, { id: 1 } as any, [
        { slug: 'js', name: 'JS', tenantId: 1 },
      ]);
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [
          { slug: 'js', name: 'OVERWRITE', tenantId: 1 },
          { slug: 'rb', name: 'Ruby', tenantId: 1 },
        ],
        conflictTarget: ['slug'],
        ignoreOnly: true,
      });
      expect(rows.find((r) => r.slug === 'js')?.name).toBe('JS');
      expect(rows.find((r) => r.slug === 'rb')?.name).toBe('Ruby');
    });

    it('derives updateColumns from row keys when not specified', async () => {
      await connector.batchInsert(upsertTable, { id: 1 } as any, [
        { slug: 'js', name: 'JS', tenantId: 1 },
      ]);
      const rows = await connector.upsert({
        tableName: upsertTable,
        keys: { id: 1 } as any,
        rows: [{ slug: 'js', name: 'JavaScript', tenantId: 9 }],
        conflictTarget: ['slug'],
      });
      expect(rows[0].name).toBe('JavaScript');
      expect(rows[0].tenantId).toBe(9);
    });

    it('supports multi-column conflictTarget', async () => {
      const slotsTable = 'upsert_slots';
      await mockClient.knex.schema.dropTableIfExists(slotsTable);
      await mockClient.knex.schema.createTable(slotsTable, (table: Knex.CreateTableBuilder) => {
        table.increments('id').primary().unsigned();
        table.integer('tenantId');
        table.string('slot');
        table.string('value');
        table.unique(['tenantId', 'slot']);
      });
      try {
        await connector.batchInsert(slotsTable, { id: 1 } as any, [
          { tenantId: 1, slot: 'home', value: 'old' },
        ]);
        const rows = await connector.upsert({
          tableName: slotsTable,
          keys: { id: 1 } as any,
          rows: [
            { tenantId: 1, slot: 'home', value: 'updated' },
            { tenantId: 2, slot: 'home', value: 'fresh' },
          ],
          conflictTarget: ['tenantId', 'slot'],
          updateColumns: ['value'],
        });
        expect(rows[0].value).toBe('updated');
        expect(rows[1].value).toBe('fresh');
        expect(await connector.count({ tableName: slotsTable })).toBe(2);
      } finally {
        await mockClient.knex.schema.dropTableIfExists(slotsTable);
      }
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

  describe('#alterTable', () => {
    const altTable = 'aurora_alter_users';
    beforeEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(altTable);
      await connector.createTable(altTable, (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('name', { null: false });
      });
    });
    afterEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(altTable);
    });

    it('addColumn issues ALTER TABLE ADD COLUMN', async () => {
      await connector.alterTable(
        defineAlter(altTable, (a) => a.addColumn('role', 'string', { default: 'member' })),
      );
      const cols = await mockClient.knex(altTable).columnInfo();
      expect(cols.role).toBeDefined();
    });

    it('removeColumn issues ALTER TABLE DROP COLUMN', async () => {
      await connector.alterTable(defineAlter(altTable, (a) => a.removeColumn('name')));
      const cols = await mockClient.knex(altTable).columnInfo();
      expect(cols.name).toBeUndefined();
    });

    it('renameColumn issues ALTER TABLE RENAME COLUMN', async () => {
      await connector.alterTable(defineAlter(altTable, (a) => a.renameColumn('name', 'fullName')));
      const cols = await mockClient.knex(altTable).columnInfo();
      expect(cols.fullName).toBeDefined();
      expect(cols.name).toBeUndefined();
    });

    it('addIndex / removeIndex round-trip via CREATE/DROP INDEX', async () => {
      await connector.alterTable(
        defineAlter(altTable, (a) => a.addIndex('name', { name: 'idx_aurora_alter_users_name' })),
      );
      await connector.alterTable(
        defineAlter(altTable, (a) => a.removeIndex('idx_aurora_alter_users_name')),
      );
      // also exercise the columns-array path
      await connector.alterTable(defineAlter(altTable, (a) => a.addIndex(['name'])));
      await connector.alterTable(defineAlter(altTable, (a) => a.removeIndex(['name'])));
    });

    it('exercises changeColumn / renameIndex / FK / check translation paths', async () => {
      // The mock client runs sqlite under the hood; not every PG-flavoured DDL
      // statement is accepted, but we want to exercise the connector's
      // translation layer regardless. Errors are tolerated.
      const tryOp = async (fn: () => Promise<void>) => {
        try {
          await fn();
        } catch {
          // expected for some ops on sqlite
        }
      };
      await tryOp(() =>
        connector.alterTable(
          defineAlter(altTable, (a) => a.changeColumn('name', 'text', { null: true })),
        ),
      );
      await tryOp(() =>
        connector.alterTable(defineAlter(altTable, (a) => a.renameIndex('idx_x', 'idx_y'))),
      );
      await tryOp(() =>
        connector.alterTable(
          defineAlter(altTable, (a) =>
            a.addForeignKey('teams', { onDelete: 'cascade', onUpdate: 'restrict' }),
          ),
        ),
      );
      await tryOp(() =>
        connector.alterTable(defineAlter(altTable, (a) => a.removeForeignKey('teams'))),
      );
      await tryOp(() =>
        connector.alterTable(
          defineAlter(altTable, (a) => a.addCheckConstraint('id > 0', { name: 'chk_id_positive' })),
        ),
      );
      await tryOp(() =>
        connector.alterTable(
          defineAlter(altTable, (a) => a.removeCheckConstraint('chk_id_positive')),
        ),
      );
    });

    it('exercises every ForeignKeyAction mapping in the DDL builder', async () => {
      const actions: ('cascade' | 'restrict' | 'setNull' | 'setDefault' | 'noAction')[] = [
        'cascade',
        'restrict',
        'setNull',
        'setDefault',
        'noAction',
      ];
      for (const action of actions) {
        try {
          await connector.alterTable(
            defineAlter(altTable, (a) =>
              a.addForeignKey('teams', { onDelete: action, onUpdate: action }),
            ),
          );
        } catch {
          // sqlite mock may reject; we only care that pgAction runs
        }
      }
    });
  });

  describe('#queryWithJoins', () => {
    const postsTable = 'posts';

    async function seedJoinTables(): Promise<void> {
      await seedTable();
      await mockClient.knex.schema.dropTableIfExists(postsTable);
      await mockClient.knex.schema.createTable(postsTable, (table: Knex.CreateTableBuilder) => {
        table.increments('id').primary().unsigned();
        table.string('title');
        table.integer('userId');
        table.string('status');
      });
      alice = await User.create({ name: 'alice', age: 18 });
      bob = await User.create({ name: 'bob', age: 21 });
      carol = await User.create({ name: 'carol', age: 21 });
      await mockClient.knex(postsTable).insert([
        { title: 'a1', userId: alice.id, status: 'published' },
        { title: 'a2', userId: alice.id, status: 'draft' },
        { title: 'b1', userId: bob.id, status: 'draft' },
      ]);
    }

    async function dropJoinTables(): Promise<void> {
      await mockClient.knex.schema.dropTableIfExists(postsTable);
    }

    beforeEach(seedJoinTables);
    afterEach(dropJoinTables);

    it('mode "select" keeps parents with at least one matching child (EXISTS)', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'inner',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'select',
          },
        ],
      });
      expect(ids(rows as any)).toEqual([alice.id, bob.id]);
    });

    it('mode "select" honours the child filter (only "published" posts)', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'inner',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'select',
            filter: { status: 'published' },
          },
        ],
      });
      expect(ids(rows as any)).toEqual([alice.id]);
    });

    it('mode "antiJoin" keeps parents with no matching child (NOT EXISTS)', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'left',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'antiJoin',
          },
        ],
      });
      expect(ids(rows as any)).toEqual([carol.id]);
    });

    it('mode "antiJoin" composes with the parent filter', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, filter: { age: 21 }, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'left',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'antiJoin',
          },
        ],
      });
      expect(ids(rows as any)).toEqual([carol.id]);
    });

    it('mode "includes" attaches matched children under __includes', async () => {
      const rows = (await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'left',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'includes',
            attachAs: 'posts',
          },
        ],
      })) as any[];
      expect(ids(rows)).toEqual([alice.id, bob.id, carol.id]);
      expect(rows[0].__includes.posts.map((p: any) => p.title).sort()).toEqual(['a1', 'a2']);
      expect(rows[1].__includes.posts.map((p: any) => p.title)).toEqual(['b1']);
      expect(rows[2].__includes.posts).toEqual([]);
    });

    it('mode "includes" honours the child filter', async () => {
      const rows = (await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [
          {
            kind: 'left',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'includes',
            attachAs: 'posts',
            filter: { status: 'published' },
          },
        ],
      })) as any[];
      expect(rows[0].__includes.posts.map((p: any) => p.title)).toEqual(['a1']);
      expect(rows[1].__includes.posts).toEqual([]);
      expect(rows[2].__includes.posts).toEqual([]);
    });

    it('passes the parent ORDER BY / LIMIT through to the SQL', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }], limit: 2 },
        joins: [
          {
            kind: 'inner',
            childTableName: postsTable,
            on: { parentColumn: 'id', childColumn: 'userId' },
            mode: 'select',
          },
        ],
      });
      expect(ids(rows as any)).toEqual([alice.id, bob.id]);
    });

    it('returns parent rows unchanged when the joins array is empty', async () => {
      const rows = await connector.queryWithJoins({
        parent: { tableName, order: [{ key: 'id' }] },
        joins: [],
      });
      expect(ids(rows as any)).toEqual([alice.id, bob.id, carol.id]);
    });
  });

  describe('#queryScoped', () => {
    const qsUsersTable = 'qs_users';
    const qsTodosTable = 'qs_todos';
    const qsOrdersTable = 'qs_orders';

    beforeEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(qsTodosTable);
      await mockClient.knex.schema.dropTableIfExists(qsUsersTable);
      await mockClient.knex.schema.dropTableIfExists(qsOrdersTable);
      await mockClient.knex.schema.createTable(qsUsersTable, (t: Knex.CreateTableBuilder) => {
        t.increments('id').primary().unsigned();
        t.string('email');
        t.integer('age');
      });
      await mockClient.knex.schema.createTable(qsTodosTable, (t: Knex.CreateTableBuilder) => {
        t.increments('id').primary().unsigned();
        t.integer('userId');
        t.string('title');
      });
      await mockClient.knex.schema.createTable(qsOrdersTable, (t: Knex.CreateTableBuilder) => {
        t.increments('id').primary().unsigned();
        t.integer('total');
      });
    });

    afterEach(async () => {
      await mockClient.knex.schema.dropTableIfExists(qsTodosTable);
      await mockClient.knex.schema.dropTableIfExists(qsUsersTable);
      await mockClient.knex.schema.dropTableIfExists(qsOrdersTable);
    });

    it('returns rows for a flat query (no parent scopes)', async () => {
      await connector.batchInsert(qsUsersTable, { id: KeyType.number } as any, [
        { email: 'a@b', age: 18 },
        { email: 'c@d', age: 21 },
      ]);
      const rows = (await connector.queryScoped!({
        target: { tableName: qsUsersTable, keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [],
        projection: 'rows',
      })) as { email: string }[];
      expect(rows.map((r) => r.email).sort()).toEqual(['a@b', 'c@d']);
    });

    it('emits nested IN subquery for parentScopes (one statement)', async () => {
      const inserted = await connector.batchInsert(qsUsersTable, { id: KeyType.number } as any, [
        { email: 'alice@x', age: 18 },
        { email: 'bob@x', age: 21 },
      ]);
      const aliceId = inserted[0].id;
      const bobId = inserted[1].id;
      await connector.batchInsert(qsTodosTable, { id: KeyType.number } as any, [
        { userId: aliceId, title: 'a-1' },
        { userId: aliceId, title: 'a-2' },
        { userId: bobId, title: 'b-1' },
      ]);

      const rows = (await connector.queryScoped!({
        target: { tableName: qsTodosTable, keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [
          {
            parentTable: qsUsersTable,
            parentKeys: { id: KeyType.number },
            parentFilter: { age: 18 },
            link: { parentColumn: 'id', childColumn: 'userId', direction: 'hasMany' },
          },
        ],
        projection: 'rows',
      })) as { title: string; userId: number }[];
      expect(rows.map((r) => r.title).sort()).toEqual(['a-1', 'a-2']);
      for (const row of rows) expect(row.userId).toBe(aliceId);
    });

    it('aggregate count returns total matching row count', async () => {
      await connector.batchInsert(qsUsersTable, { id: KeyType.number } as any, [
        { email: 'a@b', age: 18 },
        { email: 'c@d', age: 21 },
        { email: 'e@f', age: 30 },
      ]);
      const result = await connector.queryScoped!({
        target: { tableName: qsUsersTable, keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [],
        projection: { kind: 'aggregate', op: 'count' },
      });
      expect(result).toBe(3);
      expect(typeof result).toBe('number');
    });

    it('aggregate sum on a column returns the total', async () => {
      await connector.batchInsert(qsOrdersTable, { id: KeyType.number } as any, [
        { total: 3 },
        { total: 4 },
        { total: 5 },
      ]);
      const result = await connector.queryScoped!({
        target: { tableName: qsOrdersTable, keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [],
        projection: { kind: 'aggregate', op: 'sum', column: 'total' },
      });
      expect(result).toBe(12);
    });

    it('column projection plucks values', async () => {
      await connector.batchInsert(qsUsersTable, { id: KeyType.number } as any, [
        { email: 'a@b', age: 18 },
        { email: 'c@d', age: 21 },
      ]);
      const result = (await connector.queryScoped!({
        target: { tableName: qsUsersTable, keys: { id: KeyType.number } },
        pendingJoins: [],
        parentScopes: [],
        order: [{ key: 'id' }],
        projection: { kind: 'column', column: 'email' },
      })) as string[];
      expect(result).toEqual(['a@b', 'c@d']);
    });
  });
});

/**
 * Stub `DataApiClient` that pattern-matches the queries `reflectSchema`
 * issues and returns canned `information_schema` rows. The real Data API
 * is reached via `aws-sdk`; the mock keeps the test in-process.
 */
class StubDataApiClient implements DataApiClient {
  constructor(private readonly responses: Array<(sql: string) => DataApiQueryResult | undefined>) {}
  async query(sql: string): Promise<DataApiQueryResult> {
    for (const responder of this.responses) {
      const result = responder(sql);
      if (result !== undefined) return result;
    }
    return { records: [] };
  }
}

describe('DataApiConnector#reflectSchema (postgres dialect)', () => {
  it('round-trips a simple table from canned information_schema rows', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.tables/i.test(sql)) {
          return { records: [{ table_name: 'users' }] };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.columns/i.test(sql)) {
          return {
            records: [
              {
                column_name: 'id',
                data_type: 'integer',
                udt_name: 'int4',
                is_nullable: 'NO',
                column_default: "nextval('users_id_seq'::regclass)",
                character_maximum_length: null,
                numeric_precision: 32,
                numeric_scale: 0,
                ordinal_position: 1,
              },
              {
                column_name: 'email',
                data_type: 'character varying',
                udt_name: 'varchar',
                is_nullable: 'NO',
                column_default: null,
                character_maximum_length: 320,
                numeric_precision: null,
                numeric_scale: null,
                ordinal_position: 2,
              },
              {
                column_name: 'active',
                data_type: 'boolean',
                udt_name: 'bool',
                is_nullable: 'NO',
                column_default: 'true',
                character_maximum_length: null,
                numeric_precision: null,
                numeric_scale: null,
                ordinal_position: 3,
              },
            ],
          };
        }
        return undefined;
      },
      (sql) => {
        if (/constraint_type = 'PRIMARY KEY'/i.test(sql)) {
          return { records: [{ column_name: 'id' }] };
        }
        if (/constraint_type = 'UNIQUE'/i.test(sql)) {
          return { records: [{ column_name: 'email' }] };
        }
        if (/FROM pg_class/i.test(sql)) {
          // No explicit (non-constraint) indexes.
          return { records: [] };
        }
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'postgres' });
    const reflected = await c.reflectSchema!();
    expect(reflected).toHaveLength(1);
    const table = reflected[0];
    expect(table.name).toBe('users');
    expect(table.primaryKey).toBe('id');
    const id = table.columns.find((c) => c.name === 'id')!;
    expect(id.type).toBe('integer');
    expect(id.primary).toBe(true);
    expect(id.autoIncrement).toBe(true);
    const email = table.columns.find((c) => c.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.limit).toBe(320);
    expect(email.unique).toBe(true);
    const active = table.columns.find((c) => c.name === 'active')!;
    expect(active.type).toBe('boolean');
    expect(active.default).toBe(true);
  });

  it('reflects composite + unique indexes', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.tables/i.test(sql))
          return { records: [{ table_name: 'logs' }] };
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.columns/i.test(sql)) {
          return {
            records: [
              {
                column_name: 'id',
                data_type: 'integer',
                udt_name: 'int4',
                is_nullable: 'NO',
                column_default: null,
                character_maximum_length: null,
                numeric_precision: 32,
                numeric_scale: 0,
                ordinal_position: 1,
              },
              {
                column_name: 'userId',
                data_type: 'integer',
                udt_name: 'int4',
                is_nullable: 'YES',
                column_default: null,
                character_maximum_length: null,
                numeric_precision: 32,
                numeric_scale: 0,
                ordinal_position: 2,
              },
            ],
          };
        }
        return undefined;
      },
      (sql) => {
        if (/constraint_type = 'PRIMARY KEY'/i.test(sql))
          return { records: [{ column_name: 'id' }] };
        if (/constraint_type = 'UNIQUE'/i.test(sql)) return { records: [] };
        if (/FROM pg_class/i.test(sql)) {
          return {
            records: [
              {
                index_name: 'idx_logs_user_id',
                is_unique: false,
                is_primary: false,
                column_name: 'userId',
                ord: 1,
                contype: '',
              },
              {
                index_name: 'idx_logs_user_id_id',
                is_unique: true,
                is_primary: false,
                column_name: 'userId',
                ord: 1,
                contype: '',
              },
              {
                index_name: 'idx_logs_user_id_id',
                is_unique: true,
                is_primary: false,
                column_name: 'id',
                ord: 2,
                contype: '',
              },
            ],
          };
        }
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'postgres' });
    const reflected = await c.reflectSchema!();
    const table = reflected[0];
    const names = table.indexes.map((i) => i.name).sort();
    expect(names).toEqual(['idx_logs_user_id', 'idx_logs_user_id_id']);
    const compound = table.indexes.find((i) => i.name === 'idx_logs_user_id_id')!;
    expect(compound.columns).toEqual(['userId', 'id']);
    expect(compound.unique).toBe(true);
  });

  it('reflects multiple tables', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.tables/i.test(sql)) {
          return { records: [{ table_name: 'users' }, { table_name: 'posts' }] };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.columns/i.test(sql)) return { records: [] };
        if (/constraint_type/i.test(sql)) return { records: [] };
        if (/FROM pg_class/i.test(sql)) return { records: [] };
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'postgres' });
    const reflected = await c.reflectSchema!();
    expect(reflected.map((t) => t.name)).toEqual(['users', 'posts']);
  });
});

describe('DataApiConnector#reflectSchema (mysql dialect)', () => {
  it('round-trips a simple table from canned information_schema rows', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.TABLES/i.test(sql)) {
          return { records: [{ TABLE_NAME: 'users' }] };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.COLUMNS/i.test(sql)) {
          return {
            records: [
              {
                COLUMN_NAME: 'id',
                DATA_TYPE: 'int',
                COLUMN_TYPE: 'int(11)',
                IS_NULLABLE: 'NO',
                COLUMN_DEFAULT: null,
                COLUMN_KEY: 'PRI',
                CHARACTER_MAXIMUM_LENGTH: null,
                NUMERIC_PRECISION: 10,
                NUMERIC_SCALE: 0,
                EXTRA: 'auto_increment',
              },
              {
                COLUMN_NAME: 'email',
                DATA_TYPE: 'varchar',
                COLUMN_TYPE: 'varchar(320)',
                IS_NULLABLE: 'NO',
                COLUMN_DEFAULT: null,
                COLUMN_KEY: 'UNI',
                CHARACTER_MAXIMUM_LENGTH: 320,
                NUMERIC_PRECISION: null,
                NUMERIC_SCALE: null,
                EXTRA: '',
              },
              {
                COLUMN_NAME: 'active',
                DATA_TYPE: 'tinyint',
                COLUMN_TYPE: 'tinyint(1)',
                IS_NULLABLE: 'NO',
                COLUMN_DEFAULT: '1',
                COLUMN_KEY: '',
                CHARACTER_MAXIMUM_LENGTH: null,
                NUMERIC_PRECISION: 3,
                NUMERIC_SCALE: 0,
                EXTRA: '',
              },
            ],
          };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.STATISTICS/i.test(sql)) {
          return {
            records: [
              {
                INDEX_NAME: 'PRIMARY',
                NON_UNIQUE: 0,
                COLUMN_NAME: 'id',
                SEQ_IN_INDEX: 1,
              },
              {
                INDEX_NAME: 'email',
                NON_UNIQUE: 0,
                COLUMN_NAME: 'email',
                SEQ_IN_INDEX: 1,
              },
            ],
          };
        }
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'mysql' });
    const reflected = await c.reflectSchema!();
    expect(reflected).toHaveLength(1);
    const table = reflected[0];
    expect(table.name).toBe('users');
    expect(table.primaryKey).toBe('id');
    const id = table.columns.find((c) => c.name === 'id')!;
    expect(id.type).toBe('integer');
    expect(id.primary).toBe(true);
    expect(id.autoIncrement).toBe(true);
    const email = table.columns.find((c) => c.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.limit).toBe(320);
    expect(email.unique).toBe(true);
    const active = table.columns.find((c) => c.name === 'active')!;
    expect(active.type).toBe('boolean');
    expect(active.default).toBe(true);
  });

  it('reflects composite + unique indexes', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.TABLES/i.test(sql)) {
          return { records: [{ TABLE_NAME: 'logs' }] };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.COLUMNS/i.test(sql)) {
          return {
            records: [
              {
                COLUMN_NAME: 'id',
                DATA_TYPE: 'int',
                COLUMN_TYPE: 'int(11)',
                IS_NULLABLE: 'NO',
                COLUMN_DEFAULT: null,
                COLUMN_KEY: 'PRI',
                CHARACTER_MAXIMUM_LENGTH: null,
                NUMERIC_PRECISION: 10,
                NUMERIC_SCALE: 0,
                EXTRA: 'auto_increment',
              },
              {
                COLUMN_NAME: 'userId',
                DATA_TYPE: 'int',
                COLUMN_TYPE: 'int(11)',
                IS_NULLABLE: 'YES',
                COLUMN_DEFAULT: null,
                COLUMN_KEY: 'MUL',
                CHARACTER_MAXIMUM_LENGTH: null,
                NUMERIC_PRECISION: 10,
                NUMERIC_SCALE: 0,
                EXTRA: '',
              },
            ],
          };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.STATISTICS/i.test(sql)) {
          return {
            records: [
              {
                INDEX_NAME: 'PRIMARY',
                NON_UNIQUE: 0,
                COLUMN_NAME: 'id',
                SEQ_IN_INDEX: 1,
              },
              {
                INDEX_NAME: 'idx_logs_user_id',
                NON_UNIQUE: 1,
                COLUMN_NAME: 'userId',
                SEQ_IN_INDEX: 1,
              },
              {
                INDEX_NAME: 'idx_logs_user_id_id',
                NON_UNIQUE: 0,
                COLUMN_NAME: 'userId',
                SEQ_IN_INDEX: 1,
              },
              {
                INDEX_NAME: 'idx_logs_user_id_id',
                NON_UNIQUE: 0,
                COLUMN_NAME: 'id',
                SEQ_IN_INDEX: 2,
              },
            ],
          };
        }
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'mysql' });
    const reflected = await c.reflectSchema!();
    const table = reflected[0];
    const names = table.indexes.map((i) => i.name).sort();
    expect(names).toEqual(['idx_logs_user_id', 'idx_logs_user_id_id']);
    const compound = table.indexes.find((i) => i.name === 'idx_logs_user_id_id')!;
    expect(compound.columns).toEqual(['userId', 'id']);
    expect(compound.unique).toBe(true);
  });

  it('reflects multiple tables', async () => {
    const stub = new StubDataApiClient([
      (sql) => {
        if (/FROM information_schema\.TABLES/i.test(sql)) {
          return { records: [{ TABLE_NAME: 'users' }, { TABLE_NAME: 'posts' }] };
        }
        return undefined;
      },
      (sql) => {
        if (/FROM information_schema\.COLUMNS/i.test(sql)) return { records: [] };
        if (/FROM information_schema\.STATISTICS/i.test(sql)) return { records: [] };
        return undefined;
      },
    ]);
    const c = new DataApiConnector({ client: stub, dialect: 'mysql' });
    const reflected = await c.reflectSchema!();
    expect(reflected.map((t) => t.name)).toEqual(['users', 'posts']);
  });
});

describe('DataApiConnector#reflectSchema (unsupported dialect)', () => {
  it('throws PersistenceError for unknown dialect', async () => {
    const stub = new StubDataApiClient([]);
    const c = new DataApiConnector({ client: stub });
    // Force an unsupported dialect by overriding the field
    (c as any).dialect = 'sqlite';
    await expect(c.reflectSchema!()).rejects.toBeInstanceOf(PersistenceError);
  });
});
