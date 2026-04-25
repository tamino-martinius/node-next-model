import { type Connector, defineAlter, MemoryConnector } from '@next-model/core';
import { KnexConnector } from '@next-model/knex-connector';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IrreversibleMigrationError } from '../errors.js';
import { Migrator } from '../Migrator.js';
import { RecordingConnector, replayDown, replayUp } from '../RecordingConnector.js';
import type { ChangeMigration, Migration } from '../types.js';

interface Backend {
  name: string;
  create(): Promise<{ connector: Connector; cleanup: () => Promise<void> }>;
}

const backends: Backend[] = [
  {
    name: 'MemoryConnector',
    async create() {
      const connector = new MemoryConnector({ storage: {}, lastIds: {} });
      return { connector, cleanup: async () => {} };
    },
  },
  {
    name: 'KnexConnector (sqlite3)',
    async create() {
      const connector = new KnexConnector({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });
      return { connector, cleanup: () => connector.knex.destroy() };
    },
  },
];

for (const backend of backends) {
  describe(`change-block migrations on ${backend.name}`, () => {
    let connector: Connector;
    let cleanup: () => Promise<void>;
    let migrator: Migrator;

    beforeEach(async () => {
      const created = await backend.create();
      connector = created.connector;
      cleanup = created.cleanup;
      migrator = new Migrator({ connector });
    });

    afterEach(async () => {
      await cleanup();
    });

    it('createTable: up creates the table, down drops it', async () => {
      const m: ChangeMigration = {
        version: '001',
        name: 'create_users',
        async change(c) {
          await c.createTable('users', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('name');
          });
        },
      };
      await migrator.migrate([m]);
      expect(await connector.hasTable('users')).toBe(true);
      await migrator.rollback([m]);
      expect(await connector.hasTable('users')).toBe(false);
    });

    it('alterTable.addColumn: up adds the column, down removes it', async () => {
      const create: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('users', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('name');
          });
        },
      };
      // Pre-seed a row so the back-fill behaviour of `addColumn` is observable
      // on connectors that only touch existing rows (MemoryConnector).
      await migrator.migrate([create]);
      await connector.batchInsert('users', { id: 1 } as any, [{ name: 'Ada' }]);

      const addEmail: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.alterTable(
            defineAlter('users', (a) =>
              a.addColumn('email', 'string', { default: 'x@example.com' }),
            ),
          );
        },
      };
      await migrator.migrate([create, addEmail]);
      const after = await connector.query({ tableName: 'users' });
      expect(after[0].email).toBe('x@example.com');

      await migrator.rollback([create, addEmail], 1);
      const rows = await connector.query({ tableName: 'users' });
      expect('email' in rows[0]).toBe(false);
    });

    it('alterTable.renameColumn: down renames back', async () => {
      const create: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('users', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('name');
          });
        },
      };
      const rename: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.alterTable(defineAlter('users', (a) => a.renameColumn('name', 'fullName')));
        },
      };
      await migrator.migrate([create, rename]);
      await connector.batchInsert('users', { id: 1 } as any, [{ fullName: 'Ada' }]);
      await migrator.rollback([create, rename], 1);
      const rows = await connector.query({ tableName: 'users' });
      expect(rows[0].name).toBe('Ada');
      expect('fullName' in rows[0]).toBe(false);
    });

    it('alterTable.addIndex: down removes the index', async () => {
      const m: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('events', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('kind');
          });
          await c.alterTable(
            defineAlter('events', (a) => a.addIndex('kind', { name: 'idx_events_kind' })),
          );
        },
      };
      await migrator.migrate([m]);
      // Both up + down execute without error: the down inverts addIndex into
      // removeIndex, then drops the table (inverse of createTable).
      await migrator.rollback([m]);
      expect(await connector.hasTable('events')).toBe(false);
    });

    it('alterTable.changeColumn with previous: down restores the original definition', async () => {
      const create: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('items', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.text('label');
          });
        },
      };
      const tighten: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.alterTable(
            defineAlter('items', (a) =>
              a.changeColumn(
                'label',
                'string',
                { null: false, limit: 64 },
                {
                  name: 'label',
                  type: 'text',
                  nullable: true,
                  primary: false,
                  unique: false,
                  autoIncrement: false,
                },
              ),
            ),
          );
        },
      };
      await migrator.migrate([create, tighten]);
      await migrator.rollback([create, tighten], 1);
      // The down should leave the table in place with the relaxed type.
      expect(await connector.hasTable('items')).toBe(true);
    });

    it('rollback throws IrreversibleMigrationError for dropTable in change()', async () => {
      const setup: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('legacy', (t) => t.integer('id', { primary: true }));
        },
      };
      const drop: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.dropTable('legacy');
        },
      };
      await migrator.migrate([setup, drop]);
      await expect(migrator.rollback([setup, drop], 1)).rejects.toBeInstanceOf(
        IrreversibleMigrationError,
      );
    });

    it('rollback throws IrreversibleMigrationError for removeColumn in change()', async () => {
      const setup: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('users', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('legacy');
          });
        },
      };
      const remove: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.alterTable(defineAlter('users', (a) => a.removeColumn('legacy')));
        },
      };
      await migrator.migrate([setup, remove]);
      await expect(migrator.rollback([setup, remove], 1)).rejects.toBeInstanceOf(
        IrreversibleMigrationError,
      );
    });

    it('rollback throws IrreversibleMigrationError for changeColumn without previous', async () => {
      const setup: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('items', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.text('label');
          });
        },
      };
      const change: ChangeMigration = {
        version: '002',
        parent: ['001'],
        async change(c) {
          await c.alterTable(
            defineAlter('items', (a) => a.changeColumn('label', 'string', { null: false })),
          );
        },
      };
      await migrator.migrate([setup, change]);
      await expect(migrator.rollback([setup, change], 1)).rejects.toBeInstanceOf(
        IrreversibleMigrationError,
      );
    });

    it('mix change-based and up/down migrations in the same list', async () => {
      const a: ChangeMigration = {
        version: '001',
        async change(c) {
          await c.createTable('users', (t) => t.integer('id', { primary: true, null: false }));
        },
      };
      const b: Migration = {
        version: '002',
        parent: ['001'],
        async up(c) {
          await c.createTable('audits', (t) => t.integer('id', { primary: true, null: false }));
        },
        async down(c) {
          await c.dropTable('audits');
        },
      };
      await migrator.migrate([a, b]);
      expect(await connector.hasTable('users')).toBe(true);
      expect(await connector.hasTable('audits')).toBe(true);
      await migrator.rollback([a, b], 2);
      expect(await connector.hasTable('users')).toBe(false);
      expect(await connector.hasTable('audits')).toBe(false);
    });
  });
}

