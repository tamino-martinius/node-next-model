import { Dict, Migration } from './types';
import { Connector } from './Connector';
export declare class Migrator {
    connector: Connector;
    migrationPromises: Dict<Promise<void>>;
    migrationStatus: Dict<boolean>;
    initStatus: boolean | Promise<void>;
    lastMigration: string | undefined;
    constructor(connector: Connector);
    init(): Promise<void>;
    migrate(migrations: Migration[]): Promise<void>;
    up(migration: Migration): Promise<void>;
    down(migration: Migration): Promise<void>;
}
export default Migrator;
