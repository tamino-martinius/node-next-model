import { Migration } from './types';
import { PoolConfig } from 'pg';
export declare class Migrator {
    tableName: string;
    poolConfig: PoolConfig | undefined;
    constructor(poolConfig?: PoolConfig & {
        tableName: string;
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
}
export default Migrator;
