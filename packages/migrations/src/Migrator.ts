import { type Connector, KeyType } from '@next-model/core';

import {
  MigrationAlreadyAppliedError,
  MigrationCycleError,
  MigrationMissingError,
  MigrationNotAppliedError,
  MigrationParentMissingError,
} from './errors.js';
import type { MigrateOptions, Migration, MigrationStatus, MigratorOptions } from './types.js';

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
    return topologicalOrder(migrations).filter((m) => !applied.has(m.version));
  }

  async status(migrations: Migration[]): Promise<MigrationStatus[]> {
    const entries = await this.appliedEntries();
    const appliedMap = new Map(entries.map((e) => [e.version, e]));
    const known = new Set(migrations.map((m) => m.version));
    const ordered = topologicalOrder(migrations);
    const parentMap = new Map(
      ordered.map((m, index) => [m.version, effectiveParents(m, index, ordered)]),
    );

    const result: MigrationStatus[] = ordered.map((m) => {
      const entry = appliedMap.get(m.version);
      return {
        version: m.version,
        name: m.name,
        isApplied: entry !== undefined,
        appliedAt: entry?.appliedAt,
        parent: parentMap.get(m.version),
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

  async migrate(migrations: Migration[], options: MigrateOptions = {}): Promise<Migration[]> {
    const pending = await this.pending(migrations);
    if (pending.length === 0) return pending;

    if (options.parallel) {
      await this.migrateInWaves(pending);
    } else {
      for (const migration of pending) {
        await this.runUp(migration);
      }
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
    const applied = new Set(await this.appliedVersions());
    const byVersion = new Map(migrations.map((m) => [m.version, m]));

    for (const version of applied) {
      if (!byVersion.has(version)) throw new MigrationMissingError(version);
    }

    const ordered = topologicalOrder(migrations).filter((m) => applied.has(m.version));
    const targets = ordered.slice(-steps).reverse();

    const reverted: Migration[] = [];
    for (const migration of targets) {
      await this.runDown(migration);
      reverted.push(migration);
    }
    return reverted;
  }

  private async migrateInWaves(pending: Migration[]): Promise<void> {
    const pendingVersions = new Set(pending.map((m) => m.version));
    const pendingList = pending;
    const parentsByVersion = new Map<string, string[]>();
    for (let i = 0; i < pendingList.length; i++) {
      const migration = pendingList[i];
      const parents = effectiveParents(migration, i, pendingList).filter((p) =>
        pendingVersions.has(p),
      );
      parentsByVersion.set(migration.version, parents);
    }

    const remaining = new Map(pendingList.map((m) => [m.version, m]));
    const applied = new Set<string>();

    while (remaining.size > 0) {
      const wave: Migration[] = [];
      for (const migration of remaining.values()) {
        const parents = parentsByVersion.get(migration.version) ?? [];
        if (parents.every((p) => applied.has(p))) {
          wave.push(migration);
        }
      }
      if (wave.length === 0) {
        throw new MigrationCycleError([...remaining.keys()]);
      }
      await Promise.all(wave.map((migration) => this.runUp(migration)));
      for (const migration of wave) {
        applied.add(migration.version);
        remaining.delete(migration.version);
      }
    }
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

function effectiveParents(migration: Migration, index: number, sorted: Migration[]): string[] {
  if (migration.parent !== undefined) return migration.parent;
  if (index === 0) return [];
  return [sorted[index - 1].version];
}

function topologicalOrder(migrations: Migration[]): Migration[] {
  const sorted = sortByVersion(migrations);
  const known = new Set(sorted.map((m) => m.version));

  const parents = new Map<string, string[]>();
  for (let i = 0; i < sorted.length; i++) {
    const migration = sorted[i];
    const declared = effectiveParents(migration, i, sorted);
    for (const parent of declared) {
      if (!known.has(parent)) {
        throw new MigrationParentMissingError(migration.version, parent);
      }
    }
    parents.set(migration.version, declared);
  }

  const byVersion = new Map(sorted.map((m) => [m.version, m]));
  const ordered: Migration[] = [];
  const placed = new Set<string>();
  const remaining = new Set(sorted.map((m) => m.version));

  while (remaining.size > 0) {
    const wave: string[] = [];
    for (const version of sorted.map((m) => m.version)) {
      if (!remaining.has(version)) continue;
      const deps = parents.get(version) ?? [];
      if (deps.every((d) => placed.has(d))) {
        wave.push(version);
      }
    }
    if (wave.length === 0) {
      throw new MigrationCycleError([...remaining]);
    }
    for (const version of wave) {
      ordered.push(byVersion.get(version)!);
      placed.add(version);
      remaining.delete(version);
    }
  }

  return ordered;
}

export default Migrator;
