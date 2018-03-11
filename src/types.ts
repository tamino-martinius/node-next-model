export function staticImplements<T>() {
  return (_constructor: T) => {
  };
}

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

export type Filter<S extends Identifiable> = FilterProperty<S> | FilterSpecial<S>;

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

export type Validator<S extends Identifiable> = (instance: ModelConstructor<S>) => Promise<boolean>;

export interface Relation {
  model: ModelStatic<any>;
  foreignKey?: string;
};

export interface StrictRelation {
  model: ModelStatic<any>;
  foreignKey: string;
};

export type BelongsTo = Dict<Relation>;
export type HasOne = Dict<Relation>;
export type HasMany = Dict<Relation>;

export type StrictBelongsTo = Dict<StrictRelation>;
export type StrictHasOne = Dict<StrictRelation>;
export type StrictHasMany = Dict<StrictRelation>;

export interface SchemaProperty<T> {
  type: string;
  defaultValue?: T | ((model: ModelConstructor<any>) => T);
};

export interface StrictSchemaProperty<T> {
  type: string;
  defaultValue: undefined | T | ((model: ModelConstructor<any>) => T);
};

export type Schema<S extends Identifiable> = {
  [P in keyof S]: SchemaProperty<S[P]>;
};

export type StrictSchema<S extends Identifiable> = {
  [P in keyof S]: StrictSchemaProperty<S[P]>;
};

export type QueryBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => ModelStatic<S>;
};

export type Query<S extends Identifiable> = (query: Filter<S>) => ModelStatic<S>;

export type FindBy<S extends Identifiable> = {
  [P in keyof S]: (value: S[P] | S[P][]) => Promise<undefined | ModelConstructor<S>>;
};

export type Find<S extends Identifiable> = (query: Filter<S>) => Promise<undefined | ModelConstructor<S>>;

export type Changes<S extends Identifiable> = {
  [P in keyof S]: { from: S[P], to: S[P] };
};

export interface Storage {
  [key: string]: any[],
};

export interface ConnectorConstructor<S extends Identifiable> {
  query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  count(model: ModelStatic<S>): Promise<number>;
  updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<ModelConstructor<S>[]>;
  deleteAll(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  reload(instance: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined>;
  create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  update(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  delete(instance: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  execute(query: string, bindings: Bindings): Promise<any[]>;
};

export interface ModelStatic<S extends Identifiable> {
  readonly modelName: string;
  readonly lowerModelName: string;
  readonly identifier: string;
  readonly collectionName: string | undefined;
  readonly connector: ConnectorConstructor<S>;
  readonly schema: Schema<S>;
  readonly filter: Filter<S>;
  readonly limit: number;
  readonly skip: number;
  readonly keys: (keyof S)[]
  // order

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
  query(query: Filter<S>): ModelStatic<S>;
  readonly queryBy: QueryBy<S>;

  readonly all: Promise<ModelConstructor<S>[]>;
  updateAll(attrs: Partial<S>): Promise<ModelConstructor<S>[]>;
  deleteAll(): Promise<ModelConstructor<S>[]>;
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

export interface ModelConstructor<S extends Identifiable> {
  id: any;
  readonly model: ModelStatic<S>;
  readonly attributes: S;
  readonly isNew: boolean;
};
