import * as postgres from 'postgres';

import { Dict, Migration } from './types';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  path?: string;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  timeout?: number;
  types?: any;
  onnotice?: () => any;
  onparameter?: () => any;
  debug?: () => any;
  transform?: {
    column?: () => any;
    value?: () => any;
    row?: () => any;
  };
}

export class Connector {
  private cachedSql: any;
  private migrationPromises: Dict<Promise<void>> = {};
  private migrationStatus: Dict<boolean> = {};
  private initStatus: boolean | Promise<void> = false;
  private lastMigration: string | undefined;
  private config: ConnectionConfig;

  constructor(public tableName: string = 'migrations', config?: ConnectionConfig) {
    if (!this.isTableNameValid) throw `Invalid table name «${this.tableName}»`;
    this.config = config || {};
  }

  get sql(): any {
    if (this.cachedSql) return this.cachedSql;
    return (this.cachedSql = postgres(this.config));
  }

  private get isTableNameValid() {
    return /[a-z]([a-z0-9_])*/.test(this.tableName);
  }

  private async createIndex(): Promise<void> {
    await this.sql.unsafe(`
      CREATE UNIQUE INDEX "${this.tableName}__version"
      ON "${this.tableName}" ("version");
    `);
  }

  public async createTable(): Promise<void> {
    await this.sql.unsafe(`
      CREATE TABLE "${this.tableName}" (
        "id" SERIAL NOT NULL,
        "version" character varying NOT NULL,
        "timestamp" timestamp NOT NULL,
        PRIMARY KEY ("id")
      )
    `);
    await this.createIndex();
  }

  private async dropIndex(): Promise<void> {
    await this.sql.unsafe(`
      DROP INDEX IF EXISTS "${this.tableName}__version"
    `);
  }

  private async insertMigrationVersion(sql: any, version: string): Promise<void> {
    await sql.unsafe(
      `
      INSERT INTO
      "${this.tableName}"("version", "timestamp")
      VALUES($1, current_timestamp)
    `,
      [version],
    );
  }

  private async deleteMigrationVersion(sql: any, version: string): Promise<void> {
    await sql.unsafe(
      `
      DELETE FROM "${this.tableName}"
      WHERE version = $1
    `,
      [version],
    );
  }

  private async init(): Promise<void> {
    if (this.initStatus === true) return Promise.resolve();
    if (this.initStatus === false) {
      return (this.initStatus = new Promise(async resolve => {
        const migrationTableExists = await this.tableExists();
        if (!migrationTableExists) await this.createTable();
        const migrationVersions = await this.getMigrationVersions();
        for (const version of migrationVersions) {
          this.migrationStatus[version] = true;
          this.migrationPromises[version] = Promise.resolve();
          this.lastMigration = version;
        }
        resolve();
      }));
    }
  }

  public async getMigrationVersions(): Promise<string[]> {
    await this.init();
    const result = await this.sql.unsafe(`
      SELECT version FROM "${this.tableName}"
    `);
    return result.map((row: any) => row.version);
  }

  public async tableExists(): Promise<boolean> {
    const result = await this.sql`
      SELECT * FROM "information_schema"."tables"
      WHERE "table_schema" = current_schema()
        AND "table_name" = ${this.tableName}
    `;
    return result.length > 0;
  }

  public async createDatabase() {
    const database = this.config.database || process.env.PGDATABASE;
    const sql = postgres({
      ...this.config,
      database: 'postgres',
    });
    try {
      const result = await sql`
        SELECT 1
        FROM pg_database
        WHERE datname = ${database}
      `;
      if (result.length === 0) {
        await sql.unsafe(`CREATE DATABASE ${database}`);
      }
    } finally {
      await sql.end();
    }
  }

  public async dropDatabase() {
    const database = this.config.database || process.env.PGDATABASE;
    const sql = postgres({
      ...this.config,
      database: 'postgres',
    });
    try {
      const result = await sql`
        SELECT 1
        FROM pg_database
        WHERE datname = '${database}'
      `;
      if (result.length > 0) {
        await sql.unsafe(`DROP DATABASE ${database}`);
      }
    } finally {
      await sql.end();
    }
  }

  public async dropTable(): Promise<void> {
    await this.dropIndex();
    await this.sql.unsafe(`DROP TABLE IF EXISTS ${this.tableName}`);
  }

  public async migrate(originalMigrations: Migration[]): Promise<void> {
    const migrations = [...originalMigrations];
    await this.init();
    const promises: Promise<void>[] = [];
    let migrationCount = migrations.length;
    const migrationVersionLookup: Dict<boolean> = {};
    migrations.map(migration => (migrationVersionLookup[migration.version] = true));
    while (migrationCount > 0) {
      let index = 0;
      while (index < migrations.length) {
        const migration = migrations[index];
        let processMigration = true;
        if (this.migrationStatus[migration.version]) {
          migrations.splice(index, 1);
          continue; // migration already applied
        }
        if (migration.parent !== undefined) {
          for (const version of migration.parent) {
            if (!this.migrationPromises[version]) {
              if (!migrationVersionLookup[version]) {
                throw `Parent «${version}» not found for migration «${migrations[0].version}».`;
              }
              processMigration = false;
              break;
            }
          }
        }
        if (processMigration) {
          promises.push(this.up(migration));
          migrations.splice(index, 1);
        } else {
          index += 1;
        }
      }
      if (migrationCount === migrations.length) {
        throw `
          Migrations build a infinite loop.
          Unable to add versions «${migrations.map(migration => migration.version).join('», «')}».
        `;
      }
      migrationCount = migrations.length;
    }
    await Promise.all(promises);
  }

  public async up(migration: Migration): Promise<void> {
    const parent = migration.parent || (this.lastMigration ? [this.lastMigration] : []);
    const parentPromises = parent.map(version => {
      const process = this.migrationPromises[version];
      if (!process) throw `Parent Migration «${version}» missing.`;
      return process;
    });
    this.lastMigration = migration.version;
    return (this.migrationPromises[migration.version] = new Promise(async (resolve, _) => {
      await this.init();
      await Promise.all(parentPromises);
      await this.sql.begin(async (sql: any) => {
        await migration.up(sql);
        await this.insertMigrationVersion(sql, migration.version);
      });
      this.migrationStatus[migration.version] = true;
      resolve();
    }));
  }

  public async down(migration: Migration): Promise<void> {
    await this.init();
    await this.sql.begin(async (sql: any) => {
      await migration.down(sql);
      await this.deleteMigrationVersion(sql, migration.version);
    });
    delete this.migrationPromises[migration.version];
    delete this.migrationStatus[migration.version];
  }

  public async disconnect(): Promise<void> {
    await this.sql.end();
  }
}

export default Connector;
