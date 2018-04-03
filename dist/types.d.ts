export declare type BaseType = number | string | boolean | null | undefined;
export interface Identifiable {
    id: any;
}
export interface Dict<T> {
    [key: string]: T;
}
export interface Range<T> {
    from: T;
    to: T;
}
export declare type Bindings = BaseType[] | {
    [key: string]: BaseType;
};
export declare type FilterProperty<S extends Identifiable> = Partial<S>;
export declare type FilterIn<S extends Identifiable> = {
    [K in keyof S]: Array<S[K]>;
};
export declare type FilterBetween<S extends Identifiable> = {
    [K in keyof S]: Range<S[K]>;
};
export declare type FilterCompare<S extends Identifiable> = {
    [K in keyof S]: S[K];
};
export interface FilterRaw {
    $bindings: Bindings;
    $query: string;
}
export declare type Filter<S extends Identifiable> = FilterProperty<S> | FilterSpecial<S>;
export declare type FilterSpecial<S extends Identifiable> = {
    $and?: Filter<S>[];
    $not?: Filter<S>;
    $or?: Filter<S>[];
    $in?: FilterIn<S>;
    $notIn?: FilterIn<S>;
    $null?: keyof S;
    $notNull?: keyof S;
    $between?: FilterBetween<S>;
    $notBetween?: FilterBetween<S>;
    $gt?: FilterCompare<S>;
    $gte?: FilterCompare<S>;
    $lt?: FilterCompare<S>;
    $lte?: FilterCompare<S>;
    $raw?: FilterRaw;
};
export declare type Validator<S extends Identifiable> = (instance: ModelConstructor<S>) => Promise<boolean>;
export interface Relation {
    model: ModelStatic<any>;
    foreignKey?: string;
}
export interface StrictRelation {
    model: ModelStatic<any>;
    foreignKey: string;
}
export declare type BelongsTo = Dict<Relation>;
export declare type HasOne = Dict<Relation>;
export declare type HasMany = Dict<Relation>;
export declare type StrictBelongsTo = Dict<StrictRelation>;
export declare type StrictHasOne = Dict<StrictRelation>;
export declare type StrictHasMany = Dict<StrictRelation>;
export interface SchemaProperty<T> {
    type: string;
    defaultValue?: T | ((model: ModelConstructor<any>) => T);
}
export interface StrictSchemaProperty<T> {
    type: string;
    defaultValue: undefined | T | ((model: ModelConstructor<any>) => T);
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
export declare type Query<S extends Identifiable> = (query: Filter<S>) => ModelStatic<S>;
export declare type FindBy<S extends Identifiable> = {
    [P in keyof S]: (value: S[P] | S[P][]) => Promise<undefined | ModelConstructor<S>>;
};
export declare enum OrderDirection {
    'asc' = 1,
    'desc' = -1,
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
    updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<number>;
    deleteAll(model: ModelStatic<S>): Promise<number>;
    create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    update(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    delete(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
    execute(query: string, bindings: Bindings): Promise<any[]>;
}
export interface ModelStatic<S extends Identifiable> {
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
    readonly belongsTo: BelongsTo;
    readonly hasOne: HasOne;
    readonly hasMany: HasMany;
    readonly validators: Validator<S>[];
    readonly strictSchema: StrictSchema<S>;
    readonly strictFilter: Filter<S>;
    readonly strictBelongsTo: StrictBelongsTo;
    readonly strictHasOne: StrictHasOne;
    readonly strictHasMany: StrictHasMany;
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
export interface ModelConstructor<S extends Identifiable> {
    id: any;
    readonly model: ModelStatic<S>;
    readonly attributes: Partial<S>;
    readonly persistentAttributes: Partial<S>;
    readonly isNew: boolean;
    readonly isPersistent: boolean;
    readonly isChanged: boolean;
    readonly isValid: Promise<boolean>;
    readonly changes: Partial<Changes<S>>;
    assign(attrs: Partial<S>): ModelConstructor<S>;
    revertChange(key: keyof S): ModelConstructor<S>;
    revertChanges(): ModelConstructor<S>;
    save(): Promise<ModelConstructor<S>>;
    delete(): Promise<ModelConstructor<S>>;
    reload(): Promise<ModelConstructor<S> | undefined>;
}
