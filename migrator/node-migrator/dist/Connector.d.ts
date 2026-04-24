export declare abstract class Connector {
    tableName: string;
    constructor(tableName: string);
    abstract tableExists(): Promise<boolean>;
    abstract createTable(): Promise<void>;
    abstract dropTable(): Promise<void>;
    abstract getMigrationKeys(): Promise<string[]>;
    abstract insertMigrationKey(key: string): Promise<void>;
    abstract deleteMigrationKey(key: string): Promise<void>;
    abstract beginTransaction(): Promise<void>;
    abstract endTransaction(): Promise<void>;
    abstract rollbackTransaction(): Promise<void>;
}
export default Connector;
