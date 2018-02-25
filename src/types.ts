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
  [P in keyof S]: Array<S[P]>;
};
export type FilterBetween<S> = {
  [P in keyof S]: Tuple<S[P]>;
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

export type FindBy<S> = {
  [P in keyof S]: (value: S[P]) => Promise<ModelConstructor<S>>;
};

export type QueryBy<S> = {
  [P in keyof S]: (value: S[P]) => ModelStatic<S>;
};

export interface SchemaProperty<T> {
  type: string;
  defaultValue?: T | ((model: ModelConstructor<any>) => T);
};

export type Schema<S> = {
  [P in keyof S]: SchemaProperty<S[P]>;
};

export interface ModelStatic<S> {
  readonly modelName: string;
  readonly schema: Schema<S>;

  new(): ModelConstructor<S>;
  // new(...args: any[]): ModelConstructor<S>;
  prototype: S;
  new(params: Partial<S>): ModelConstructor<S>;
  // protptype: ModelConstructor<S>;

  readonly defaultFilter?: Filter<S>;
  readonly belongsTo?: BelongsTo;
  readonly hasOne?: HasOne;
  readonly hasMany?: HasMany;

  readonly strictDefaultFilter: StrictFilter<S>;
  readonly strictBelongsTo: StrictBelongsTo;
  readonly strictHasOne: StrictHasOne;
  readonly strictHasMany: StrictHasMany;

  // readonly findBy: FindBy<S>;
}

export interface ModelConstructor<S> {
  readonly model: ModelStatic<S>;
}
