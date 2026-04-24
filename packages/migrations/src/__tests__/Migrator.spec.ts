import { type Connector, MemoryConnector } from '@next-model/core';
import { KnexConnector } from '@next-model/knex-connector';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MigrationAlreadyAppliedError,
  MigrationCycleError,
  MigrationMissingError,
  MigrationNotAppliedError,
  MigrationParentMissingError,
  Migrator,
} from '..';
import type { Migration } from '../types';

function createUsersTable(): Migration {
  return {
    version: '20250101000000',
    name: 'create_users',
    async up(connector) {
      await connector.createTable('users', (t) => {
        t.integer('id', { primary: true });
        t.string('name', { limit: 100 });
      });
    },
    async down(connector) {
      await connector.dropTable('users');
    },
  };
}

function addEmailColumn(): Migration {
  return {
    version: '20250102000000',
    name: 'add_email',
    async up(connector) {
      await connector.createTable('user_emails', (t) => {
        t.integer('user_id', { primary: true });
        t.string('email', { limit: 255, unique: true });
      });
    },
    async down(connector) {
      await connector.dropTable('user_emails');
    },
  };
}

function addAgeColumn(): Migration {
  return {
    version: '20250103000000',
    name: 'add_age',
    async up(connector) {
      await connector.createTable('user_ages', (t) => {
        t.integer('user_id', { primary: true });
        t.integer('age');
      });
    },
    async down(connector) {
      await connector.dropTable('user_ages');
    },
  };
}

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
  describe(`Migrator on ${backend.name}`, () => {
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

    describe('constructor', () => {
      it('uses schema_migrations as the default table name', () => {
        expect(migrator.tableName).toBe('schema_migrations');
      });

      it('accepts a custom table name', () => {
        const custom = new Migrator({ connector, tableName: 'my_migrations' });
        expect(custom.tableName).toBe('my_migrations');
      });

      it('rejects table names that are not valid identifiers', () => {
        expect(() => new Migrator({ connector, tableName: 'drop; --' })).toThrow(
          /invalid migrations table name/,
        );
        expect(() => new Migrator({ connector, tableName: '1bad' })).toThrow(
          /invalid migrations table name/,
        );
      });
    });

    describe('#init', () => {
      it('creates the migrations tracking table', async () => {
        await migrator.init();
        expect(await connector.hasTable('schema_migrations')).toBe(true);
      });

      it('is idempotent', async () => {
        await migrator.init();
        await migrator.init();
        await expect(migrator.appliedVersions()).resolves.toEqual([]);
      });
    });

    describe('#drop', () => {
      it('removes the migrations tracking table', async () => {
        await migrator.init();
        await migrator.drop();
        expect(await connector.hasTable('schema_migrations')).toBe(false);
      });
    });

    describe('#migrate', () => {
      it('applies all pending migrations in version order', async () => {
        const migrations = [addEmailColumn(), createUsersTable()];
        const applied = await migrator.migrate(migrations);
        expect(applied.map((m) => m.version)).toEqual(['20250101000000', '20250102000000']);
        expect(await migrator.appliedVersions()).toEqual(['20250101000000', '20250102000000']);
      });

      it('skips already-applied migrations', async () => {
        const migrations = [createUsersTable(), addEmailColumn()];
        await migrator.migrate(migrations);
        const second = await migrator.migrate([...migrations, addAgeColumn()]);
        expect(second.map((m) => m.version)).toEqual(['20250103000000']);
        expect(await migrator.appliedVersions()).toEqual([
          '20250101000000',
          '20250102000000',
          '20250103000000',
        ]);
      });

      it('rolls back the transaction when a migration throws', async () => {
        const broken: Migration = {
          version: '20250104000000',
          name: 'broken',
          async up(connector) {
            await connector.createTable('tmp', (t) => {
              t.integer('id', { primary: true });
            });
            throw new Error('boom');
          },
          async down() {},
        };
        await expect(migrator.migrate([broken])).rejects.toThrow(/boom/);
        expect(await migrator.appliedVersions()).toEqual([]);
      });
    });

    describe('#up', () => {
      it('applies a single migration and records it', async () => {
        await migrator.up(createUsersTable());
        expect(await migrator.appliedVersions()).toEqual(['20250101000000']);
      });

      it('throws MigrationAlreadyAppliedError when re-applied', async () => {
        const migration = createUsersTable();
        await migrator.up(migration);
        await expect(migrator.up(migration)).rejects.toBeInstanceOf(MigrationAlreadyAppliedError);
      });
    });

    describe('#down', () => {
      it('runs down and removes the applied entry', async () => {
        const migration = createUsersTable();
        await migrator.up(migration);
        await migrator.down(migration);
        expect(await migrator.appliedVersions()).toEqual([]);
      });

      it('throws MigrationNotAppliedError when not applied', async () => {
        await migrator.init();
        await expect(migrator.down(createUsersTable())).rejects.toBeInstanceOf(
          MigrationNotAppliedError,
        );
      });
    });

    describe('#rollback', () => {
      it('reverts the last migration by default', async () => {
        const migrations = [createUsersTable(), addEmailColumn(), addAgeColumn()];
        await migrator.migrate(migrations);
        const reverted = await migrator.rollback(migrations);
        expect(reverted.map((m) => m.version)).toEqual(['20250103000000']);
        expect(await migrator.appliedVersions()).toEqual(['20250101000000', '20250102000000']);
      });

      it('reverts the last N migrations in reverse order', async () => {
        const migrations = [createUsersTable(), addEmailColumn(), addAgeColumn()];
        await migrator.migrate(migrations);
        const reverted = await migrator.rollback(migrations, 2);
        expect(reverted.map((m) => m.version)).toEqual(['20250103000000', '20250102000000']);
        expect(await migrator.appliedVersions()).toEqual(['20250101000000']);
      });

      it('returns an empty list when steps <= 0', async () => {
        await migrator.migrate([createUsersTable()]);
        expect(await migrator.rollback([createUsersTable()], 0)).toEqual([]);
      });

      it('throws MigrationMissingError when an applied version is not in the provided list', async () => {
        await migrator.migrate([createUsersTable(), addEmailColumn()]);
        await expect(migrator.rollback([createUsersTable()])).rejects.toBeInstanceOf(
          MigrationMissingError,
        );
      });
    });

    describe('#status', () => {
      it('reports applied and pending migrations', async () => {
        const migrations = [createUsersTable(), addEmailColumn(), addAgeColumn()];
        await migrator.migrate([migrations[0]]);
        const statuses = await migrator.status(migrations);
        expect(statuses.map((s) => ({ version: s.version, isApplied: s.isApplied }))).toEqual([
          { version: '20250101000000', isApplied: true },
          { version: '20250102000000', isApplied: false },
          { version: '20250103000000', isApplied: false },
        ]);
        expect(statuses[0].appliedAt).toBeTruthy();
      });

      it('includes orphaned applied migrations missing from the list', async () => {
        await migrator.migrate([createUsersTable(), addEmailColumn()]);
        const statuses = await migrator.status([createUsersTable()]);
        const orphan = statuses.find((s) => s.version === '20250102000000');
        expect(orphan).toMatchObject({ isApplied: true, name: 'add_email' });
      });
    });

    describe('#pending', () => {
      it('returns only migrations not yet applied, in version order', async () => {
        await migrator.migrate([createUsersTable()]);
        const pending = await migrator.pending([
          addAgeColumn(),
          createUsersTable(),
          addEmailColumn(),
        ]);
        expect(pending.map((m) => m.version)).toEqual(['20250102000000', '20250103000000']);
      });
    });

    describe('custom table name', () => {
      it('uses the configured table for tracking applied migrations', async () => {
        const custom = new Migrator({ connector, tableName: 'my_migrations' });
        await custom.migrate([createUsersTable()]);
        expect(await connector.hasTable('my_migrations')).toBe(true);
        expect(await custom.appliedVersions()).toEqual(['20250101000000']);
      });
    });

    describe('dependency graph', () => {
      function makeMigration(version: string, parent?: string[]): Migration {
        return {
          version,
          name: `m_${version}`,
          parent,
          async up(connector) {
            await connector.createTable(`t_${version}`, (t) => {
              t.integer('id', { primary: true });
            });
          },
          async down(connector) {
            await connector.dropTable(`t_${version}`);
          },
        };
      }

      it('respects explicit parents when ordering migrations', async () => {
        const root = makeMigration('20250101000000', []);
        const branchA = makeMigration('20250102000000', ['20250101000000']);
        const branchB = makeMigration('20250103000000', ['20250101000000']);
        const merge = makeMigration('20250104000000', ['20250102000000', '20250103000000']);

        const applied = await migrator.migrate([merge, branchB, branchA, root]);
        const order = applied.map((m) => m.version);
        expect(order[0]).toBe('20250101000000');
        expect(order[3]).toBe('20250104000000');
        expect(order.indexOf('20250102000000')).toBeLessThan(order.indexOf('20250104000000'));
        expect(order.indexOf('20250103000000')).toBeLessThan(order.indexOf('20250104000000'));
      });

      it('throws MigrationParentMissingError when a declared parent is absent', async () => {
        const orphan = makeMigration('20250102000000', ['20250199000000']);
        await expect(migrator.migrate([orphan])).rejects.toBeInstanceOf(
          MigrationParentMissingError,
        );
      });

      it('throws MigrationCycleError when dependencies form a cycle', async () => {
        const a = makeMigration('20250101000000', ['20250102000000']);
        const b = makeMigration('20250102000000', ['20250101000000']);
        await expect(migrator.migrate([a, b])).rejects.toBeInstanceOf(MigrationCycleError);
      });

      it('applies migrations in waves when parallel is true', async () => {
        const root = makeMigration('20250101000000', []);
        const branchA = makeMigration('20250102000000', ['20250101000000']);
        const branchB = makeMigration('20250103000000', ['20250101000000']);
        const merge = makeMigration('20250104000000', ['20250102000000', '20250103000000']);

        const applied = await migrator.migrate([merge, branchA, branchB, root], {
          parallel: true,
        });
        expect(applied.map((m) => m.version).sort()).toEqual([
          '20250101000000',
          '20250102000000',
          '20250103000000',
          '20250104000000',
        ]);
        expect((await migrator.appliedVersions()).sort()).toEqual([
          '20250101000000',
          '20250102000000',
          '20250103000000',
          '20250104000000',
        ]);
      });

      it('rolls back in reverse topological order', async () => {
        const root = makeMigration('20250101000000', []);
        const child = makeMigration('20250102000000', ['20250101000000']);
        const grandchild = makeMigration('20250103000000', ['20250102000000']);

        await migrator.migrate([root, child, grandchild]);
        const reverted = await migrator.rollback([root, child, grandchild], 3);
        expect(reverted.map((m) => m.version)).toEqual([
          '20250103000000',
          '20250102000000',
          '20250101000000',
        ]);
      });
    });
  });
}
