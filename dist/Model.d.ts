import { Connector, Dict, Filter, KeyType, Order, OrderColumn, Schema, Scope } from './types';
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
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    };
    tableName: string;
    filter: Partial<PersistentProps & { [K_2 in keyof Keys]: Keys[K_2] extends KeyType.uuid ? string : number; }> | Partial<import("./types").FilterSpecial<PersistentProps & { [K_2 in keyof Keys]: Keys[K_2] extends KeyType.uuid ? string : number; }>> | undefined;
    limit: number | undefined;
    skip: number | undefined;
    order: OrderColumn<PersistentProps & { [K_3 in keyof Keys]: Keys[K_3] extends KeyType.uuid ? string : number; }>[];
    modelScope(): Scope;
    limitBy<M_2 extends any>(this: M_2, amount: number): M_2;
    unlimited<M_3 extends any>(this: M_3): M_3;
    skipBy<M_4 extends any>(this: M_4, amount: number): M_4;
    unskipped<M_5 extends any>(this: M_5): M_5;
    orderBy<M_6 extends any>(this: M_6, order: Order<PersistentProps & { [K_4 in keyof Keys]: Keys[K_4] extends KeyType.uuid ? string : number; }>): M_6;
    unordered<M_7 extends any>(this: M_7): M_7;
    reorder<M_8 extends any>(this: M_8, order: Order<PersistentProps & { [K_5 in keyof Keys]: Keys[K_5] extends KeyType.uuid ? string : number; }>): M_8;
    filterBy<M_9 extends any>(this: M_9, andFilter: Filter<PersistentProps & { [K_6 in keyof Keys]: Keys[K_6] extends KeyType.uuid ? string : number; }>): M_9;
    orFilterBy<M_10 extends any>(this: M_10, orFilter: Filter<PersistentProps & { [K_7 in keyof Keys]: Keys[K_7] extends KeyType.uuid ? string : number; }>): M_10;
    unfiltered<M_11 extends any>(this: M_11): M_11;
    build(createProps: CreateProps): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_8 in keyof Keys]: Keys[K_8] extends KeyType.uuid ? string : number; }>;
    buildScoped(createProps: Partial<CreateProps>): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_9 in keyof Keys]: Keys[K_9] extends KeyType.uuid ? string : number; }>;
    create(props: CreateProps): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_8 in keyof Keys]: Keys[K_8] extends KeyType.uuid ? string : number; }>>;
    createScoped(props: Partial<CreateProps>): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_9 in keyof Keys]: Keys[K_9] extends KeyType.uuid ? string : number; }>>;
    all(): Promise<({
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_10 in keyof Keys]: Keys[K_10] extends KeyType.uuid ? string : number; }>)[]>;
    first(): Promise<({
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [K_1 in keyof Keys]: Keys[K_1] extends KeyType.uuid ? string : number; };
        assign<M extends any>(this: M, props: Partial<PersistentProps>): M;
        readonly itemScope: Scope;
        save<M_1 extends any>(this: M_1): Promise<M_1>;
    } & PersistentProps & Readonly<{ [K_10 in keyof Keys]: Keys[K_10] extends KeyType.uuid ? string : number; }>) | undefined>;
    select(...keys: [keyof Keys | keyof PersistentProps][]): Promise<Partial<PersistentProps & { [K_11 in keyof Keys]: Keys[K_11] extends KeyType.uuid ? string : number; }>[]>;
    pluck(key: keyof Keys | keyof PersistentProps): Promise<Partial<PersistentProps & { [K_11 in keyof Keys]: Keys[K_11] extends KeyType.uuid ? string : number; }>[keyof Keys | keyof PersistentProps][]>;
};
export default Model;
