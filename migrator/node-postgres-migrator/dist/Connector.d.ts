import { Migration } from './types';
export interface ConnectionConfig {
    host?: string;
    port?: number;
    path?: string;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    max?: number;
    timeout?: number;
    types?: any;
    onnotice?: () => any;
    onparameter?: () => any;
    debug?: () => any;
    transform?: {
        column?: () => any;
        value?: () => any;
        row?: () => any;
    };
}
export declare class Connector {
    tableName: string;
    private cachedSql;
    private migrationPromises;
    private migrationStatus;
    private initStatus;
    private lastMigration;
    private config;
    constructor(tableName?: string, config?: ConnectionConfig);
    get sql(): any;
    private get isTableNameValid();
    private createIndex;
    createTable(): Promise<void>;
    private dropIndex;
    private insertMigrationVersion;
    private deleteMigrationVersion;
    private init;
    getMigrationVersions(): Promise<string[]>;
    tableExists(): Promise<boolean>;
    createDatabase(): Promise<void>;
    dropDatabase(): Promise<void>;
    dropTable(): Promise<void>;
    migrate(originalMigrations: Migration[]): Promise<void>;
    up(migration: Migration): Promise<void>;
    down(migration: Migration): Promise<void>;
    disconnect(): Promise<void>;
}
export default Connector;
