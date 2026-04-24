import { ConnectionConfig, Connector } from './Connector';
import { Dict, Migration } from './types';

import { basename } from 'path';
import { readdirSync } from 'fs';

export class Migrator {
  public tableName: string = 'migrations';
  public config: ConnectionConfig | undefined;

  constructor(config?: ConnectionConfig & { tableName?: string }) {
    if (config) {
      if (config.tableName) {
        this.tableName = config.tableName;
      }
      delete config.tableName;
      this.config = config;
    }
  }

  private connect() {
    return new Connector(this.tableName, this.config);
  }

  public async createDatabase() {
    const connector = this.connect();
    try {
      await connector.createDatabase();
    } finally {
      await connector.disconnect();
    }
  }

  public async dropDatabase() {
    const connector = this.connect();
    try {
      await connector.dropDatabase();
    } finally {
      await connector.disconnect();
    }
  }

  public async createTable() {
    const connector = this.connect();
    try {
      await connector.createTable();
    } finally {
      await connector.disconnect();
    }
  }

  public async tableExists() {
    const connector = this.connect();
    let result = false;
    try {
      result = await connector.tableExists();
    } finally {
      await connector.disconnect();
      return result;
    }
  }

  public async dropTable() {
    const connector = this.connect();
    try {
      await connector.dropTable();
    } finally {
      await connector.disconnect();
    }
  }

  public async migrate(migrations: Migration[]): Promise<void> {
    const connector = this.connect();
    try {
      await connector.migrate(migrations);
    } finally {
      await connector.disconnect();
    }
  }

  public async up(migration: Migration): Promise<void> {
    const connector = this.connect();
    try {
      await connector.up(migration);
    } finally {
      await connector.disconnect();
    }
  }

  public async down(migration: Migration): Promise<void> {
    const connector = this.connect();
    try {
      await connector.down(migration);
    } finally {
      await connector.disconnect();
    }
  }

  public async getStatusOfMigrations(
    migrations: Migration[],
  ): Promise<Dict<{ name?: string; isApplied: boolean }>> {
    const connector = this.connect();
    const status: Dict<{ name?: string; isApplied: boolean }> = {};
    for (const migration of migrations) {
      const { name, version } = migration;
      status[version] = { name, isApplied: false };
    }
    try {
      const versions = await connector.getMigrationVersions();
      for (const version of versions) {
        status[version] = status[version] || { isApplied: true };
        status[version].isApplied = status[version].isApplied || true;
      }
    } finally {
      await connector.disconnect();
    }
    return status;
  }

  public static getMigrationFileNamesFromPath(path: string) {
    const files = readdirSync(path);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    return jsFiles.map(file => basename(file, '.js'));
  }

  public static readMigrationFromPath(path: string, fileName: string) {
    const version = fileName.split(/[-_]/)[0];
    const name = fileName.substr(version.length + 1);
    return { version, name, ...require(`${path}/${fileName}`) };
  }

  public static getMigrationsFromPath(path: string): Migration[] {
    return this.getMigrationFileNamesFromPath(path).map(name =>
      this.readMigrationFromPath(path, name),
    );
  }
}

export default Migrator;
