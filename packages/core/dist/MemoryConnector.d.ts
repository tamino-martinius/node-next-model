import { type TableBuilder } from './schema';
import { type AggregateKind, type BaseType, type Connector, type Dict, KeyType, type Scope } from './types';
export type Storage = Dict<Dict<any>[]>;
export declare class MemoryConnector implements Connector {
    private storage;
    private lastIds;
    private inTransaction;
    constructor(props?: {
        storage?: Storage;
        lastIds?: Dict<number>;
    });
    private collection;
    private nextId;
    private items;
    query(scope: Scope): Promise<Dict<any>[]>;
    count(scope: Scope): Promise<number>;
    select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]>;
    updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]>;
    deleteAll(scope: Scope): Promise<Dict<any>[]>;
    batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]>;
    hasTable(tableName: string): Promise<boolean>;
    createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void>;
    dropTable(tableName: string): Promise<void>;
    aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined>;
    execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]>;
    transaction<T>(fn: () => Promise<T>): Promise<T>;
}
export default MemoryConnector;
//# sourceMappingURL=MemoryConnector.d.ts.map