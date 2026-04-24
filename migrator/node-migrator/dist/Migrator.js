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
class Migrator {
    constructor(connector) {
        this.connector = connector;
        this.migrationPromises = {};
        this.migrationStatus = {};
        this.initStatus = false;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initStatus === true)
                return Promise.resolve();
            if (this.initStatus === false) {
                return this.initStatus = new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    const migrationTableExists = yield this.connector.tableExists();
                    if (!migrationTableExists)
                        yield this.connector.createTable();
                    const migrationKeys = yield this.connector.getMigrationKeys();
                    for (const key of migrationKeys) {
                        this.migrationStatus[key] = true;
                        this.migrationPromises[key] = Promise.resolve();
                        this.lastMigration = key;
                    }
                    resolve();
                }));
            }
            return this.initStatus;
        });
    }
    migrate(migrations) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            let migrationCount = migrations.length;
            const migrationKeyLookup = {};
            migrations.map(migration => migrationKeyLookup[migration.key] = true);
            while (migrationCount > 0) {
                let index = 0;
                while (index < migrations.length) {
                    const migration = migrations[index];
                    let processMigration = true;
                    if (migration.parent !== undefined) {
                        for (const key of migration.parent) {
                            if (!this.migrationPromises[key]) {
                                if (!migrationKeyLookup[key]) {
                                    throw `Parent «${key}» not found for migration «${migrations[0].key}».`;
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
          Unable to add keys «${migrations.map(migration => migration.key).join('», «')}».
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
            const parentPromises = parent.map((key) => {
                const process = this.migrationPromises[key];
                if (!process)
                    throw `Parent Migration «${key}» missing.`;
                return process;
            });
            return this.migrationPromises[migration.key] = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                yield this.init();
                yield Promise.all(parentPromises);
                try {
                    yield this.connector.beginTransaction();
                    yield migration.up();
                    yield this.connector.insertMigrationKey(migration.key);
                    yield this.connector.endTransaction();
                    this.migrationStatus[migration.key] = true;
                }
                catch (error) {
                    yield this.connector.rollbackTransaction();
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
                yield this.connector.beginTransaction();
                yield migration.down();
                yield this.connector.deleteMigrationKey(migration.key);
                yield this.connector.endTransaction();
                delete this.migrationPromises[migration.key];
                delete this.migrationStatus[migration.key];
            }
            catch (error) {
                yield this.connector.rollbackTransaction();
                throw error;
            }
        });
    }
}
exports.Migrator = Migrator;
exports.default = Migrator;
//# sourceMappingURL=Migrator.js.map