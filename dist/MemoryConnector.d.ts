import { Dict, KeyType, Connector, BaseType, Scope } from './types';
export declare type Storage = Dict<Dict<any>[]>;
export declare class MemoryConnector implements Connector {
    private storage;
    private lastIds;
    constructor(props?: {
        storage?: Storage;
        lastIds?: Dict<number>;
    });
    private collection;
    private nextId;
    private items;
    private propertyFilter;
    private andFilter;
    private notFilter;
    private orFilter;
    private inFilter;
    private notInFilter;
    private nullFilter;
    private notNullFilter;
    private betweenFilter;
    private notBetweenFilter;
    private gtFilter;
    private gteFilter;
    private ltFilter;
    private lteFilter;
    private rawFilter;
    private asyncFilter;
    private specialFilter;
    private filter;
    query(scope: Scope): Promise<Dict<any>[]>;
    count(scope: Scope): Promise<number>;
    select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]>;
    updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]>;
    deleteAll(scope: Scope): Promise<Dict<any>[]>;
    batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]>;
    execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]>;
}
export default MemoryConnector;
