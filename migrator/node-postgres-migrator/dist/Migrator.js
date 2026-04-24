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
const Connector_1 = require("./Connector");
const path_1 = require("path");
const fs_1 = require("fs");
class Migrator {
    constructor(config) {
        this.tableName = 'migrations';
        if (config) {
            if (config.tableName) {
                this.tableName = config.tableName;
            }
            delete config.tableName;
            this.config = config;
        }
    }
    connect() {
        return new Connector_1.Connector(this.tableName, this.config);
    }
    createDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.createDatabase();
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    dropDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.dropDatabase();
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    createTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.createTable();
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    tableExists() {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            let result = false;
            try {
                result = yield connector.tableExists();
            }
            finally {
                yield connector.disconnect();
                return result;
            }
        });
    }
    dropTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.dropTable();
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    migrate(migrations) {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.migrate(migrations);
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    up(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.up(migration);
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    down(migration) {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            try {
                yield connector.down(migration);
            }
            finally {
                yield connector.disconnect();
            }
        });
    }
    getStatusOfMigrations(migrations) {
        return __awaiter(this, void 0, void 0, function* () {
            const connector = this.connect();
            const status = {};
            for (const migration of migrations) {
                const { name, version } = migration;
                status[version] = { name, isApplied: false };
            }
            try {
                const versions = yield connector.getMigrationVersions();
                for (const version of versions) {
                    status[version] = status[version] || { isApplied: true };
                    status[version].isApplied = status[version].isApplied || true;
                }
            }
            finally {
                yield connector.disconnect();
            }
            return status;
        });
    }
    static getMigrationFileNamesFromPath(path) {
        const files = fs_1.readdirSync(path);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        return jsFiles.map(file => path_1.basename(file, '.js'));
    }
    static readMigrationFromPath(path, fileName) {
        const version = fileName.split(/[-_]/)[0];
        const name = fileName.substr(version.length + 1);
        return Object.assign({ version, name }, require(`${path}/${fileName}`));
    }
    static getMigrationsFromPath(path) {
        return this.getMigrationFileNamesFromPath(path).map(name => this.readMigrationFromPath(path, name));
    }
}
exports.Migrator = Migrator;
exports.default = Migrator;
//# sourceMappingURL=Migrator.js.map