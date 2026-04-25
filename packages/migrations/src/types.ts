import type { Connector } from '@next-model/core';

interface MigrationBase {
  version: string;
  name?: string;
  /**
   * Versions that must be applied before this migration runs. When omitted,
   * the migration falls back to the migration with the next-lower version in
   * the provided list (the implicit "previous version" chain). An empty array
   * means "no parents" — the migration is a root node.
   */
  parent?: string[];
}

export interface UpDownMigration extends MigrationBase {
  up(connector: Connector): Promise<void>;
  down(connector: Connector): Promise<void>;
}

/**
 * Rails-style reversible migration. Define a single `change(connector)` body
 * that describes the desired forward state; the runner records every schema
 * mutation (`createTable`, `alterTable`, ...) and replays the inverse on
 * `down()` automatically. Operations that are inherently irreversible
 * (`dropTable`, `removeColumn`, `removeIndex`, `removeForeignKey`,
 * `removeCheckConstraint`, and `changeColumn` without a `previous` snapshot)
 * cause `down()` to throw `IrreversibleMigrationError` — write explicit
 * `up()` / `down()` for those, or use `UpDownMigration`.
 */
export interface ChangeMigration extends MigrationBase {
  change(connector: Connector): Promise<void>;
}

export type Migration = UpDownMigration | ChangeMigration;

export interface MigrationStatus {
  version: string;
  name?: string;
  isApplied: boolean;
  appliedAt?: string;
  parent?: string[];
}

export interface MigrateOptions {
  /**
   * Run migrations within each dependency wave concurrently using
   * `Promise.all`. Requires the connector to support concurrent transactions
   * safely; when in doubt leave this `false` (the default).
   */
  parallel?: boolean;
}

export interface MigratorOptions {
  connector: Connector;
  tableName?: string;
}
