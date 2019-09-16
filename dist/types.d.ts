export interface Dict<T> {
    [key: string]: T;
}
export interface NestedDict<T> extends Dict<T | NestedDict<T>> {
}
export declare type Tuple<T, U = T> = [T, U];
export interface Range<T> {
    from: T;
    to: T;
}
export declare enum KeyType {
    uuid = 0,
    number = 1
}
export declare type Schema = Dict<any>;
export declare type BaseType = number | string | boolean | Date | number[] | string[] | boolean[] | Date[];
export declare type FilterIn<S extends Schema> = {
    [K in keyof S]: S[K][];
};
export declare type FilterBetween<S extends Schema> = {
    [K in keyof S]: Range<S[K]>;
};
export interface FilterRaw {
    $bindings: BaseType[] | Dict<BaseType>;
    $query: string;
}
export declare type Filter<S extends Schema> = Partial<S> | Partial<FilterSpecial<S>>;
export interface FilterSpecial<S extends Schema> {
    $and: Filter<S>[];
    $not: Filter<S>;
    $or: Filter<S>[];
    $in: Partial<FilterIn<S>>;
    $notIn: Partial<FilterIn<S>>;
    $null: keyof S;
    $notNull: keyof S;
    $between: Partial<FilterBetween<S>>;
    $notBetween: Partial<FilterBetween<S>>;
    $gt: Partial<S>;
    $gte: Partial<S>;
    $lt: Partial<S>;
    $lte: Partial<S>;
    $like: Partial<S>;
    $raw: FilterRaw;
    $async: Promise<Filter<S>>;
}
export declare enum SortDirection {
    Asc = 1,
    Desc = -1
}
export declare type OrderColumn<PersistentProps extends Schema> = {
    key: keyof PersistentProps;
    dir?: SortDirection;
};
export declare type Order<PersistentProps extends Schema> = OrderColumn<PersistentProps> | OrderColumn<PersistentProps>[];
export interface Connector {
    query(scope: Scope): Promise<Dict<any>[]>;
    count(scope: Scope): Promise<number>;
    select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]>;
    updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]>;
    deleteAll(scope: Scope): Promise<Dict<any>[]>;
    batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]>;
    execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]>;
}
export interface Scope {
    tableName: string;
    filter?: Filter<any>;
    limit?: number;
    skip?: number;
    order?: OrderColumn<any>[];
}
