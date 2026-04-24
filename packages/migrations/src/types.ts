import type { Connector } from '@next-model/core';

export interface Migration {
  version: string;
  name?: string;
  up(connector: Connector): Promise<void>;
  down(connector: Connector): Promise<void>;
}

export interface MigrationStatus {
  version: string;
  name?: string;
  isApplied: boolean;
  appliedAt?: string;
}

export interface MigratorOptions {
  connector: Connector;
  tableName?: string;
}
