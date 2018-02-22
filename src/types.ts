export type BaseType = number | string | boolean | null | undefined;

export interface Tuple<T> {
  [key: number]: T;
  length: 2;
};

export interface Dict<T> {
  [key: string]: T;
};

export type FilterProperty = Dict<BaseType>;
export type FilterIn = Dict<Array<string> | Array<number>>;
export type FilterBetween = Dict<Tuple<string> | Tuple<number>>;

export interface FilterRaw {
  $bindings: BaseType[] | { [key: string]: BaseType };
  $query: string;
};

export interface Filter {
  $and?: Filter | Filter[];
  $not?: Filter | Filter[];
  $or?: Filter | Filter[];

  $in?: Filter | FilterIn[];
  $notIn?: Filter | FilterIn[];

  $null?: string | string[];
  $notNull?: string | string[];

  $between?: FilterBetween | FilterBetween[];
  $notBetween?: FilterBetween | FilterBetween[];

  $raw?: FilterRaw | FilterRaw[];
};

export interface StrictFilter {
  $and?: Filter[];
  $not?: Filter[];
  $or?: Filter[];

  $in?: FilterIn[];
  $notIn?: FilterIn[];

  $null?: string[];
  $notNull?: string[];

  $between?: FilterBetween[];
  $notBetween?: FilterBetween[];

  $raw?: FilterRaw[];
};

export interface Relation {
  model: NextModelConstructor;
  foreignKey?: string;
};

export interface StrictRelation {
  model: NextModelConstructor;
  foreignKey: string;
};

export type BelongsTo = Dict<Relation>;
export type HasOne = Dict<Relation>;
export type HasMany = Dict<Relation>;

export type StrictBelongsTo = Dict<StrictRelation>;
export type StrictHasOne = Dict<StrictRelation>;
export type StrictHasMany = Dict<StrictRelation>;


export interface Schema {
  [key: string]: SchemaAttribute<any>;
};

export interface SchemaAttribute<Type> {
  type?: string; // Only needed for js usage
  defaultValue?: Type;
  defaultGenerator?: (klass: NextModelInstance) => Type;
};


export interface NextModelConstructor {
  readonly defaultFilter?: Filter;
  readonly strictDefaultFilter: StrictFilter;

  readonly belongsTo?: BelongsTo;
  readonly strictBelongsTo: StrictBelongsTo;

  readonly hasOne?: HasOne;
  readonly strictHasOne: StrictHasOne;

  readonly hasMany?: HasMany;
  readonly strictHasMany: StrictHasMany;

  constructor: NextModelInstance;
};

export interface NextModelInstance {
  readonly model: NextModelConstructor;
};

