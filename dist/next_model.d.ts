import { ModelConstructor, ModelStatic, ModelConstructorClass, ModelStaticClass, Filter, Identifiable, Order, RelationOptions, QueryByModel, FindByModel } from './types';
export declare class PropertyNotDefinedError extends Error {
    name: string;
    constructor(name: string, isStatic?: boolean, isReadonly?: boolean);
}
export declare class LowerBoundsError extends Error {
    name: string;
    constructor(name: string, lowerBound: number);
}
export declare class MinLengthError extends Error {
    name: string;
    constructor(name: string, minLength: number);
}
export declare class TypeError extends Error {
    name: string;
    constructor(name: string, type: string);
}
export declare function NextModel<S extends Identifiable>(): ModelStatic<S>;
export declare class NextModelStatic<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> extends ModelStaticClass<S, M, I> {
    model: M;
    constructor(model: M);
    limitBy(amount: number): M;
    readonly unlimited: M;
    skipBy(amount: number): M;
    readonly unskipped: M;
    orderBy(order: Partial<Order<S>>): M;
    reorder(order: Partial<Order<S>>): M;
    readonly unordered: M;
    query(query: Filter<S>): M;
    onlyQuery(query: Filter<S>): M;
    readonly queryBy: QueryByModel<S, M>;
    readonly unfiltered: M;
    readonly all: Promise<I[]>;
    pluck(key: keyof S): Promise<S[keyof S][]>;
    select(...keys: (keyof S)[]): Promise<S[keyof S][][]>;
    updateAll(attrs: Partial<S>): Promise<M>;
    deleteAll(): Promise<I>;
    inBatchesOf(amount: number): Promise<Promise<I[]>[]>;
    readonly first: Promise<I | undefined>;
    find(query: Filter<S>): Promise<I | undefined>;
    readonly findBy: FindByModel<S, I>;
    readonly count: Promise<number>;
    build(attrs: Partial<S> | undefined): I;
    create(attrs: Partial<S> | undefined): Promise<I>;
}
export declare class NextModelConstructor<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> extends ModelConstructorClass<S, M, I> {
    instance: I;
    constructor(instance: I);
    readonly model: M;
    belongsTo<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    hasMany<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    hasOne<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
    assign(attrs: Partial<S>): I;
    revertChange(key: keyof S): I;
    revertChanges(): I;
    save(): Promise<I>;
    delete(): Promise<I>;
    reload(): Promise<I | undefined>;
}
export default NextModel;
