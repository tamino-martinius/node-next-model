import type { TableBuilder } from './schema.js';

export interface Dict<T> {
  [key: string]: T;
}

export interface NestedDict<T> extends Dict<T | NestedDict<T>> {}

export type Tuple<T, U = T> = [T, U];

export interface Range<T> {
  from: T;
  to: T;
}

export enum KeyType {
  uuid = 0,
  number = 1,
  /** Caller supplies the primary key value; the connector does not generate one. */
  manual = 2,
}

export type Schema = Dict<any>;

export type BaseType = number | string | boolean | Date | number[] | string[] | boolean[] | Date[];

export type FilterIn<S extends Schema> = {
  [K in keyof S]: S[K][];
};

export type FilterBetween<S extends Schema> = {
  [K in keyof S]: Range<S[K]>;
};

export interface FilterRaw {
  $bindings?: BaseType[] | Dict<BaseType>;
  $query: string;
}

export type Filter<S extends Schema> = Partial<S> | Partial<FilterSpecial<S>>;

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

export enum SortDirection {
  Asc = 1,
  Desc = -1,
}

export type OrderColumn<PersistentProps extends Schema> = {
  key: keyof PersistentProps;
  dir?: SortDirection;
};

export type Order<PersistentProps extends Schema> =
  | OrderColumn<PersistentProps>
  | OrderColumn<PersistentProps>[];

export type AggregateKind = 'sum' | 'min' | 'max' | 'avg';

export interface Connector {
  query(scope: Scope): Promise<Dict<any>[]>;
  count(scope: Scope): Promise<number>;
  select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]>;
  updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]>;
  deleteAll(scope: Scope): Promise<Dict<any>[]>;
  batchInsert(tableName: string, keys: Dict<KeyType>, items: Dict<any>[]): Promise<Dict<any>[]>;
  execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined>;
  hasTable(tableName: string): Promise<boolean>;
  createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void>;
  dropTable(tableName: string): Promise<void>;

  /**
   * Capability flag — connectors that perform native single-statement
   * INSERT-or-UPDATE set this to `true`. Model-layer call sites use it to
   * pick the atomic native path over the SELECT-then-INSERT-or-UPDATE
   * fallback.
   */
  supportsUpsert?: true;

  /**
   * Insert `rows`; on conflict against `conflictTarget` (column names that
   * match a unique constraint or PRIMARY KEY) update `updateColumns` (or all
   * non-conflict columns when omitted). Returns the resulting rows in the
   * same order as `rows`. When `ignoreOnly` is set the conflict path is
   * `DO NOTHING` and the existing row is returned for skipped inputs.
   */
  upsert?(spec: UpsertSpec): Promise<Dict<any>[]>;
}

export interface UpsertSpec {
  tableName: string;
  keys: Dict<KeyType>;
  rows: Dict<any>[];
  conflictTarget: string[];
  /** Columns to update on conflict. Omit to update all non-conflict columns. */
  updateColumns?: string[];
  /** When true, emits ON CONFLICT DO NOTHING (skip rather than update). */
  ignoreOnly?: boolean;
}

export interface Scope {
  tableName: string;
  filter?: Filter<any>;
  limit?: number;
  skip?: number;
  order?: OrderColumn<any>[];
}

export type Validator<T> = (instance: T) => boolean | Promise<boolean>;

export type Callback<T> = (instance: T) => void | Promise<void>;

export type AroundCallback<T> = (instance: T, next: () => Promise<void>) => Promise<void>;

export interface Callbacks<T> {
  beforeSave?: Callback<T>[];
  afterSave?: Callback<T>[];
  beforeCreate?: Callback<T>[];
  afterCreate?: Callback<T>[];
  beforeUpdate?: Callback<T>[];
  afterUpdate?: Callback<T>[];
  beforeDelete?: Callback<T>[];
  afterDelete?: Callback<T>[];
  afterInitialize?: Callback<T>[];
  afterFind?: Callback<T>[];
  beforeValidation?: Callback<T>[];
  afterValidation?: Callback<T>[];
  aroundSave?: AroundCallback<T>[];
  aroundCreate?: AroundCallback<T>[];
  aroundUpdate?: AroundCallback<T>[];
  aroundDelete?: AroundCallback<T>[];
  /**
   * Fires after the surrounding `Model.transaction(...)` commits successfully.
   * Outside a transaction these fire immediately after the operation lands.
   */
  afterCommit?: Callback<T>[];
  afterCreateCommit?: Callback<T>[];
  afterUpdateCommit?: Callback<T>[];
  afterDeleteCommit?: Callback<T>[];
  /** Fires after `Model.transaction(...)` rolls back. */
  afterRollback?: Callback<T>[];
  afterCreateRollback?: Callback<T>[];
  afterUpdateRollback?: Callback<T>[];
  afterDeleteRollback?: Callback<T>[];
}
