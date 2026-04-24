import { Pool } from 'pg';
export class Connector {
    constructor(tableName, poolConfig) {
        this.tableName = tableName;
        this.poolConfig = poolConfig;
        this.migrationPromises = {};
        this.migrationStatus = {};
        this.initStatus = false;
        if (!this.isTableNameValid)
            throw `Invalid table name «${this.tableName}»`;
    }
    get pool() {
        if (this.cachedPool)
            return this.cachedPool;
        return this.cachedPool = new Pool(this.poolConfig);
    }
    get isTableNameValid() {
        return /[a-z]([a-z0-9_])*/.test(this.tableName);
    }
    async createIndex() {
        await this.pool.query({
            name: 'migrator--create-idnex',
            text: `CREATE UNIQUE INDEX "${this.tableName}__version" ON "${this.tableName}" ("version");`,
            values: [],
        });
    }
    async createTable() {
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
    async dropIndex() {
        await this.pool.query({
            name: 'migrator--drop-index',
            text: `DROP INDEX IF EXISTS "${this.tableName}__version"`,
            values: [],
        });
    }
    async getMigrationVersions() {
        const result = await this.pool.query({
            name: 'migrator--get-versions',
            text: `SELECT version FROM "${this.tableName}"`,
            values: [],
        });
        return result.rows.map(row => row.version);
    }
    async insertMigrationVersion(version) {
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
    async deleteMigrationVersion(version) {
        await this.pool.query({
            name: 'migrator--delete-version',
            text: `
        DELETE FROM "${this.tableName}"
        WHERE version = $1
      `,
            values: [version],
        });
    }
    async beginTransaction() {
        await this.pool.query({
            name: 'migrator--begin-transaction',
            text: 'BEGIN',
            values: [],
        });
    }
    async endTransaction() {
        await this.pool.query({
            name: 'migrator--end-transaction',
            text: 'COMMIT',
            values: [],
        });
    }
    async rollbackTransaction() {
        await this.pool.query({
            name: 'migrator--rollback-transaction',
            text: 'ROLLBACK',
            values: [],
        });
    }
    async init() {
        if (this.initStatus === true)
            return Promise.resolve();
        if (this.initStatus === false) {
            return this.initStatus = new Promise(async (resolve) => {
                const migrationTableExists = await this.tableExists();
                if (!migrationTableExists)
                    await this.createTable();
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
    async tableExists() {
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
    async createDatabase() {
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
        }
        finally {
            this.disconnect(pool);
        }
    }
    async dropDatabase() {
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
        }
        finally {
            this.disconnect(pool);
        }
    }
    async dropTable() {
        await this.dropIndex();
        await this.pool.query({
            name: 'migrator--drop-table',
            text: `DROP TABLE IF EXISTS "${this.tableName}"`,
            values: [],
        });
    }
    async migrate(migrations) {
        await this.init();
        const promises = [];
        let migrationCount = migrations.length;
        const migrationVersionLookup = {};
        migrations.map(migration => migrationVersionLookup[migration.version] = true);
        while (migrationCount > 0) {
            let index = 0;
            while (index < migrations.length) {
                const migration = migrations[index];
                let processMigration = true;
                if (this.migrationStatus[migration.version]) {
                    migrations.splice(index, 1);
                    continue;
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
                }
                else {
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
    async up(migration) {
        const parent = migration.parent || (this.lastMigration ? [this.lastMigration] : []);
        const parentPromises = parent.map((version) => {
            const process = this.migrationPromises[version];
            if (!process)
                throw `Parent Migration «${version}» missing.`;
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
            }
            catch (error) {
                await this.rollbackTransaction();
                return reject(error);
            }
            resolve();
        });
    }
    async down(migration) {
        await this.init();
        try {
            await this.beginTransaction();
            await migration.down(this.pool);
            await this.deleteMigrationVersion(migration.version);
            await this.endTransaction();
            delete this.migrationPromises[migration.version];
            delete this.migrationStatus[migration.version];
        }
        catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }
    async disconnect(pool = this.pool) {
        if (pool.totalCount > 0) {
            await pool.end();
        }
    }
}
export default Connector;
//# sourceMappingURL=Connector.mjs.map