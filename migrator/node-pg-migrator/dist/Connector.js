"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
class Connector {
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
        return this.cachedPool = new pg_1.Pool(this.poolConfig);
    }
    get isTableNameValid() {
        return /[a-z]([a-z0-9_])*/.test(this.tableName);
    }
    createIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--create-idnex',
                text: `CREATE UNIQUE INDEX "${this.tableName}__version" ON "${this.tableName}" ("version");`,
                values: [],
            });
        });
    }
    createTable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
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
            yield this.createIndex();
        });
    }
    dropIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--drop-index',
                text: `DROP INDEX IF EXISTS "${this.tableName}__version"`,
                values: [],
            });
        });
    }
    getMigrationVersions() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.pool.query({
                name: 'migrator--get-versions',
                text: `SELECT version FROM "${this.tableName}"`,
                values: [],
            });
            return result.rows.map(row => row.version);
        });
    }
    insertMigrationVersion(version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--insert-version',
                text: `
        INSERT INTO
        "${this.tableName}"("version", "timestamp")
        VALUES($1, current_timestamp)
      `,
                values: [version],
            });
        });
    }
    deleteMigrationVersion(version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--delete-version',
                text: `
        DELETE FROM "${this.tableName}"
        WHERE version = $1
      `,
                values: [version],
            });
        });
    }
    beginTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--begin-transaction',
                text: 'BEGIN',
                values: [],
            });
        });
    }
    endTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--end-transaction',
                text: 'COMMIT',
                values: [],
            });
        });
    }
    rollbackTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pool.query({
                name: 'migrator--rollback-transaction',
                text: 'ROLLBACK',
                values: [],
            });
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initStatus === true)
                return Promise.resolve();
            if (this.initStatus === false) {
                return this.initStatus = new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    const migrationTableExists = yield this.tableExists();
                    if (!migrationTableExists)
                        yield this.createTable();
                    const migrationVersions = yield this.getMigrationVersions();
                    for (const version of migrationVersions) {
                        this.migrationStatus[version] = true;
                        this.migrationPromises[version] = Promise.resolve();
                        this.lastMigration = version;
                    }
                    resolve();
                }));
            }
        });
    }
    tableExists() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.pool.query({
                name: 'migrator--table-exists',
                text: `
        SELECT * FROM "information_schema"."tables"
        WHERE "table_schema" = current_schema()
          AND "table_name" = $1
      `,
                values: [this.tableName],
            });
            return result.rowCount > 0;
        });
    }
    createDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = new pg_1.Pool({ database: 'postgres' });
            try {
                const result = yield pool.query({
                    name: 'migrator--test--database-exists',
                    text: `
          SELECT 1
          FROM pg_database
          WHERE datname = '${process.env.PGDATABASE}'
        `,
                    values: [],
                });
                if (result.rows.length === 0) {
                    yield pool.query({
                        name: 'migrator--test--create-database',
                        text: `CREATE DATABASE "${process.env.PGDATABASE}"`,
                        values: [],
                    });
                }
            }
            finally {
                this.disconnect(pool);
            }
        });
    }
    dropDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = new pg_1.Pool({ database: 'postgres' });
            try {
                const result = yield pool.query({
                    name: 'migrator--test--database-exists',
                    text: `
          SELECT 1
          FROM pg_database
          WHERE datname = '${process.env.PGDATABASE}'
        `,
                    values: [],
                });
                if (result.rows.length > 0) {
                    yield pool.query({
                        name: 'migrator--test--drop-database',
                        text: `DROP DATABASE "${process.env.PGDATABASE}"`,
                        values: [],
                    });
                }
            }
            finally {
                this.disconnect(pool);
            }
        });
    }
    dropTable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dropIndex();
            yield this.pool.query({
                name: 'migrator--drop-table',
                text: `DROP TABLE IF EXISTS "${this.tableName}"`,
                values: [],
            });
        });
    }
    migrate(migrations) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
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
            yield Promise.all(promises);
        });
    }
    up(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            const parent = migration.parent || (this.lastMigration ? [this.lastMigration] : []);
            const parentPromises = parent.map((version) => {
                const process = this.migrationPromises[version];
                if (!process)
                    throw `Parent Migration «${version}» missing.`;
                return process;
            });
            this.lastMigration = migration.version;
            return this.migrationPromises[migration.version] = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                yield this.init();
                yield Promise.all(parentPromises);
                try {
                    yield this.beginTransaction();
                    yield migration.up(this.pool);
                    yield this.insertMigrationVersion(migration.version);
                    yield this.endTransaction();
                    this.migrationStatus[migration.version] = true;
                }
                catch (error) {
                    yield this.rollbackTransaction();
                    return reject(error);
                }
                resolve();
            }));
        });
    }
    down(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            try {
                yield this.beginTransaction();
                yield migration.down(this.pool);
                yield this.deleteMigrationVersion(migration.version);
                yield this.endTransaction();
                delete this.migrationPromises[migration.version];
                delete this.migrationStatus[migration.version];
            }
            catch (error) {
                yield this.rollbackTransaction();
                throw error;
            }
        });
    }
    disconnect(pool = this.pool) {
        return __awaiter(this, void 0, void 0, function* () {
            if (pool.totalCount > 0) {
                yield pool.end();
            }
        });
    }
}
exports.Connector = Connector;
exports.default = Connector;
//# sourceMappingURL=Connector.js.map