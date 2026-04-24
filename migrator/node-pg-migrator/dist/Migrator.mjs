import { Connector } from './Connector';
export class Migrator {
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
        return new Connector(this.tableName, this.poolConfig);
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
}
export default Migrator;
//# sourceMappingURL=Migrator.mjs.map