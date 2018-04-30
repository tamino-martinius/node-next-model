export type BaseType = number | string | boolean | null | undefined;

export interface Identifiable {
  id: any;
}

export interface Dict<T> {
  [key: string]: T;
}

export type Tuple<T, U> = [T, U];

export interface Range<T> {
  from: T;
  to: T;
}

// "{ new(): T }"
// is from https://www.typescriptlang.org/docs/handbook/generics.html#using-class-types-in-generics
export interface Constructor<M> {
  new(...args: any[]): M;
}

export type Bindings = BaseType[] | { [key: string]: BaseType }

export type FilterProperty<S extends Identifiable> = Partial<S>;

export type FilterIn<S extends Identifiable> = {
  [K in keyof S]: Array<S[K]>;
}

export type FilterBetween<S extends Identifiable> = {
  [K in keyof S]: Range<S[K]>;
}

export type FilterCompare<S extends Identifiable> = {
  [K in keyof S]: S[K];
}

export interface FilterRaw {
  $bindings: Bindings;
  $query: string;
}

export type Filter<S extends Identifiable> =
  FilterProperty<S> |
  FilterSpecial<S> |
  Promise<FilterProperty<S>> |
  Promise<FilterSpecial<S>>

export type FilterSpecial<S extends Identifiable> = {
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
}

export type Validator<S extends Identifiable> =
  (instance: ModelConstructor<S>) => Promise<boolean>

export enum DataType {
  bigInteger,
  binary,
  boolean,
  date,
  dateTime,
  decimal,
  enum,
  float,
  integer,
  json,
  jsonb,
  string,
  text,
  time,
  uuid,
}

export interface SchemaProperty<T> {
  type: DataType;
  defaultValue?: T | ((model: ModelConstructor<Identifiable>) => T);
}

export interface StrictSchemaProperty<T> {
  type: DataType;
  defaultValue: undefined | T | ((model: ModelConstructor<Identifiable>) => T);
}

export type Schema<S extends Identifiable> = {
  [P in keyof S]: SchemaProperty<S[P]>;
}

export type StrictSchema<S extends Identifiable> = {
  [P in keyof S]: StrictSchemaProperty<S[P]>;
}

export type QueryBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => ModelStatic<S>;
}

export type Query<S extends Identifiable> = (query: Filter<S>) => ModelStatic<S>;

export type FindBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => Promise<undefined | ModelConstructor<S>>;
}

export enum OrderDirection {
  'asc' = 1,
  'desc' = -1,
}

export type Order<S extends Identifiable> = {
  [P in keyof S]: OrderDirection;
}

export type Find<S extends Identifiable> = (query: Filter<S>) => Promise<undefined | ModelConstructor<S>>;

export type Changes<S extends Identifiable> = {
  [P in keyof S]: { from: S[P] | undefined, to: S[P] | undefined }
}

export interface Storage {
  [key: string]: any[],
}

export interface ConnectorConstructor<S extends Identifiable> {
  query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  count(model: ModelStatic<S>): Promise<number>;
  select(model: ModelStatic<S>, ...keys: (keyof S)[]): Promise<S[keyof S][][]>
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
  readonly order: Partial<Order<S>>[]
  readonly keys: (keyof S)[]
  
  readonly validators: Validator<S>[];
  
  readonly strictSchema: StrictSchema<S>;
  readonly strictFilter: Filter<S>;

  getTyped<M extends ModelStatic<S>, I extends ModelConstructor<S>>(): ModelConstructorClass<S, M, I>;

  belongsTo<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
  hasMany<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
  hasOne<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R;
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
  pluck(key: keyof S): Promise<S[keyof S][]>
  select(...keys: (keyof S)[]): Promise<S[keyof S][][]>
  updateAll(attrs: Partial<S>): Promise<ModelStatic<S>>;
  deleteAll(): Promise<ModelStatic<S>>;
  inBatchesOf(amount: number): Promise<Promise<ModelConstructor<S>[]>[]>;
  readonly first: Promise<ModelConstructor<S> | undefined>;
  find(query: Filter<S>): Promise<undefined | ModelConstructor<S>>;
  readonly findBy: FindBy<S>;
  readonly count: Promise<number>;

  new(attrs: Partial<S> | undefined): ModelConstructor<S>;
  build(attrs: Partial<S> | undefined): ModelConstructor<S>;
  create(attrs: Partial<S> | undefined): Promise<ModelConstructor<S>>;
  // prototype: S;
}

export class ModelStaticClass<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> {

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

  getTyped<M extends ModelConstructor<S>, I extends ModelConstructor<S>>(): ModelConstructorClass<S, M, I>;

  assign(attrs: Partial<S>): ModelConstructor<S>;
  revertChange(key: keyof S): ModelConstructor<S>;
  revertChanges(): ModelConstructor<S>;

  save(): Promise<ModelConstructor<S>>;
  delete(): Promise<ModelConstructor<S>>;
  reload(): Promise<ModelConstructor<S> | undefined>;
}

export class ModelConstructorClass<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> {

}
