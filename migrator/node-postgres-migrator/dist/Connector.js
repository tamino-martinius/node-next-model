"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres = require("postgres");
class Connector {
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
    createIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sql.unsafe(`
      CREATE UNIQUE INDEX "${this.tableName}__version"
      ON "${this.tableName}" ("version");
    `);
        });
    }
    createTable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sql.unsafe(`
      CREATE TABLE "${this.tableName}" (
        "id" SERIAL NOT NULL,
        "version" character varying NOT NULL,
        "timestamp" timestamp NOT NULL,
        PRIMARY KEY ("id")
      )
    `);
            yield this.createIndex();
        });
    }
    dropIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sql.unsafe(`
      DROP INDEX IF EXISTS "${this.tableName}__version"
    `);
        });
    }
    insertMigrationVersion(sql, version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql.unsafe(`
      INSERT INTO
      "${this.tableName}"("version", "timestamp")
      VALUES($1, current_timestamp)
    `, [version]);
        });
    }
    deleteMigrationVersion(sql, version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql.unsafe(`
      DELETE FROM "${this.tableName}"
      WHERE version = $1
    `, [version]);
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initStatus === true)
                return Promise.resolve();
            if (this.initStatus === false) {
                return (this.initStatus = new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
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
                })));
            }
        });
    }
    getMigrationVersions() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const result = yield this.sql.unsafe(`
      SELECT version FROM "${this.tableName}"
    `);
            return result.map((row) => row.version);
        });
    }
    tableExists() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.sql `
      SELECT * FROM "information_schema"."tables"
      WHERE "table_schema" = current_schema()
        AND "table_name" = ${this.tableName}
    `;
            return result.length > 0;
        });
    }
    createDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const database = this.config.database || process.env.PGDATABASE;
            const sql = postgres(Object.assign(Object.assign({}, this.config), { database: 'postgres' }));
            try {
                const result = yield sql `
        SELECT 1
        FROM pg_database
        WHERE datname = ${database}
      `;
                if (result.length === 0) {
                    yield sql.unsafe(`CREATE DATABASE ${database}`);
                }
            }
            finally {
                yield sql.end();
            }
        });
    }
    dropDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const database = this.config.database || process.env.PGDATABASE;
            const sql = postgres(Object.assign(Object.assign({}, this.config), { database: 'postgres' }));
            try {
                const result = yield sql `
        SELECT 1
        FROM pg_database
        WHERE datname = '${database}'
      `;
                if (result.length > 0) {
                    yield sql.unsafe(`DROP DATABASE ${database}`);
                }
            }
            finally {
                yield sql.end();
            }
        });
    }
    dropTable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dropIndex();
            yield this.sql.unsafe(`DROP TABLE IF EXISTS ${this.tableName}`);
        });
    }
    migrate(originalMigrations) {
        return __awaiter(this, void 0, void 0, function* () {
            const migrations = [...originalMigrations];
            yield this.init();
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
            yield Promise.all(promises);
        });
    }
    up(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            const parent = migration.parent || (this.lastMigration ? [this.lastMigration] : []);
            const parentPromises = parent.map(version => {
                const process = this.migrationPromises[version];
                if (!process)
                    throw `Parent Migration «${version}» missing.`;
                return process;
            });
            this.lastMigration = migration.version;
            return (this.migrationPromises[migration.version] = new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () {
                yield this.init();
                yield Promise.all(parentPromises);
                yield this.sql.begin((sql) => __awaiter(this, void 0, void 0, function* () {
                    yield migration.up(sql);
                    yield this.insertMigrationVersion(sql, migration.version);
                }));
                this.migrationStatus[migration.version] = true;
                resolve();
            })));
        });
    }
    down(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            yield this.sql.begin((sql) => __awaiter(this, void 0, void 0, function* () {
                yield migration.down(sql);
                yield this.deleteMigrationVersion(sql, migration.version);
            }));
            delete this.migrationPromises[migration.version];
            delete this.migrationStatus[migration.version];
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sql.end();
        });
    }
}
exports.Connector = Connector;
exports.default = Connector;
//# sourceMappingURL=Connector.js.map