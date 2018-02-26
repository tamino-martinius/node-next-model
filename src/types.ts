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
  $and?: Filter<S> | FilterProperty<S> | (Filter<S> | FilterProperty<S>)[];
  $not?: Filter<S> | FilterProperty<S> | (Filter<S> | FilterProperty<S>)[];
  $or?: Filter<S> | FilterProperty<S> | (Filter<S> | FilterProperty<S>)[];

  $in?: FilterIn<S> | FilterIn<S>[];
  $notIn?: FilterIn<S> | FilterIn<S>[];

  $null?: string | string[];
  $notNull?: string | string[];

  $between?: FilterBetween<S> | FilterBetween<S>[];
  $notBetween?: FilterBetween<S> | FilterBetween<S>[];

  $raw?: FilterRaw | FilterRaw[];
};

export interface StrictFilter<S> {
  $and?: (Filter<S> | FilterProperty<S>)[];
  $not?: (Filter<S> | FilterProperty<S>)[];
  $or?: (Filter<S> | FilterProperty<S>)[];

  $in?: FilterIn<S>[];
  $notIn?: FilterIn<S>[];

  $null?: string[];
  $notNull?: string[];

  $between?: FilterBetween<S>[];
  $notBetween?: FilterBetween<S>[];

  $raw?: FilterRaw[];
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

  // new(...args: any[]): ModelConstructor<T>;
  // prototype: S;
  new(params: Partial<S>): ModelConstructor<S>;
  // protptype: ModelConstructor<S>;

  readonly filter?: Filter<S>;
  readonly defaultFilter?: Filter<S>;

  readonly belongsTo?: BelongsTo;
  readonly hasOne?: HasOne;
  readonly hasMany?: HasMany;

  readonly strictSchema: StrictSchema<S>;
  readonly strictFilter: StrictFilter<S>;
  readonly strictBelongsTo: StrictBelongsTo;
  readonly strictHasOne: StrictHasOne;
  readonly strictHasMany: StrictHasMany;

  query(query: Filter<S>): ModelStatic<S>;
  readonly queryBy: QueryBy<S>;
  readonly first: Promise<ModelConstructor<S> | undefined>;
  find(query: Filter<S>): Promise<undefined | ModelConstructor<S>>;
  readonly findBy: FindBy<S>;
}

export interface ModelConstructor<S> {
  readonly model: ModelStatic<S>;
}
