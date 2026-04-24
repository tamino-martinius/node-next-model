import { ConnectionConfig } from './Connector';
import { Dict, Migration } from './types';
export declare class Migrator {
    tableName: string;
    config: ConnectionConfig | undefined;
    constructor(config?: ConnectionConfig & {
        tableName?: string;
    });
    private connect;
    createDatabase(): Promise<void>;
    dropDatabase(): Promise<void>;
    createTable(): Promise<void>;
    tableExists(): Promise<boolean>;
    dropTable(): Promise<void>;
    migrate(migrations: Migration[]): Promise<void>;
    up(migration: Migration): Promise<void>;
    down(migration: Migration): Promise<void>;
    getStatusOfMigrations(migrations: Migration[]): Promise<Dict<{
        name?: string;
        isApplied: boolean;
    }>>;
    static getMigrationFileNamesFromPath(path: string): string[];
    static readMigrationFromPath(path: string, fileName: string): any;
    static getMigrationsFromPath(path: string): Migration[];
}
export default Migrator;
