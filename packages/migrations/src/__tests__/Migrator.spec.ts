import { KnexConnector } from '@next-model/knex-connector';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MigrationAlreadyAppliedError,
  MigrationMissingError,
  MigrationNotAppliedError,
  Migrator,
} from '..';
import type { Migration } from '../types';

function newConnector(): KnexConnector {
  return new KnexConnector({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
}

function createUsersTable(): Migration {
  return {
    version: '20250101000000',
    name: 'create_users',
    async up(connector) {
      await connector.execute(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255))',
        [],
      );
    },
    async down(connector) {
      await connector.execute('DROP TABLE users', []);
    },
  };
}

function addEmailColumn(): Migration {
  return {
    version: '20250102000000',
    name: 'add_email',
    async up(connector) {
      await connector.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)', []);
    },
    async down(connector) {
      await connector.execute('ALTER TABLE users DROP COLUMN email', []);
    },
  };
}

function addAgeColumn(): Migration {
  return {
    version: '20250103000000',
    name: 'add_age',
    async up(connector) {
      await connector.execute('ALTER TABLE users ADD COLUMN age INTEGER', []);
    },
    async down(connector) {
      await connector.execute('ALTER TABLE users DROP COLUMN age', []);
    },
  };
}

describe('Migrator', () => {
  let connector: KnexConnector;
  let migrator: Migrator;

  beforeEach(() => {
    connector = newConnector();
    migrator = new Migrator({ connector });
  });

  afterEach(async () => {
    await connector.knex.destroy();
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
      const rows = (await connector.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ['schema_migrations'],
      )) as { name: string }[];
      expect(rows).toHaveLength(1);
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
      const rows = (await connector.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ['schema_migrations'],
      )) as { name: string }[];
      expect(rows).toHaveLength(0);
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
          await connector.execute('CREATE TABLE tmp (id INTEGER PRIMARY KEY)', []);
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
      const rows = (await connector.execute(
        'SELECT version FROM my_migrations ORDER BY version ASC',
        [],
      )) as { version: string }[];
      expect(rows.map((r) => r.version)).toEqual(['20250101000000']);
    });
  });
});
