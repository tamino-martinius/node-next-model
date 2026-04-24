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
const Connector_1 = require("./Connector");
class Migrator {
    constructor(poolConfig) {
        this.tableName = 'migrations';
        if (poolConfig) {
            if (poolConfig.tableName) {
                this.tableName = poolConfig.tableName;
            }
            delete poolConfig.tableName;
            this.poolConfig = poolConfig;
        }
    }
    connect() {
        return new Connector_1.Connector(this.tableName, this.poolConfig);
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
}
exports.Migrator = Migrator;
exports.default = Migrator;
//# sourceMappingURL=Migrator.js.map