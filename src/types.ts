export function staticImplements<T>() {
  return (_constructor: T) => {
  };
}

export type BaseType = number | string | boolean | null | undefined;

export interface Tuple<T> {
  [key: number]: T;
  length: 2;
};

export interface Dict<T> {
  [key: string]: T;
};

export type FilterProperty<S> = Partial<S>;
export type FilterIn<S> = {
  [K in keyof S]: Array<S[K]>;
};
export type FilterBetween<S> = {
  [K in keyof S]: Tuple<S[K]>;
};
export type FilterGreaterThen<S> = Partial<S>;
export type FilterGreaterThenEquals<S> = Partial<S>;
export type FilterLowerThen<S> = Partial<S>;
export type FilterLowerThenEquals<S> = Partial<S>;

export interface FilterRaw {
  $bindings: BaseType[] | { [key: string]: BaseType };
  $query: string;
};

export type Filter<S> = {
  $and?: (Filter<S> | FilterProperty<S>)[];
  $not?: Filter<S> | FilterProperty<S> | (Filter<S> | FilterProperty<S>)[];
  $or?: (Filter<S> | FilterProperty<S>)[];

  $in?: FilterIn<S>[];
  $notIn?: FilterIn<S>[];

  $null?: keyof S | (keyof S)[];
  $notNull?: keyof S | (keyof S)[];

  $between?: FilterBetween<S> | FilterBetween<S>[];
  $notBetween?: FilterBetween<S> | FilterBetween<S>[];

  $raw?: FilterRaw | FilterRaw[];
};

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

export type Schema<S> = {
  [P in keyof S]: SchemaProperty<S[P]>;
};

export type StrictSchema<S> = {
  [P in keyof S]: StrictSchemaProperty<S[P]>;
};

export type QueryBy<S> = {
  [P in keyof S]: (value: S[P]) => ModelStatic<S>;
};

export type Query<S> = (query: Filter<S>) => ModelStatic<S>;

export type FindBy<S> = {
  [P in keyof S]: (value: S[P]) => Promise<undefined | ModelConstructor<S>>;
};

export type Find<S> = (query: Filter<S>) => Promise<undefined | ModelConstructor<S>>;

export interface ModelStatic<S> {
  readonly modelName: string;
  readonly lowerModelName: string;
  readonly schema: Schema<S>;
  readonly filter: Filter<S>;
  readonly limit: number;
  readonly skip: number;

  readonly belongsTo: BelongsTo;
  readonly hasOne: HasOne;
  readonly hasMany: HasMany;

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

  readonly first: Promise<ModelConstructor<S> | undefined>;
  find(query: Filter<S>): Promise<undefined | ModelConstructor<S>>;
  readonly findBy: FindBy<S>;

  new(params: Partial<S>): ModelConstructor<S>;
  // prototype: S;
}

export interface ModelConstructor<S> {
  readonly model: ModelStatic<S>;
}
