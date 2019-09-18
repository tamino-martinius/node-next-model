import { Connector, Dict, Filter, KeyType, Order, OrderColumn, Schema, Scope } from './types';
export declare class ModelClass {
    static tableName: string;
    static filter: Filter<any> | undefined;
    static limit: number | undefined;
    static skip: number | undefined;
    static order: OrderColumn<any>[];
    static keys: Dict<KeyType>;
    static connector: Connector;
    static init: (props: Dict<any>) => Dict<any>;
    static modelScope(): Scope;
    static limitBy<M extends typeof ModelClass>(this: M, amount: number): M;
    static unlimited<M extends typeof ModelClass>(this: M): M;
    static skipBy<M extends typeof ModelClass>(this: M, amount: number): M;
    static unskipped<M extends typeof ModelClass>(this: M): M;
    static orderBy<M extends typeof ModelClass>(this: M, order: Order<any>): M;
    static unordered<M extends typeof ModelClass>(this: M): M;
    static reorder<M extends typeof ModelClass>(this: M, order: Order<any>): M;
    static filterBy<M extends typeof ModelClass>(this: M, andFilter: Filter<any>): M;
    static orFilterBy<M extends typeof ModelClass>(this: M, orFilter: Filter<any>): M;
    static unfiltered<M extends typeof ModelClass>(this: M): M;
    static build<M extends typeof ModelClass>(this: M, createProps: Dict<any>): InstanceType<M>;
    static buildScoped<M extends typeof ModelClass>(this: M, createProps: Dict<any>): InstanceType<M>;
    static create<M extends typeof ModelClass>(this: M, createProps: Dict<any>): Promise<InstanceType<M>>;
    static createScoped<M extends typeof ModelClass>(this: M, props: Dict<any>): Promise<InstanceType<M>>;
    static all<M extends typeof ModelClass>(this: M): Promise<InstanceType<M>[]>;
    static first<M extends typeof ModelClass>(this: M): Promise<InstanceType<M> | undefined>;
    static select(...keys: any[]): Promise<Dict<any>[]>;
    static pluck(key: string): Promise<any[]>;
    persistentProps: Dict<any>;
    changedProps: Dict<any>;
    keys: Dict<any> | undefined;
    constructor(props: Dict<any>, keys?: Dict<any>);
    readonly isPersistent: boolean;
    readonly isNew: boolean;
    readonly attributes: Dict<any>;
    assign<M extends ModelClass>(this: M, props: Dict<any>): M;
    readonly itemScope: Scope;
    save<M extends ModelClass>(this: M): Promise<M>;
}
export declare function Model<CreateProps = {}, PersistentProps extends Schema = {}, Keys extends Dict<KeyType> = {
    id: KeyType.number;
}>(props: {
    tableName: string;
    init: (props: CreateProps) => PersistentProps;
    filter?: Filter<PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
    }>;
    limit?: number;
    skip?: number;
    order?: Order<PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
    }>;
    connector?: Connector;
    keys?: Keys;
}): {
    new (props: PersistentProps, keys?: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number; } | undefined): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly attributes: PersistentProps & { [K_2 in keyof Keys]: Keys[K_2] extends KeyType.uuid ? string : number; };
        assign<M extends ModelClass>(this: M, props: Partial<PersistentProps>): M;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly itemScope: Scope;
        save<M_1 extends ModelClass>(this: M_1): Promise<M_1>;
    };
    tableName: string;
    filter: Partial<PersistentProps & { [K_3 in keyof Keys]: Keys[K_3] extends KeyType.uuid ? string : number; }> | Partial<import("./types").FilterSpecial<PersistentProps & { [K_3 in keyof Keys]: Keys[K_3] extends KeyType.uuid ? string : number; }>> | undefined;
    limit: number | undefined;
    skip: number | undefined;
    order: OrderColumn<PersistentProps & { [K_4 in keyof Keys]: Keys[K_4] extends KeyType.uuid ? string : number; }>[];
    keys: Keys | {
        id: KeyType.number;
    };
    connector: Connector;
    init: any;
    orderBy<M_2 extends typeof ModelClass>(this: M_2, order: Order<PersistentProps & { [K_5 in keyof Keys]: Keys[K_5] extends KeyType.uuid ? string : number; }>): M_2;
    reorder<M_3 extends typeof ModelClass>(this: M_3, order: Order<PersistentProps & { [K_6 in keyof Keys]: Keys[K_6] extends KeyType.uuid ? string : number; }>): M_3;
    filterBy<M_4 extends typeof ModelClass>(this: M_4, filter: Filter<PersistentProps & { [K_7 in keyof Keys]: Keys[K_7] extends KeyType.uuid ? string : number; }>): M_4;
    orFilterBy<M_5 extends typeof ModelClass>(this: M_5, filter: Filter<PersistentProps & { [K_8 in keyof Keys]: Keys[K_8] extends KeyType.uuid ? string : number; }>): M_5;
    select(...keys: [keyof Keys | keyof PersistentProps][]): Promise<Partial<PersistentProps & { [K_9 in keyof Keys]: Keys[K_9] extends KeyType.uuid ? string : number; }>[]>;
    pluck(key: keyof Keys | keyof PersistentProps): Promise<any[]>;
    all<M_6 extends typeof ModelClass>(this: M_6): Promise<(InstanceType<M_6> & PersistentProps & Readonly<{ [K_10 in keyof Keys]: Keys[K_10] extends KeyType.uuid ? string : number; }>)[]>;
    first<M_7 extends typeof ModelClass>(this: M_7): Promise<InstanceType<M_7> & PersistentProps & Readonly<{ [K_11 in keyof Keys]: Keys[K_11] extends KeyType.uuid ? string : number; }>>;
    build<M_8 extends typeof ModelClass>(this: M_8, props: CreateProps): InstanceType<M_8> & PersistentProps & Readonly<{ [K_12 in keyof Keys]: Keys[K_12] extends KeyType.uuid ? string : number; }>;
    buildScoped<M_9 extends typeof ModelClass>(this: M_9, props: Partial<CreateProps>): InstanceType<M_9> & PersistentProps & Readonly<{ [K_13 in keyof Keys]: Keys[K_13] extends KeyType.uuid ? string : number; }>;
    create<M_10 extends typeof ModelClass>(this: M_10, props: CreateProps): Promise<InstanceType<M_10> & PersistentProps & Readonly<{ [K_14 in keyof Keys]: Keys[K_14] extends KeyType.uuid ? string : number; }>>;
    createScoped<M_11 extends typeof ModelClass>(this: M_11, props: Partial<CreateProps>): Promise<InstanceType<M_11> & PersistentProps & Readonly<{ [K_15 in keyof Keys]: Keys[K_15] extends KeyType.uuid ? string : number; }>>;
    modelScope(): Scope;
    limitBy<M_12 extends typeof ModelClass>(this: M_12, amount: number): M_12;
    unlimited<M_13 extends typeof ModelClass>(this: M_13): M_13;
    skipBy<M_14 extends typeof ModelClass>(this: M_14, amount: number): M_14;
    unskipped<M_15 extends typeof ModelClass>(this: M_15): M_15;
    unordered<M_16 extends typeof ModelClass>(this: M_16): M_16;
    unfiltered<M_17 extends typeof ModelClass>(this: M_17): M_17;
};
export default Model;
