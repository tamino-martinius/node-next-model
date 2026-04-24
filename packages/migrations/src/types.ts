import type { Connector } from '@next-model/core';

export interface Migration {
  version: string;
  name?: string;
  /**
   * Versions that must be applied before this migration runs. When omitted,
   * the migration falls back to the migration with the next-lower version in
   * the provided list (the implicit "previous version" chain). An empty array
   * means "no parents" — the migration is a root node.
   */
  parent?: string[];
  up(connector: Connector): Promise<void>;
  down(connector: Connector): Promise<void>;
}

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