describe('RecordingConnector', () => {
  it('captures createTable / alterTable / dropTable in order', async () => {
    const recorder = new RecordingConnector();
    await recorder.createTable('users', (t) => t.integer('id', { primary: true }));
    await recorder.alterTable(defineAlter('users', (a) => a.addColumn('name', 'string')));
    await recorder.dropTable('legacy');
    expect(recorder.recorded.map((r) => r.kind)).toEqual([
      'createTable',
      'alterTable',
      'dropTable',
    ]);
  });

  it('throws when data-path methods are called from a change block', async () => {
    const recorder = new RecordingConnector();
    await expect(recorder.query({ tableName: 'users' })).rejects.toThrow(/cannot query data/);
    await expect(recorder.count({ tableName: 'users' })).rejects.toThrow(/cannot count rows/);
    await expect(recorder.select({ tableName: 'users' }, 'id')).rejects.toThrow(
      /cannot select rows/,
    );
    await expect(recorder.updateAll({ tableName: 'users' }, { name: 'x' })).rejects.toThrow(
      /cannot update rows/,
    );
    await expect(recorder.deleteAll({ tableName: 'users' })).rejects.toThrow(/cannot delete rows/);
    await expect(recorder.batchInsert('users', {} as any, [])).rejects.toThrow(
      /cannot insert rows/,
    );
    await expect(recorder.execute('SELECT 1', [])).rejects.toThrow(/cannot execute raw SQL/);
    await expect(recorder.aggregate({ tableName: 'users' }, 'sum', 'id')).rejects.toThrow(
      /cannot aggregate/,
    );
    await expect(recorder.hasTable('users')).rejects.toThrow(/cannot probe table existence/);
  });

  it('replayUp executes recorded ops on a real connector', async () => {
    const recorder = new RecordingConnector();
    await recorder.createTable('users', (t) =>
      t.integer('id', { primary: true, autoIncrement: true, null: false }),
    );
    const real = new MemoryConnector({ storage: {}, lastIds: {} });
    await replayUp(real, recorder.recorded);
    expect(await real.hasTable('users')).toBe(true);
  });

  it('replayDown inverts and executes the recorded ops in reverse order', async () => {
    const recorder = new RecordingConnector();
    await recorder.createTable('users', (t) =>
      t.integer('id', { primary: true, autoIncrement: true, null: false }),
    );
    const real = new MemoryConnector({ storage: {}, lastIds: {} });
    await replayUp(real, recorder.recorded);
    expect(await real.hasTable('users')).toBe(true);
    await replayDown(real, '001', recorder.recorded);
    expect(await real.hasTable('users')).toBe(false);
  });

  it('inverts addForeignKey to removeForeignKey using the auto-generated name', async () => {
    const recorder = new RecordingConnector();
    await recorder.alterTable(defineAlter('comments', (a) => a.addForeignKey('posts')));
    // Real PG / SQL connectors throw on removeForeignKey because there's no
    // matching FK to drop, but we only care that the inversion engine produces
    // the right op shape — assert via a stub connector.
    const seen: { kind: string; payload: unknown }[] = [];
    const stub: Connector = {
      ...new MemoryConnector({ storage: {}, lastIds: {} }),
      async alterTable(spec) {
        seen.push({ kind: 'alterTable', payload: spec });
      },
    } as unknown as Connector;
    await replayDown(stub, 'v1', recorder.recorded);
    expect(seen).toHaveLength(1);
    const spec = (seen[0].payload as { ops: { op: string; nameOrTable: string }[] }).ops[0];
    expect(spec).toMatchObject({ op: 'removeForeignKey', nameOrTable: 'fk_comments_posts' });
  });

  it('inverts addCheckConstraint(name) to removeCheckConstraint', async () => {
    const recorder = new RecordingConnector();
    await recorder.alterTable(
      defineAlter('items', (a) => a.addCheckConstraint('age >= 0', { name: 'chk_age' })),
    );
    const seen: { ops: unknown[] }[] = [];
    const stub = {
      async alterTable(spec: unknown) {
        seen.push(spec as { ops: unknown[] });
      },
    } as unknown as Connector;
    await replayDown(stub, 'v1', recorder.recorded);
    expect((seen[0] as { ops: { op: string; name: string }[] }).ops[0]).toMatchObject({
      op: 'removeCheckConstraint',
      name: 'chk_age',
    });
  });

  it('throws when addCheckConstraint has no name (cannot derive inverse)', async () => {
    const recorder = new RecordingConnector();
    await recorder.alterTable(defineAlter('items', (a) => a.addCheckConstraint('age >= 0')));
    const stub = { async alterTable() {} } as unknown as Connector;
    await expect(replayDown(stub, 'v1', recorder.recorded)).rejects.toBeInstanceOf(
      IrreversibleMigrationError,
    );
  });
});
