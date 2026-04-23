import { BaseType, Connector, Scope, Dict, KeyType } from '@next-model/core';
import * as Knex from 'knex';
export interface DataApiConfig {
    secretArn: string;
    resourceArn: string;
    database: string;
    debug: boolean;
}
export declare class DataApiConnector implements Connector {
    dataApi: any;
    knex: Knex<any, unknown[]>;
    debug: boolean;
    constructor(options: DataApiConfig);
    private currentMilliseconds;
    private queryDataApi;
    private table;
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
    private collection;
    query(scope: Scope): Promise<Dict<any>[]>;
    count(scope: Scope): Promise<number>;
    select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]>;
    updateAll(scope: Scope, attrs: Dict<any>): Promise<Dict<any>[]>;
    deleteAll(scope: Scope): Promise<Dict<any>[]>;
    batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]>;
    execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]>;
}
export default DataApiConnector;
