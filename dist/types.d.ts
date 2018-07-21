export declare type BaseType = number | string | boolean | null | undefined;
export interface Identifiable {
    id: any;
}
export interface Dict<T> {
    [key: string]: T;
}
export declare type Tuple<T, U> = [T, U];
export interface Range<T> {
    from: T;
    to: T;
}
export interface Constructor<M> {
    new (...args: any[]): M;
}
export declare type Bindings = BaseType[] | {
    [key: string]: BaseType;
};
export declare type FilterIn<S extends Identifiable> = {
    [K in keyof S]: Array<S[K]>;
};
export declare type FilterBetween<S extends Identifiable> = {
    [K in keyof S]: Range<S[K]>;
};
export interface FilterRaw {
    $bindings: Bindings;
    $query: string;
}
export declare type Filter<S extends Identifiable> = Partial<S> | FilterSpecial<S>;
export declare type FilterSpecial<S extends Identifiable> = {
    $and?: Filter<S>[];
    $not?: Filter<S>;
    $or?: Filter<S>[];
    $in?: Partial<FilterIn<S>>;
    $notIn?: Partial<FilterIn<S>>;
    $null?: keyof S;
    $notNull?: keyof S;
    $between?: Partial<FilterBetween<S>>;
    $notBetween?: Partial<FilterBetween<S>>;
    $gt?: Partial<S>;
    $gte?: Partial<S>;
    $lt?: Partial<S>;
    $lte?: Partial<S>;
    $raw?: FilterRaw;
    $async?: Promise<Filter<S>>;
};
export declare type Validator<S extends Identifiable> = (instance: ModelConstructor<S>) => Promise<boolean>;
export declare enum DataType {
    bigInteger = 0,
    binary = 1,
    boolean = 2,
    date = 3,
    dateTime = 4,
    decimal = 5,
    enum = 6,
    float = 7,
    integer = 8,
    json = 9,
    jsonb = 10,
    string = 11,
    text = 12,
    time = 13,
    uuid = 14
}
export interface SchemaProperty<T> {
    type: DataType;
    defaultValue?: T | ((model: ModelConstructor<Identifiable>) => T);
}
export interface StrictSchemaProperty<T> {
    type: DataType;
    defaultValue: undefined | T | ((model: ModelConstructor<Identifiable>) => T);
}
export declare type Schema<S extends Identifiable> = {
    [P in keyof S]: SchemaProperty<S[P]>;
};
export declare type StrictSchema<S extends Identifiable> = {
    [P in keyof S]: StrictSchemaProperty<S[P]>;
};
export declare type QueryBy<S extends Identifiable> = {
    [P in keyof S]: (value: S[P] | S[P][]) => ModelStatic<S>;
};
export declare type QueryByModel<S extends Identifiable, M extends ModelStatic<S>> = {
    [P in keyof S]: (value: S[P] | S[P][]) => M;
};
export declare type Query<S extends Identifiable> = (query: Filter<S>) => ModelStatic<S>;
export declare type FindBy<S extends Identifiable> = {
    [P in keyof S]: (value: S[P] | S[P][]) => Promise<undefined | ModelConstructor<S>>;
};
export declare type FindByModel<S extends Identifiable, I extends ModelConstructor<S>> = {
    [P in keyof S]: (value: S[P] | S[P][]) => Promise<I | undefined>;
};
export declare enum OrderDirection {
    'asc' = 1,
    'desc' = -1
}
export declare type Order<S extends Identifiable> = {
    [P in keyof S]: OrderDirection;
};
export declare type Find<S extends Identifiable> = (query: Filter<S>) => Promise<undefined | ModelConstructor<S>>;
export declare type Changes<S extends Identifiable> = {
    [P in keyof S]: {
        from: S[P] | undefined;
        to: S[P] | undefined;
    };
};
export interface Storage {
    [key: string]: any[];
}
export interface ConnectorConstructor<S extends Identifiable> {
    query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
    count(model: ModelStatic<S>): Promise<number>;
    select(model: ModelStatic<S>, ...keys: (keyof S)[]): Promise<S[keyof S][][]>;
    updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<number>;
    deleteAll(model: ModelStatic<S>): Promise<number>;
    create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    update(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    delete(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    execute(query: string, bindings: Bindings): Promise<any[]>;
}
export interface RelationOptions {
    readonly filter?: Filter<any>;
    readonly through?: ModelStatic<any>;
    readonly foreignKey?: string;
}
export interface ModelStatic<S extends Identifiable> extends Function {
    readonly modelName: string;
    readonly lowerModelName: string;
    readonly underscoreModelName: string;
    readonly pluralModelName: string;
    readonly identifier: string;
    readonly collectionName: string | undefined;
    readonly connector: ConnectorConstructor<S>;
    readonly schema: Schema<S>;
    readonly filter: Filter<S>;
    readonly limit: number;
    readonly skip: number;
    readonly order: Partial<Order<S>>[];
    readonly keys: (keyof S)[];
    readonly validators: Validator<S>[];
    readonly strictSchema: StrictSchema<S>;
    readonly strictFilter: Filter<S>;
    getTyped<M extends ModelStatic<S>, I extends ModelConstructor<S>>(): ModelStaticClass<S, M, I>;
    limitBy(amount: number): ModelStatic<S>;
    readonly unlimited: ModelStatic<S>;
    skipBy(amount: number): ModelStatic<S>;
    readonly unskipped: ModelStatic<S>;
    orderBy(order: Partial<Order<S>>): ModelStatic<S>;
    reorder(order: Partial<Order<S>>): ModelStatic<S>;
    readonly unordered: ModelStatic<S>;
    query(query: Filter<S>): ModelStatic<S>;
    onlyQuery(query: Filter<S>): ModelStatic<S>;
    readonly queryBy: QueryBy<S>;
    readonly unfiltered: ModelStatic<S>;
    readonly all: Promise<ModelConstructor<S>[]>;
    pluck(key: keyof S): Promise<S[keyof S][]>;
    select(...keys: (keyof S)[]): Promise<S[keyof S][][]>;
    updateAll(attrs: Partial<S>): Promise<ModelStatic<S>>;
    deleteAll(): Promise<ModelStatic<S>>;
    inBatchesOf(amount: number): Promise<Promise<ModelConstructor<S>[]>[]>;
    readonly first: Promise<ModelConstructor<S> | undefined>;
    find(query: Filter<S>): Promise<undefined | ModelConstructor<S>>;
    readonly findBy: FindBy<S>;
    readonly count: Promise<number>;
    new (attrs: Partial<S> | undefined): ModelConstructor<S>;
    build(attrs: Partial<S> | undefined): ModelConstructor<S>;
    create(attrs: Partial<S> | undefined): Promise<ModelConstructor<S>>;
}
export declare abstract class ModelStaticClass<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> {
    abstract limitBy(amount: number): M;
    abstract readonly unlimited: M;
    abstract skipBy(amount: number): M;
    abstract readonly unskipped: M;
    abstract orderBy(order: Partial<Order<S>>): M;
    abstract reorder(order: Partial<Order<S>>): M;
    abstract readonly unordered: M;
    abstract query(query: Filter<S>): M;
    abstract onlyQuery(query: Filter<S>): M;
    abstract readonly queryBy: QueryByModel<S, M>;
    abstract readonly unfiltered: M;
    abstract readonly all: Promise<I[]>;
    abstract pluck(key: keyof S): Promise<S[keyof S][]>;
    abstract select(...keys: (keyof S)[]): Promise<S[keyof S][][]>;
    abstract updateAll(attrs: Partial<S>): Promise<M>;
    abstract deleteAll(): Promise<I>;
    abstract inBatchesOf(amount: number): Promise<Promise<I[]>[]>;
    abstract readonly first: Promise<I | undefined>;
    abstract find(query: Filter<S>): Promise<I | undefined>;
    abstract readonly findBy: FindByModel<S, I>;
    abstract readonly count: Promise<number>;
    abstract build(attrs: Partial<S> | undefined): I;
    abstract create(attrs: Partial<S> | undefined): Promise<I>;
}
export interface ModelConstructor<S extends Identifiable> {
    id: any;
    readonly attributes: Partial<S>;
    readonly persistentAttributes: Partial<S>;
    readonly isNew: boolean;
    readonly isPersistent: boolean;
    readonly isChanged: boolean;
    readonly isValid: Promise<boolean>;
    readonly changes: Partial<Changes<S>>;
    getTyped<M extends ModelStatic<S>, I extends ModelConstructor<S>>(): ModelConstructorClass<S, M, I>;
    readonly model: ModelStatic<S>;
    belongsTo<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    hasMany<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    hasOne<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    assign(attrs: Partial<S>): ModelConstructor<S>;
    revertChange(key: keyof S): ModelConstructor<S>;
    revertChanges(): ModelConstructor<S>;
    save(): Promise<ModelConstructor<S>>;
    delete(): Promise<ModelConstructor<S>>;
    reload(): Promise<ModelConstructor<S> | undefined>;
}
export declare abstract class ModelConstructorClass<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> {
    readonly model: M;
    abstract belongsTo<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    abstract hasMany<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    abstract hasOne<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    abstract assign(attrs: Partial<S>): I;
    abstract revertChange(key: keyof S): I;
    abstract revertChanges(): I;
    abstract save(): Promise<I>;
    abstract delete(): Promise<I>;
    abstract reload(): Promise<I | undefined>;
}
