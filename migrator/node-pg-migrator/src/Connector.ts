import { Pool, PoolConfig } from 'pg';
import { Dict, Migration } from './types';

export class Connector {
  private cachedPool: Pool | undefined;
  private migrationPromises: Dict<Promise<void>> = {};
  private migrationStatus: Dict<boolean> = {};
  private initStatus: boolean | Promise<void> = false;
  private lastMigration: string | undefined;

  constructor(public tableName: string, public poolConfig: PoolConfig | undefined) {
    if (!this.isTableNameValid) throw `Invalid table name «${this.tableName}»`;
  }

  get pool(): Pool {
    if (this.cachedPool) return this.cachedPool;
    return this.cachedPool = new Pool(this.poolConfig);
  }

  private get isTableNameValid() {
    return /[a-z]([a-z0-9_])*/.test(this.tableName);
  }

  private async createIndex(): Promise<void> {
    await this.pool.query({
      name: 'migrator--create-idnex',
      text: `CREATE UNIQUE INDEX "${this.tableName}__version" ON "${this.tableName}" ("version");`,
      values: [],
    });
  }

  public async createTable(): Promise<void> {
    await this.pool.query({
      name: 'migrator--create-table',
      text: `
        CREATE TABLE "${this.tableName}" (
          "id" SERIAL NOT NULL,
          "version" character varying NOT NULL,
          "timestamp" timestamp NOT NULL,
          PRIMARY KEY ("id")
        )
       `,
      values: [],
    });
    await this.createIndex();
  }

  private async dropIndex(): Promise<void> {
    await this.pool.query({
      name: 'migrator--drop-index',
      text: `DROP INDEX IF EXISTS "${this.tableName}__version"`,
      values: [],
    });

  }

  private async getMigrationVersions(): Promise<string[]> {
    const result = await this.pool.query({
      name: 'migrator--get-versions',
      text: `SELECT version FROM "${this.tableName}"`,
      values: [],
    });
    return result.rows.map(row => row.version);
  }

  private async insertMigrationVersion(version: string): Promise<void> {
    await this.pool.query({
      name: 'migrator--insert-version',
      text: `
        INSERT INTO
        "${this.tableName}"("version", "timestamp")
        VALUES($1, current_timestamp)
      `,
      values: [version],
    });
  }

  private async deleteMigrationVersion(version: string): Promise<void> {
    await this.pool.query({
      name: 'migrator--delete-version',
      text: `
        DELETE FROM "${this.tableName}"
        WHERE version = $1
      `,
      values: [version],
    });
  }

  private async beginTransaction(): Promise<void> {
    await this.pool.query({
      name: 'migrator--begin-transaction',
      text: 'BEGIN',
      values: [],
    });
  }

  private async endTransaction(): Promise<void> {
    await this.pool.query({
      name: 'migrator--end-transaction',
      text: 'COMMIT',
      values: [],
    });
  }

  private async rollbackTransaction(): Promise<void> {
    await this.pool.query({
      name: 'migrator--rollback-transaction',
      text: 'ROLLBACK',
      values: [],
    });
  }

  private async init(): Promise<void> {
    if (this.initStatus === true) return Promise.resolve();
    if (this.initStatus === false) {
      return this.initStatus = new Promise(async (resolve) => {
        const migrationTableExists = await this.tableExists();
        if (!migrationTableExists) await this.createTable();
        const migrationVersions = await this.getMigrationVersions();
        for (const version of migrationVersions) {
          this.migrationStatus[version] = true;
          this.migrationPromises[version] = Promise.resolve();
          this.lastMigration = version;
        }
        resolve();
      });
    }
  }

  public async tableExists(): Promise<boolean> {
    const result = await this.pool.query({
      name: 'migrator--table-exists',
      text: `
        SELECT * FROM "information_schema"."tables"
        WHERE "table_schema" = current_schema()
          AND "table_name" = $1
      `,
      values: [this.tableName],
    });
    return result.rowCount > 0;
  }

  public async createDatabase() {
    const pool = new Pool({ database: 'postgres' });
    try {
      const result = await pool.query({
        name: 'migrator--test--database-exists',
        text: `
          SELECT 1
          FROM pg_database
          WHERE datname = '${process.env.PGDATABASE}'
        `,
        values: [],
      });
      if (result.rows.length === 0) {
        await pool.query({
          name: 'migrator--test--create-database',
          text: `CREATE DATABASE "${process.env.PGDATABASE}"`,
          values: [],
        });
      }
    } finally {
      this.disconnect(pool);
    }
  }

  public async dropDatabase() {
    const pool = new Pool({ database: 'postgres' });
    try {
      const result = await pool.query({
        name: 'migrator--test--database-exists',
        text: `
          SELECT 1
          FROM pg_database
          WHERE datname = '${process.env.PGDATABASE}'
        `,
        values: [],
      });
      if (result.rows.length > 0) {
        await pool.query({
          name: 'migrator--test--drop-database',
          text: `DROP DATABASE "${process.env.PGDATABASE}"`,
          values: [],
        });
      }
    } finally {
      this.disconnect(pool);
    }
  }

  public async dropTable(): Promise<void> {
    await this.dropIndex();
    await this.pool.query({
      name: 'migrator--drop-table',
      text: `DROP TABLE IF EXISTS "${this.tableName}"`,
      values: [],
    });
  }

  public async migrate(migrations: Migration[]): Promise<void> {
    await this.init();
    const promises: Promise<void>[] = [];
    let migrationCount = migrations.length;
    const migrationVersionLookup: Dict<boolean> = {};
    migrations.map(migration => migrationVersionLookup[migration.version] = true);
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
    const parentPromises = parent.map((version) => {
      const process = this.migrationPromises[version];
      if (!process) throw `Parent Migration «${version}» missing.`;
      return process;
    });
    this.lastMigration = migration.version;
    return this.migrationPromises[migration.version] = new Promise(async (resolve, reject) => {
      await this.init();
      await Promise.all(parentPromises);
      try {
        await this.beginTransaction();
        await migration.up(this.pool);
        await this.insertMigrationVersion(migration.version);
        await this.endTransaction();
        this.migrationStatus[migration.version] = true;
      } catch (error) {
        await this.rollbackTransaction();
        return reject(error);
      }
      resolve();
    });
  }

  public async down(migration: Migration): Promise<void> {
    await this.init();
    try {
      await this.beginTransaction();
      await migration.down(this.pool);
      await this.deleteMigrationVersion(migration.version);
      await this.endTransaction();
      delete this.migrationPromises[migration.version];
      delete this.migrationStatus[migration.version];
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  public async disconnect(pool: Pool = this.pool): Promise<void> {
    if (pool.totalCount > 0) {
      await pool.end();
    }
  }
}

export default Connector;
