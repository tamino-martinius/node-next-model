export type BaseType = number | string | boolean | null | undefined;

export interface Identifiable {
  id: any;
}

export interface Dict<T> {
  [key: string]: T;
};

export interface Range<T> {
  from: T;
  to: T;
};

export type Bindings = BaseType[] | { [key: string]: BaseType }

export type FilterProperty<S extends Identifiable> = Partial<S>;

export type FilterIn<S extends Identifiable> = {
  [K in keyof S]: Array<S[K]>;
};

export type FilterBetween<S extends Identifiable> = {
  [K in keyof S]: Range<S[K]>;
};

export type FilterCompare<S extends Identifiable> = {
  [K in keyof S]: S[K];
};

export interface FilterRaw {
  $bindings: Bindings;
  $query: string;
};

export type Filter<S extends Identifiable> =
  FilterProperty<S> |
  FilterSpecial<S> |
  Promise<FilterProperty<S>> |
  Promise<FilterSpecial<S>>
;

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
};

export type Validator<S extends Identifiable, R extends Dict<Identifiable>> =
  (instance: ModelConstructor<S, R>) => Promise<boolean>
;

export enum RelationType {
  BelongsTo,
  HasOne,
  HasMany,
};

export interface Relation<S extends Identifiable> {
  type: RelationType;
  model: ModelStatic<S, Dict<Identifiable>>;
  through?: string;
  filter?: Filter<S>;
  foreignKey?: string;
};

export interface StrictRelation<S extends Identifiable> {
  type: RelationType;
  model: ModelStatic<S, Dict<Identifiable>>;
  through?: string;
  filter: Filter<S>;
  foreignKey: string;
};

export type Relations<D extends Dict<Identifiable>> = {
  [K in keyof D]: Relation<D[K]>;
};
export type StrictRelations<D extends Dict<Identifiable>> = {
  [K in keyof D]: StrictRelation<D[K]>;
};
export type Related<D extends Dict<Identifiable>> = {
  [K in keyof D]: ModelStatic<D[K], {}>;
};

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
};

export interface SchemaProperty<T> {
  type: DataType;
  defaultValue?: T | ((model: ModelConstructor<Identifiable, Dict<Identifiable>>) => T);
};

export interface StrictSchemaProperty<T> {
  type: DataType;
  defaultValue: undefined | T | ((model: ModelConstructor<Identifiable, Dict<Identifiable>>) => T);
};

export type Schema<S extends Identifiable> = {
  [P in keyof S]: SchemaProperty<S[P]>;
};

export type StrictSchema<S extends Identifiable> = {
  [P in keyof S]: StrictSchemaProperty<S[P]>;
};

export type QueryBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => ModelStatic<S, Dict<Identifiable>>;
};

export type Query<S extends Identifiable> = (query: Filter<S>) => ModelStatic<S, Dict<Identifiable>>;

export type FindBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => Promise<undefined | ModelConstructor<S, Dict<Identifiable>>>;
};

export enum OrderDirection {
  'asc' = 1,
  'desc' = -1,
};

export type Order<S extends Identifiable> = {
  [P in keyof S]: OrderDirection;
};

export type Find<S extends Identifiable> = (query: Filter<S>) => Promise<undefined | ModelConstructor<S, Dict<Identifiable>>>;

export type Changes<S extends Identifiable> = {
  [P in keyof S]: { from: S[P] | undefined, to: S[P] | undefined };
};

export interface Storage {
  [key: string]: any[],
};

export interface ConnectorConstructor<S extends Identifiable, R extends Dict<Identifiable>> {
  query(model: ModelStatic<S, R>): Promise<ModelConstructor<S, R>[]>;
  count(model: ModelStatic<S, R>): Promise<number>;
  select(model: ModelStatic<S, R>, ...keys: (keyof S)[]): Promise<S[keyof S][][]>
  updateAll(model: ModelStatic<S, R>, attrs: Partial<S>): Promise<number>;
  deleteAll(model: ModelStatic<S, R>): Promise<number>;
  create(instance: ModelConstructor<S, R>): Promise<ModelConstructor<S, R>>;
  update(instance: ModelConstructor<S, R>): Promise<ModelConstructor<S, R>>;
  delete(instance: ModelConstructor<S, R>): Promise<ModelConstructor<S, R>>;
  execute(query: string, bindings: Bindings): Promise<any[]>;
};

export interface ModelStatic<S extends Identifiable, R extends Dict<Identifiable>> {
  readonly modelName: string;
  readonly lowerModelName: string;
  readonly underscoreModelName: string;
  readonly pluralModelName: string;
  readonly identifier: string;
  readonly collectionName: string | undefined;
  readonly connector: ConnectorConstructor<S, R>;
  readonly schema: Schema<S>;
  readonly filter: Filter<S>;
  readonly limit: number;
  readonly skip: number;
  readonly order: Partial<Order<S>>[]
  readonly keys: (keyof S)[]

  readonly relations: Relations<R>;
  readonly validators: Validator<S, R>[];

  readonly strictSchema: StrictSchema<S>;
  readonly strictRelations: StrictRelations<R>;
  readonly strictFilter: Filter<S>;

  limitBy(amount: number): ModelStatic<S, R>;
  readonly unlimited: ModelStatic<S, R>;
  skipBy(amount: number): ModelStatic<S, R>;
  readonly unskipped: ModelStatic<S, R>;
  orderBy(order: Partial<Order<S>>): ModelStatic<S, R>;
  reorder(order: Partial<Order<S>>): ModelStatic<S, R>;
  readonly unordered: ModelStatic<S, R>;
  query(query: Filter<S>): ModelStatic<S, R>;
  onlyQuery(query: Filter<S>): ModelStatic<S, R>;
  readonly queryBy: QueryBy<S>;
  readonly unfiltered: ModelStatic<S, R>;
  readonly all: Promise<ModelConstructor<S, R>[]>;
  pluck(key: keyof S): Promise<S[keyof S][]>
  select(...keys: (keyof S)[]): Promise<S[keyof S][][]>
  updateAll(attrs: Partial<S>): Promise<ModelStatic<S, R>>;
  deleteAll(): Promise<ModelStatic<S, R>>;
  inBatchesOf(amount: number): Promise<Promise<ModelConstructor<S, R>[]>[]>;
  readonly first: Promise<ModelConstructor<S, R> | undefined>;
  find(query: Filter<S>): Promise<undefined | ModelConstructor<S, R>>;
  readonly findBy: FindBy<S>;
  readonly count: Promise<number>;

  new(attrs: Partial<S> | undefined): ModelConstructor<S, R>;
  build(attrs: Partial<S> | undefined): ModelConstructor<S, R>;
  create(attrs: Partial<S> | undefined): Promise<ModelConstructor<S, R>>;
  // prototype: S;
}

export interface ModelConstructor<S extends Identifiable, R extends Dict<Identifiable>> {
  id: any;
  readonly model: ModelStatic<S, R>;
  readonly attributes: Partial<S>;
  readonly persistentAttributes: Partial<S>;
  readonly isNew: boolean;
  readonly isPersistent: boolean;
  readonly isChanged: boolean;
  readonly isValid: Promise<boolean>;
  readonly changes: Partial<Changes<S>>;
  readonly related: Related<R>;

  assign(attrs: Partial<S>): ModelConstructor<S, R>;
  revertChange(key: keyof S): ModelConstructor<S, R>;
  revertChanges(): ModelConstructor<S, R>;

  save(): Promise<ModelConstructor<S, R>>;
  delete(): Promise<ModelConstructor<S, R>>;
  reload(): Promise<ModelConstructor<S, R> | undefined>;
};
