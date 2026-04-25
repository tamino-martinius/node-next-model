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
   * Capability bit. Connectors that can execute a parent scope JOINed against
   * one or more child tables in a single statement set this and implement
   * `queryWithJoins`. The Model layer routes `whereMissing` / `joins(...)` /
   * `includes({...}, { strategy: 'join' })` through the JOIN path when this is
   * present, and falls back to subquery + filter for connectors without it.
   */
  supportsJoins?: true;

  /**
   * Run `spec.parent`'s base query JOINed against one or more child tables.
   * Returns parent rows only; rows whose `joins[i].mode === 'includes'` carry
   * the matched children inside a `__includes` dict keyed by `attachAs`.
   */
  queryWithJoins?(spec: JoinQuerySpec): Promise<Dict<any>[]>;
}

export interface Scope {
  tableName: string;
  filter?: Filter<any>;
  limit?: number;
  skip?: number;
  order?: OrderColumn<any>[];
}

/**
 * Join behaviour:
 *  - `'select'`: keep parents that have at least one matching child row
 *    (INNER JOIN, distinct parents).
 *  - `'antiJoin'`: keep parents that have NO matching child row
 *    (LEFT JOIN with `child IS NULL`). Powers `Model.whereMissing(...)`.
 *  - `'includes'`: keep all parents and attach the matched children under
 *    `__includes[attachAs]`. Powers `Model.includes({...}, { strategy: 'join' })`.
 */
export type JoinMode = 'select' | 'antiJoin' | 'includes';

export interface JoinClause {
  /** SQL JOIN kind. `mode: 'antiJoin'` and `mode: 'includes'` always run as `'left'`. */
  kind: 'inner' | 'left';
  childTableName: string;
  on: { parentColumn: string; childColumn: string };
  /** Optional filter applied to the child rows. Bare-column form keys resolve against the child table. */
  filter?: Filter<any>;
  mode?: JoinMode;
  /**
   * Required when `mode === 'includes'` — the property name on each returned
   * parent row's `__includes` dict that the matched children attach under.
   */
  attachAs?: string;
  /**
   * Required when `mode === 'antiJoin'` — column on the child table that the
   * `IS NULL` check targets. Defaults to the child's primary key.
   */
  childPrimaryKey?: string;
  /**
   * When `mode === 'includes'`, controls whether a single matching child is
   * expected (`belongsTo` / `hasOne`) — the connector still returns an array,
   * but the Model layer flattens to the first element.
   */
  includesCardinality?: 'many' | 'one';
  /**
   * Connector-opaque hook for the Model layer's fallback path: when set, the
   * Model resolves the child rows through this object's `connector` instead
   * of the parent's. Typed as `unknown` here so `types.ts` stays free of the
   * circular `Model` import; the Model layer casts to `typeof ModelClass`.
   * Connectors must ignore this field.
   */
  target?: unknown;
}

export interface JoinQuerySpec {
  parent: Scope;
  joins: JoinClause[];
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
