import { Connector, Dict, Filter, KeyType, Order, Schema, Scope } from './types';
export declare function Model<CreateProps = {}, PersistentProps extends Schema = {}, Keys extends Dict<KeyType> = {
    id: KeyType.number;
}>({ tableName, init, filter, limit, skip, order, connector, keys, }: {
    tableName: string;
    init: (props: CreateProps) => PersistentProps;
    filter?: Filter<PersistentProps & {
        [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }>;
    limit?: number;
    skip?: number;
    order?: Order<PersistentProps>;
    connector?: Connector;
    keys?: Keys;
}): {
    new (props: PersistentProps, keys?: { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number; } | undefined): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    };
    limitBy(amount: number): any;
    readonly unlimited: any;
    skipBy(amount: number): any;
    readonly unskipped: any;
    orderBy(order: Order<PersistentProps>): any;
    readonly unordered: any;
    reorder(order: Order<PersistentProps>): any;
    filterBy(andFilter: Filter<PersistentProps & { [P_2 in keyof Keys]: Keys[P_2] extends KeyType.uuid ? string : number; }>): any;
    orFilterBy(orFilter: Filter<PersistentProps & { [P_3 in keyof Keys]: Keys[P_3] extends KeyType.uuid ? string : number; }>): any;
    readonly unfiltered: any;
    build(props: CreateProps): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    };
    buildScoped(props: Partial<CreateProps>): {
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    };
    create(props: CreateProps): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    }>;
    createScoped(props: Partial<CreateProps>): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    }>;
    all(): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    }[]>;
    first(): Promise<{
        persistentProps: PersistentProps;
        changedProps: Partial<PersistentProps>;
        keys: { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; } | undefined;
        readonly isPersistent: boolean;
        readonly isNew: boolean;
        readonly attributes: PersistentProps & Partial<PersistentProps> & { [P_1 in keyof Keys]: Keys[P_1] extends KeyType.uuid ? string : number; };
        assign(props: Partial<PersistentProps>): void;
        readonly itemScope: Scope;
        save(): Promise<any>;
    } | undefined>;
    select(...keys: [keyof Keys | keyof PersistentProps][]): Promise<Partial<PersistentProps & { [P_4 in keyof Keys]: Keys[P_4] extends KeyType.uuid ? string : number; }>[]>;
    pluck(key: keyof Keys | keyof PersistentProps): Promise<Partial<PersistentProps & { [P_4 in keyof Keys]: Keys[P_4] extends KeyType.uuid ? string : number; }>[keyof Keys | keyof PersistentProps][]>;
};
