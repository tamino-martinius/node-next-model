import * as postgres from 'postgres';
export class Connector {
    constructor(tableName = 'migrations', config) {
        this.tableName = tableName;
        this.migrationPromises = {};
        this.migrationStatus = {};
        this.initStatus = false;
        if (!this.isTableNameValid)
            throw `Invalid table name «${this.tableName}»`;
        this.config = config || {};
    }
    get sql() {
        if (this.cachedSql)
            return this.cachedSql;
        return (this.cachedSql = postgres(this.config));
    }
    get isTableNameValid() {
        return /[a-z]([a-z0-9_])*/.test(this.tableName);
    }
    async createIndex() {
        await this.sql.unsafe(`
      CREATE UNIQUE INDEX "${this.tableName}__version"
      ON "${this.tableName}" ("version");
    `);
    }
    async createTable() {
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
    async dropIndex() {
        await this.sql.unsafe(`
      DROP INDEX IF EXISTS "${this.tableName}__version"
    `);
    }
    async insertMigrationVersion(sql, version) {
        await sql.unsafe(`
      INSERT INTO
      "${this.tableName}"("version", "timestamp")
      VALUES($1, current_timestamp)
    `, [version]);
    }
    async deleteMigrationVersion(sql, version) {
        await sql.unsafe(`
      DELETE FROM "${this.tableName}"
      WHERE version = $1
    `, [version]);
    }
    async init() {
        if (this.initStatus === true)
            return Promise.resolve();
        if (this.initStatus === false) {
            return (this.initStatus = new Promise(async (resolve) => {
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
            }));
        }
    }
    async getMigrationVersions() {
        await this.init();
        const result = await this.sql.unsafe(`
      SELECT version FROM "${this.tableName}"
    `);
        return result.map((row) => row.version);
    }
    async tableExists() {
        const result = await this.sql `
      SELECT * FROM "information_schema"."tables"
      WHERE "table_schema" = current_schema()
        AND "table_name" = ${this.tableName}
    `;
        return result.length > 0;
    }
    async createDatabase() {
        const database = this.config.database || process.env.PGDATABASE;
        const sql = postgres({
            ...this.config,
            database: 'postgres',
        });
        try {
            const result = await sql `
        SELECT 1
        FROM pg_database
        WHERE datname = ${database}
      `;
            if (result.length === 0) {
                await sql.unsafe(`CREATE DATABASE ${database}`);
            }
        }
        finally {
            await sql.end();
        }
    }
    async dropDatabase() {
        const database = this.config.database || process.env.PGDATABASE;
        const sql = postgres({
            ...this.config,
            database: 'postgres',
        });
        try {
            const result = await sql `
        SELECT 1
        FROM pg_database
        WHERE datname = '${database}'
      `;
            if (result.length > 0) {
                await sql.unsafe(`DROP DATABASE ${database}`);
            }
        }
        finally {
            await sql.end();
        }
    }
    async dropTable() {
        await this.dropIndex();
        await this.sql.unsafe(`DROP TABLE IF EXISTS ${this.tableName}`);
    }
    async migrate(originalMigrations) {
        const migrations = [...originalMigrations];
        await this.init();
        const promises = [];
        let migrationCount = migrations.length;
        const migrationVersionLookup = {};
        migrations.map(migration => (migrationVersionLookup[migration.version] = true));
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
        const parentPromises = parent.map(version => {
            const process = this.migrationPromises[version];
            if (!process)
                throw `Parent Migration «${version}» missing.`;
            return process;
        });
        this.lastMigration = migration.version;
        return (this.migrationPromises[migration.version] = new Promise(async (resolve, _) => {
            await this.init();
            await Promise.all(parentPromises);
            await this.sql.begin(async (sql) => {
                await migration.up(sql);
                await this.insertMigrationVersion(sql, migration.version);
            });
            this.migrationStatus[migration.version] = true;
            resolve();
        }));
    }
    async down(migration) {
        await this.init();
        await this.sql.begin(async (sql) => {
            await migration.down(sql);
            await this.deleteMigrationVersion(sql, migration.version);
        });
        delete this.migrationPromises[migration.version];
        delete this.migrationStatus[migration.version];
    }
    async disconnect() {
        await this.sql.end();
    }
}
export default Connector;
//# sourceMappingURL=Connector.mjs.map