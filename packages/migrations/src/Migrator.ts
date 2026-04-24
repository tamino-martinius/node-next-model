import { type Connector, KeyType } from '@next-model/core';

import {
  MigrationAlreadyAppliedError,
  MigrationMissingError,
  MigrationNotAppliedError,
} from './errors';
import type { Migration, MigrationStatus, MigratorOptions } from './types';

const DEFAULT_TABLE_NAME = 'schema_migrations';
const VERSION_LIMIT = 255;
const NAME_LIMIT = 255;

function validateTableName(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`invalid migrations table name: ${name}`);
  }
}

export class Migrator {
  readonly connector: Connector;
  readonly tableName: string;
  private initialized = false;

  constructor(options: MigratorOptions) {
    this.connector = options.connector;
    this.tableName = options.tableName ?? DEFAULT_TABLE_NAME;
    validateTableName(this.tableName);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.connector.createTable(this.tableName, (t) => {
      t.string('version', { limit: VERSION_LIMIT, primary: true, null: false });
      t.string('name', { limit: NAME_LIMIT });
      t.timestamp('applied_at', { null: false });
    });
    this.initialized = true;
  }

  async drop(): Promise<void> {
    await this.connector.dropTable(this.tableName);
    this.initialized = false;
  }

  async appliedVersions(): Promise<string[]> {
    const entries = await this.appliedEntries();
    return entries.map((entry) => entry.version);
  }

  async appliedEntries(): Promise<{ version: string; name: string | null; appliedAt: string }[]> {
    await this.init();
    const rows = await this.connector.query({
      tableName: this.tableName,
      order: [{ key: 'version' }],
    });
    return rows.map((row) => ({
      version: String(row.version),
      name: row.name == null ? null : String(row.name),
      appliedAt:
        row.applied_at instanceof Date ? row.applied_at.toISOString() : String(row.applied_at),
    }));
  }

  async pending(migrations: Migration[]): Promise<Migration[]> {
    const applied = new Set(await this.appliedVersions());
    return sortByVersion(migrations).filter((m) => !applied.has(m.version));
  }

  async status(migrations: Migration[]): Promise<MigrationStatus[]> {
    const entries = await this.appliedEntries();
    const appliedMap = new Map(entries.map((e) => [e.version, e]));
    const known = new Set(migrations.map((m) => m.version));

    const result: MigrationStatus[] = sortByVersion(migrations).map((m) => {
      const entry = appliedMap.get(m.version);
      return {
        version: m.version,
        name: m.name,
        isApplied: entry !== undefined,
        appliedAt: entry?.appliedAt,
      };
    });

    for (const entry of entries) {
      if (!known.has(entry.version)) {
        result.push({
          version: entry.version,
          name: entry.name ?? undefined,
          isApplied: true,
          appliedAt: entry.appliedAt,
        });
      }
    }

    return result;
  }

  async migrate(migrations: Migration[]): Promise<Migration[]> {
    const pending = await this.pending(migrations);
    for (const migration of pending) {
      await this.runUp(migration);
    }
    return pending;
  }

  async up(migration: Migration): Promise<void> {
    const applied = new Set(await this.appliedVersions());
    if (applied.has(migration.version)) {
      throw new MigrationAlreadyAppliedError(migration.version);
    }
    await this.runUp(migration);
  }

  async down(migration: Migration): Promise<void> {
    const applied = new Set(await this.appliedVersions());
    if (!applied.has(migration.version)) {
      throw new MigrationNotAppliedError(migration.version);
    }
    await this.runDown(migration);
  }

  async rollback(migrations: Migration[], steps = 1): Promise<Migration[]> {
    if (steps <= 0) return [];
    const applied = await this.appliedVersions();
    const byVersion = new Map(migrations.map((m) => [m.version, m]));
    const targets = applied.slice(-steps).reverse();
    const reverted: Migration[] = [];
    for (const version of targets) {
      const migration = byVersion.get(version);
      if (!migration) throw new MigrationMissingError(version);
      await this.runDown(migration);
      reverted.push(migration);
    }
    return reverted;
  }

  private async runUp(migration: Migration): Promise<void> {
    await this.connector.transaction(async () => {
      await migration.up(this.connector);
      await this.connector.batchInsert(this.tableName, { version: KeyType.manual }, [
        {
          version: migration.version,
          name: migration.name ?? null,
          applied_at: new Date(),
        },
      ]);
    });
  }

  private async runDown(migration: Migration): Promise<void> {
    await this.connector.transaction(async () => {
      await migration.down(this.connector);
      await this.connector.deleteAll({
        tableName: this.tableName,
        filter: { version: migration.version },
      });
    });
  }
}

function sortByVersion(migrations: Migration[]): Migration[] {
  return [...migrations].sort((a, b) => a.version.localeCompare(b.version));
}

export default Migrator;
