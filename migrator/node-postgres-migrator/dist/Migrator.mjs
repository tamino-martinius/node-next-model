import { Connector } from './Connector';
import { basename } from 'path';
import { readdirSync } from 'fs';
export class Migrator {
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
        return new Connector(this.tableName, this.config);
    }
    async createDatabase() {
        const connector = this.connect();
        try {
            await connector.createDatabase();
        }
        finally {
            await connector.disconnect();
        }
    }
    async dropDatabase() {
        const connector = this.connect();
        try {
            await connector.dropDatabase();
        }
        finally {
            await connector.disconnect();
        }
    }
    async createTable() {
        const connector = this.connect();
        try {
            await connector.createTable();
        }
        finally {
            await connector.disconnect();
        }
    }
    async tableExists() {
        const connector = this.connect();
        let result = false;
        try {
            result = await connector.tableExists();
        }
        finally {
            await connector.disconnect();
            return result;
        }
    }
    async dropTable() {
        const connector = this.connect();
        try {
            await connector.dropTable();
        }
        finally {
            await connector.disconnect();
        }
    }
    async migrate(migrations) {
        const connector = this.connect();
        try {
            await connector.migrate(migrations);
        }
        finally {
            await connector.disconnect();
        }
    }
    async up(migration) {
        const connector = this.connect();
        try {
            await connector.up(migration);
        }
        finally {
            await connector.disconnect();
        }
    }
    async down(migration) {
        const connector = this.connect();
        try {
            await connector.down(migration);
        }
        finally {
            await connector.disconnect();
        }
    }
    async getStatusOfMigrations(migrations) {
        const connector = this.connect();
        const status = {};
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
        }
        finally {
            await connector.disconnect();
        }
        return status;
    }
    static getMigrationFileNamesFromPath(path) {
        const files = readdirSync(path);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        return jsFiles.map(file => basename(file, '.js'));
    }
    static readMigrationFromPath(path, fileName) {
        const version = fileName.split(/[-_]/)[0];
        const name = fileName.substr(version.length + 1);
        return { version, name, ...require(`${path}/${fileName}`) };
    }
    static getMigrationsFromPath(path) {
        return this.getMigrationFileNamesFromPath(path).map(name => this.readMigrationFromPath(path, name));
    }
}
export default Migrator;
//# sourceMappingURL=Migrator.mjs.map