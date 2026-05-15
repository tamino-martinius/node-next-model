import { NotFoundError, PersistenceError, StaleObjectError, ValidationError } from './errors.js';
import { MemoryConnector } from './MemoryConnector.js';
import { createAssociationQuery } from './query/associationQuery.js';
import { CollectionQuery } from './query/CollectionQuery.js';
import type { ColumnQuery } from './query/ColumnQuery.js';
import { InstanceQuery } from './query/InstanceQuery.js';
import type { QueryState } from './query/QueryState.js';
import type { ScalarQuery } from './query/ScalarQuery.js';
import type { TableDefinition } from './schema.js';
import {
  type DatabaseSchema,
  deriveKeysFromTableDefinition,
  type SchemaAssociations,
  type SchemaCreateProps,
  type SchemaKeys,
  type SchemaProps,
  type TypedAssociation,
} from './typedSchema.js';
import {
  type AggregateKind,
  type AroundCallback,
  type Callback,
  type Callbacks,
  type Connector,
  type Dict,
  type Filter,
  type JoinClause,
  KeyType,
  type Order,
  type OrderColumn,
  type Schema,
  type Scope,
  type Validator,
} from './types.js';
import { camelize, pascalize, singularize } from './util.js';
import { Errors } from './validators.js';

/**
 * Generate a URL-safe random token. `length` is the byte count fed into the
 * platform RNG; the returned base64url string is `Math.ceil(length * 4 / 3)`
 * characters long (no padding). Default 24 bytes → 32-character token.
 *
 * Uses the Web Crypto API (`globalThis.crypto.getRandomValues`), which is
 * available in browsers and in Node 19+ as a global, so this stays
 * browser-bundle-safe (no `node:crypto` import).
 */
export function generateSecureToken(length = 24): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface TransactionContext {
  afterCommit: Array<() => Promise<void>>;
  afterRollback: Array<() => Promise<void>>;
}

/**
 * Module-level "current transaction" pointer. JavaScript is single-threaded
 * so a plain variable suffices for sequential transactions:
 * `Model.transaction` writes its context here, every save/delete inside reads
 * it, and the wrapper restores the previous value in a `finally`.
 *
 * Limitation: parallel transactions on overlapping async timelines
 * (`Promise.all([Model.transaction(...), Model.transaction(...)])`) can mix
 * contexts. Wrap one in `await` before the next when correctness matters.
 * Browser bundles can't use `node:async_hooks`, so the stack-style approach
 * works in every runtime we ship to.
 */
let activeContext: TransactionContext | undefined;

async function withTransactionContext<T>(
  ctx: TransactionContext,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = activeContext;
  activeContext = ctx;
  try {
    return await fn();
  } finally {
    activeContext = prev;
  }
}

/** Returns the active transaction context if any code path above is inside `Model.transaction(...)`. */
function activeTransaction(): TransactionContext | undefined {
  return activeContext;
}

export type AssociationOptions = {
  foreignKey?: string;
  primaryKey?: string;
  polymorphic?: string;
  typeKey?: string;
  typeValue?: string;
};

export type IncludeStrategy = 'preload' | 'join' | 'auto';

export type IncludeOptions = {
  /**
   * `'preload'` (default) — issues one batched query per association after the
   * main fetch (`preloadBelongsTo` / `preloadHasMany`); works on every connector.
   *
   * `'join'` — folds each association into a `LEFT JOIN` on the main fetch via
   * `Connector.queryWithJoins`. Requires the connector to implement
   * `queryWithJoins`; throws if it doesn't.
   *
   * `'auto'` — uses `'join'` when the connector implements `queryWithJoins`
   * and falls back to `'preload'` otherwise.
   */
  strategy?: IncludeStrategy;
};

type AssocNames<Assoc> = keyof Assoc & string;

/**
 * The class returned from `Model({ connector, tableName })`. Identical static
 * API to `modelFactoryImpl`'s class except:
 *
 *  - The instance type intersects with the typed association accessors
 *    derived from `S['tables'][K].associations`.
 *  - `includes` / `joins` / `whereMissing` are constrained to declared
 *    association names so unknown strings fail at compile time.
 */
type SchemaModelClass<
  CreateProps,
  PersistentProps extends Schema,
  Keys extends Dict<KeyType>,
  Scopes extends ScopeMap,
  Assoc,
> =
  ReturnType<typeof modelFactoryImpl<CreateProps, PersistentProps, Keys, Scopes>> extends infer R
    ? R extends new (
        ...args: infer A
      ) => infer Inst
      ? Omit<R, 'prototype' | 'includes' | 'joins' | 'whereMissing'> & {
          new (...args: A): Inst & Assoc;
          prototype: Inst & Assoc;
          includes<M>(this: M, ...names: Array<AssocNames<Assoc> | IncludeOptions>): M;
          joins<M>(this: M, ...names: AssocNames<Assoc>[]): M;
          whereMissing<M>(this: M, name: AssocNames<Assoc>): M;
          /**
           * Phantom type alias — *only* meaningful in type positions. The runtime
           * value is always `undefined`. Use `typeof MyModel.Instance` to name
           * the hydrated instance shape (including column property getters,
           * association accessors, and persistent-key readonlys) in subclass
           * static-method return / parameter types without spelling out
           * `Awaited<ReturnType<typeof MyModel.create>>`.
           *
           * @example
           * ```ts
           * class Message extends Model({ tableName: 'messages', connector }) {
           *   static async withBody(id: number): Promise<typeof Message.Instance> {
           *     return Message.find(id);
           *   }
           *   static label(m: typeof Message.Instance): string {
           *     return `${m.id}: ${m.body}`;
           *   }
           * }
           * ```
           */
          Instance: Inst &
            Assoc &
            PersistentProps &
            Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
        }
      : R
    : never;

/**
 * An association entry on `Model.associations`. `belongsTo` / `hasMany` /
 * `hasOne` accept either the related Model directly or a thunk for circular
 * imports — same shape as `cascade` and `counterCaches`.
 */
export type AssociationDefinition =
  | {
      belongsTo: typeof ModelClass | (() => typeof ModelClass);
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasMany: typeof ModelClass | (() => typeof ModelClass);
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasOne: typeof ModelClass | (() => typeof ModelClass);
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasManyThrough: typeof ModelClass | (() => typeof ModelClass);
      through: typeof ModelClass | (() => typeof ModelClass);
      throughForeignKey?: string;
      targetForeignKey?: string;
      selfPrimaryKey?: string;
      targetPrimaryKey?: string;
    };

export type AssociationsMap = Record<string, AssociationDefinition>;

export type SimpleAssociationDefinition = Exclude<AssociationDefinition, { hasManyThrough: any }>;
export type HasManyThroughDefinition = Extract<AssociationDefinition, { hasManyThrough: any }>;

export function resolveAssociationTarget(spec: SimpleAssociationDefinition): {
  target: typeof ModelClass;
  parentColumn: string;
  childColumn: string;
  cardinality: 'many' | 'one';
} {
  const lazy = (
    'belongsTo' in spec ? spec.belongsTo : 'hasMany' in spec ? spec.hasMany : spec.hasOne
  ) as typeof ModelClass | (() => typeof ModelClass);
  const target =
    typeof lazy === 'function' && !(lazy as any).tableName
      ? (lazy as () => typeof ModelClass)()
      : (lazy as typeof ModelClass);
  if ('belongsTo' in spec) {
    const childPk = spec.primaryKey ?? Object.keys(target.keys)[0] ?? 'id';
    return {
      target,
      parentColumn: spec.foreignKey,
      childColumn: childPk,
      cardinality: 'one',
    };
  }
  // hasMany / hasOne
  const cardinality: 'many' | 'one' = 'hasMany' in spec ? 'many' : 'one';
  return {
    target,
    parentColumn: spec.primaryKey ?? 'id',
    childColumn: spec.foreignKey,
    cardinality,
  };
}

export function resolveHasManyThrough(
  spec: HasManyThroughDefinition,
  selfModel: { tableName: string; keys: Dict<KeyType> },
): {
  target: typeof ModelClass;
  through: typeof ModelClass;
  throughForeignKey: string;
  targetForeignKey: string;
  selfPrimaryKey: string;
  targetPrimaryKey: string;
} {
  const targetLazy = spec.hasManyThrough as typeof ModelClass | (() => typeof ModelClass);
  const throughLazy = spec.through as typeof ModelClass | (() => typeof ModelClass);
  const target =
    typeof targetLazy === 'function' && !(targetLazy as any).tableName
      ? (targetLazy as () => typeof ModelClass)()
      : (targetLazy as typeof ModelClass);
  const through =
    typeof throughLazy === 'function' && !(throughLazy as any).tableName
      ? (throughLazy as () => typeof ModelClass)()
      : (throughLazy as typeof ModelClass);
  return {
    target,
    through,
    throughForeignKey: spec.throughForeignKey ?? `${singularize(selfModel.tableName)}Id`,
    targetForeignKey: spec.targetForeignKey ?? `${singularize(target.tableName)}Id`,
    selfPrimaryKey: spec.selfPrimaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id',
    targetPrimaryKey: spec.targetPrimaryKey ?? Object.keys(target.keys)[0] ?? 'id',
  };
}

export type CascadeAction = 'destroy' | 'deleteAll' | 'nullify' | 'restrict';

export type CascadeSpec =
  | {
      hasMany: typeof ModelClass | (() => typeof ModelClass);
      foreignKey: string;
      primaryKey?: string;
      dependent: CascadeAction;
    }
  | {
      hasOne: typeof ModelClass | (() => typeof ModelClass);
      foreignKey: string;
      primaryKey?: string;
      dependent: CascadeAction;
    };

export type CascadeMap = Record<string, CascadeSpec>;

export interface CounterCacheSpec {
  belongsTo: typeof ModelClass | (() => typeof ModelClass);
  foreignKey: string;
  column: string;
  primaryKey?: string;
}

export type HasManyThroughOptions = {
  throughForeignKey?: string;
  targetForeignKey?: string;
  selfPrimaryKey?: string;
  targetPrimaryKey?: string;
};

type TimestampsOption = boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };

type SoftDeleteOption = boolean | string | { column?: string };

function resolveConflictKeys(
  modelKeys: Dict<KeyType>,
  onConflict: string | string[] | undefined,
): string[] {
  if (onConflict === undefined) return Object.keys(modelKeys);
  return Array.isArray(onConflict) ? onConflict : [onConflict];
}

function resolveTimestampColumn(
  value: boolean | string | undefined,
  defaultName: string,
): string | undefined {
  if (value === false) return undefined;
  if (value === undefined || value === true) return defaultName;
  return value;
}

export function resolveTimestampColumns(option: TimestampsOption | undefined): {
  createdAtColumn: string | undefined;
  updatedAtColumn: string | undefined;
} {
  if (option === false) return { createdAtColumn: undefined, updatedAtColumn: undefined };
  if (option === undefined || option === true) {
    return { createdAtColumn: 'createdAt', updatedAtColumn: 'updatedAt' };
  }
  return {
    createdAtColumn: resolveTimestampColumn(option.createdAt, 'createdAt'),
    updatedAtColumn: resolveTimestampColumn(option.updatedAt, 'updatedAt'),
  };
}

function resolveAutoAssociation(record: ModelClass, spec: AssociationDefinition): unknown {
  // Build a query-builder traversal from this record outward via
  // `createAssociationQuery`. Supports belongsTo / hasOne / hasMany / hasManyThrough
  // (incl. polymorphic) and returns the same builder shapes as
  // `<InstanceQuery>.<assocName>` and `<CollectionQuery>.<assocName>`:
  //   - hasMany / hasManyThrough -> CollectionQuery<Related>
  //   - belongsTo / hasOne       -> InstanceQuery<Related>
  // Both are PromiseLike, so existing `await record.assocName` keeps working.
  const M = record.constructor as typeof ModelClass;
  const pk = Object.keys(M.keys)[0] ?? 'id';
  const pkValue = (record as unknown as Dict<any>)[pk];

  // Synthesize an upstream InstanceQuery whose state filters by this record's pk.
  // Used as the parent for the association traversal.
  const upstreamState: QueryState = {
    Model: M,
    filter: { [pk]: pkValue } as Filter<any>,
    order: [],
    limit: 1,
    selectedIncludes: [],
    includeStrategy: 'preload',
    pendingJoins: [],
    softDelete: M.softDelete ?? false,
  };
  const upstream = new InstanceQuery(M, 'find', upstreamState);
  return createAssociationQuery(upstream, spec);
}

export function resolveSoftDelete(option: SoftDeleteOption | undefined): {
  softDeleteMode: 'active' | 'only' | false;
  softDeleteColumn: string;
} {
  if (option === undefined || option === false) {
    return { softDeleteMode: false, softDeleteColumn: 'discardedAt' };
  }
  if (option === true) {
    return { softDeleteMode: 'active', softDeleteColumn: 'discardedAt' };
  }
  if (typeof option === 'string') {
    return { softDeleteMode: 'active', softDeleteColumn: option };
  }
  return { softDeleteMode: 'active', softDeleteColumn: option.column ?? 'discardedAt' };
}

/**
 * A read-only connector whose every query returns an empty result. Used by
 * `Model.none()` so an empty scope short-circuits without hitting the
 * underlying connector. Writes are silent no-ops (matches Rails' `.none`
 * which makes mutations on an empty scope no-op as well).
 */
export class NullConnector implements Connector {
  async query() {
    return [];
  }
  async count() {
    return 0;
  }
  async select() {
    return [];
  }
  async updateAll() {
    return [];
  }
  async deleteAll() {
    return [];
  }
  async batchInsert() {
    return [];
  }
  async upsert() {
    return [];
  }
  async execute() {
    return [];
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async aggregate() {
    return undefined;
  }
  async hasTable() {
    return false;
  }
  async createTable() {
    return;
  }
  async dropTable() {
    return;
  }
  async alterTable() {
    return;
  }
  async deltaUpdate() {
    return 0;
  }
}

export type HavingPredicate = ((count: number) => boolean) | { count?: HavingComparison };
export type HavingComparison = {
  $eq?: number;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
};

export function compileHaving(predicate: HavingPredicate): (count: number) => boolean {
  if (typeof predicate === 'function') return predicate;
  const cmp = predicate.count;
  if (!cmp) return () => true;
  return (count: number) => {
    if (cmp.$eq !== undefined && !(count === cmp.$eq)) return false;
    if (cmp.$gt !== undefined && !(count > cmp.$gt)) return false;
    if (cmp.$gte !== undefined && !(count >= cmp.$gte)) return false;
    if (cmp.$lt !== undefined && !(count < cmp.$lt)) return false;
    if (cmp.$lte !== undefined && !(count <= cmp.$lte)) return false;
    return true;
  };
}

/**
 * Per-Model scope map. Each scope is a `Filter<any>` literal that's applied
 * via `Model.filterBy(filter)` when the auto-generated no-arg static is
 * invoked. Scopes are the preferred shorthand for predeclared filters; for
 * complex / parameterized cases declare a static method on your subclass that
 * composes `filterBy` / `orFilterBy` / etc. yourself.
 */
/**
 * Each scope value is either:
 * - A `Filter<any>` literal — the no-arg static method calls `this.filterBy(filter)`.
 * - A function `(...args) => Filter<any>` — the generated static method
 *   forwards its arguments to the function and calls `this.filterBy(...)`.
 *
 * Functions cover the "one-line parameterised filter" case
 * (`olderThan: (age: number) => ({ age: { $gt: age } })`). For multi-line /
 * multi-clause logic declare a static method on your subclass instead.
 */
export type ScopeDef = Filter<any> | ((...args: any[]) => Filter<any>);

export type ScopeMap = Dict<ScopeDef>;

export type ScopesToMethods<Self, S extends ScopeMap> = {
  [K in keyof S]: S[K] extends (...args: infer A) => Filter<any>
    ? (...args: A) => Self
    : () => Self;
};

export class ModelClass {
  static tableName: string;
  /**
   * Column names declared on the schema for this Model's table, in the order
   * they appear in the schema. Used by the instance constructor to install
   * property getters for every declared column — including columns the
   * caller omitted at `create({ ... })` time — so that a later
   * `update({ col: value })` makes `instance.col` readable without a
   * re-fetch.
   *
   * Defaults to an empty array for legacy code paths that build a Model
   * without going through the schema-driven `Model()` factory.
   */
  static schemaColumnNames: readonly string[] = [];
  static filter: Filter<any> | undefined;
  /**
   * Sticky filter applied to every chained read on the Model. Unlike
   * `filter` (which seeds the chain's initial state and is cleared by
   * `unfiltered()`), `defaultScope` is merged in at lower-time on every read
   * regardless of what the chain did with `filter`. Suppress per-key via
   * `unscope(key)` / `unscope(...keys)`; suppress entirely via `unscoped()`.
   */
  static defaultScope: Filter<any> | undefined = undefined;
  static limit: number | undefined;
  static skip: number | undefined;
  static order: OrderColumn<any>[];
  static keys: Dict<KeyType>;
  static connector: Connector;
  static init: (props: any) => Dict<any>;
  /**
   * When set, the Model writes the current timestamp to this column on
   * create. Set to `undefined` (via `timestamps: false` or
   * `timestamps: { createdAt: false }`) to disable.
   */
  static createdAtColumn: string | undefined = 'createdAt';
  /**
   * When set, the Model writes the current timestamp to this column on
   * create, save, and `touch()`. `undefined` to disable.
   */
  static updatedAtColumn: string | undefined = 'updatedAt';
  /** Column used by `discard()` / `restore()` + the soft-delete scope. */
  static softDeleteColumn: string = 'discardedAt';
  static softDelete: 'active' | 'only' | false = false;
  /**
   * Map of column → allowed enum values, populated by the `enums: {...}` factory
   * option. Each value generates a chainable class scope and an instance
   * predicate; out-of-range values fail `isValid()`.
   */
  static enums: Dict<readonly string[]> = {};
  /**
   * When set, `save()` and `delete()` enforce optimistic locking against this
   * column. Inserts default the column to 0; updates require the in-memory
   * value to match the row's current value, otherwise throw `StaleObjectError`.
   */
  static lockVersionColumn: string | undefined = undefined;
  /**
   * When set, `all()` / `first()` / `last()` / `find()` / `findBy()` fetch
   * only these columns (plus every primary key) from the connector. Model
   * instances are still returned; they just carry partial data. Set via the
   * `fields(...keys)` chainable.
   */
  static selectedFields: string[] | undefined = undefined;
  /**
   * Names from `Model.associations` selected for eager loading on the next
   * `all()` / `first()` / etc. fetch. Populated by `Model.includes(...names)`;
   * cleared by `Model.withoutIncludes()` and `Model.unscoped()`.
   */
  static selectedIncludes: string[] = [];
  /**
   * Strategy used to resolve `selectedIncludes` at terminal time:
   *
   *  - `'preload'` (default): one batched query per association via the existing
   *    `preloadBelongsTo` / `preloadHasMany` primitives — works on every connector.
   *  - `'join'`: routes through `Connector.queryWithJoins` with `mode: 'includes'` —
   *    one round-trip per `all()` call. Requires `connector.queryWithJoins`.
   *  - `'auto'`: prefers `'join'` when supported, falls back to `'preload'` otherwise.
   */
  static includeStrategy: IncludeStrategy = 'preload';
  /**
   * Optional declarative association registry. When set, `filterBy({ <name>: { … } })`
   * routes the nested filter through a JOIN (or its `$async` fallback) instead
   * of treating `<name>` as a column. Each entry mirrors the include spec
   * shape; `() => Model` thunks are supported for circular imports.
   */
  static associations: AssociationsMap | undefined = undefined;
  /**
   * Registry of `tableName → Model class`, populated when each Model is
   * constructed via the schema-mode entry point. Used by schema-driven
   * association resolution so the target Model class is reachable by name even
   * when the file declaring it imports another file in a cycle.
   *
   * **Caveat:** the registry is keyed only by tableName. Apps that construct
   * multiple schemas declaring the same table name (e.g. multi-tenant
   * deployments, mixed-scope test setups) will overwrite the prior entry. The
   * single-schema-per-process assumption matches the typical app shape; if
   * that ceases to hold, the registry needs to be scoped to the schema
   * identity instead.
   */
  static tableRegistry: Map<string, typeof ModelClass> = new Map();
  /**
   * Pending JOIN clauses accumulated by `joins(...)`, `whereMissing(...)`, and
   * cross-association `filterBy(...)` calls. Resolved at terminal time:
   * connectors that implement `queryWithJoins` route the chain through it;
   * others fall back to a Model-resolved `$in` / `$notIn` filter.
   */
  static pendingJoins: JoinClause[] = [];
  /**
   * When set, `countBy(...)` filters the result map by this predicate after
   * aggregation. Configured via `having(...)`; cleared by `unscoped()`.
   */
  static havingPredicate: ((count: number) => boolean) | undefined = undefined;
  /**
   * Single Table Inheritance — name of the column that stores the subclass
   * discriminator. Set on the base Model via the `inheritColumn` factory
   * option. When set, `all()` / `find()` inspect this column and route each
   * row to the registered subclass.
   */
  static inheritColumn: string | undefined = undefined;
  /**
   * Value the `inheritColumn` is set to for this Model. Non-undefined on
   * subclasses created via `Base.inherit({ type: ... })`; undefined on the
   * base. Insert-time the column is auto-populated; read-time it becomes a
   * default filter.
   */
  static inheritType: string | undefined = undefined;
  /** On the base Model, maps inheritColumn values → subclass constructors. */
  static inheritRegistry: Map<string, typeof ModelClass> | undefined = undefined;
  /**
   * Map of JSON-column name → sub-keys to expose as instance accessors.
   * Reads/writes proxy into the JSON column, so `user.theme = 'dark'`
   * actually mutates `user.settings.theme`. Configured via the
   * `storeAccessors` factory option.
   */
  static storeAccessors: Dict<readonly string[]> = {};
  /**
   * Cascade declarations consulted by `delete()` to clean up children.
   * Populated via the `cascade` factory option. Entries support
   * `dependent: 'destroy' | 'deleteAll' | 'nullify' | 'restrict'`.
   */
  static cascadeMap: CascadeMap | undefined = undefined;
  /**
   * Map of column → normalizer function. When `assign()` writes this column,
   * the input value is passed through the function before being stored.
   * Runs both for direct setters and for `update(...)` / `build({...})`.
   */
  static normalizers: Dict<(value: any) => any> = {};
  /**
   * Columns that should be auto-populated with a random URL-safe token on
   * insert if blank. Configured via the `secureTokens` factory option.
   */
  static secureTokenColumns: Dict<{ length: number }> = {};
  static validators: Validator<any>[] = [];
  static callbacks: Callbacks<any> = {};

  static async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Nested call: reuse the outer context so child saves register their
    // commit/rollback hooks against the outermost transaction.
    if (activeTransaction()) {
      return this.connector.transaction(fn);
    }
    const ctx: TransactionContext = { afterCommit: [], afterRollback: [] };
    return withTransactionContext(ctx, async () => {
      let result: T;
      try {
        result = await this.connector.transaction(fn);
      } catch (err) {
        for (const cb of ctx.afterRollback) {
          try {
            await cb();
          } catch {
            /* swallow per-callback errors so the original throws */
          }
        }
        throw err;
      }
      for (const cb of ctx.afterCommit) {
        await cb();
      }
      return result;
    });
  }

  // ---------------------------------------------------------------------------
  // Chain methods — forward to CollectionQuery.<method>(...).
  //
  // Runtime: each returns a CollectionQuery whose state carries the chained
  // scope. CollectionQuery is PromiseLike (resolves to records[]) and exposes
  // `.first()`, `.last()`, `.findBy()`, `.find()`, `.findOrFail()`,
  // `.count()`, `.sum()` etc — so existing chain forms keep working.
  //
  // Types: cast back to the calling Model class so external callers continue
  // to type-check via the existing static method shapes (`Todo.filterBy(...)`
  // looks like it returns `typeof Todo` to TypeScript, but at runtime it's a
  // CollectionQuery).
  // ---------------------------------------------------------------------------

  static limitBy<M extends typeof ModelClass>(this: M, amount: number) {
    return CollectionQuery.fromModel(this as any).limitBy(amount) as unknown as M;
  }

  static unlimited<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).unlimited() as unknown as M;
  }

  static skipBy<M extends typeof ModelClass>(this: M, amount: number) {
    return CollectionQuery.fromModel(this as any).skipBy(amount) as unknown as M;
  }

  static unskipped<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).unskipped() as unknown as M;
  }

  static orderBy<M extends typeof ModelClass>(this: M, order: Order<any>) {
    return CollectionQuery.fromModel(this as any).orderBy(order) as unknown as M;
  }

  static unordered<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).unordered() as unknown as M;
  }

  static withOrder<M extends typeof ModelClass>(this: M, order: Order<any>) {
    return CollectionQuery.fromModel(this as any).withOrder(order) as unknown as M;
  }

  /**
   * @deprecated Use {@link ModelClass.withOrder | withOrder} instead.
   * Calling `reorder()` emits a one-shot `console.warn` and delegates to
   * `withOrder()`. The `reorder` name is reserved so subclasses can use it
   * for domain-specific user-facing methods (e.g. "reorder items by sortOrder").
   */
  static reorder<M extends typeof ModelClass>(this: M, order: Order<any>) {
    return CollectionQuery.fromModel(this as any).reorder(order) as unknown as M;
  }

  static filterBy<M extends typeof ModelClass>(this: M, input: Filter<any>) {
    return CollectionQuery.fromModel(this as any).filterBy(input) as unknown as M;
  }

  static orFilterBy<M extends typeof ModelClass>(this: M, input: Filter<any>) {
    return CollectionQuery.fromModel(this as any).orFilterBy(input) as unknown as M;
  }

  static unfiltered<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).unfiltered() as unknown as M;
  }

  static reverse<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).reverse() as unknown as M;
  }

  static unscoped<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).unscoped() as unknown as M;
  }

  /**
   * Drop the listed columns from the Model's `defaultScope` for this scope
   * only. Leaves the rest of the chain's filter / order / limit intact —
   * unlike `unscoped()`, which clears everything alongside the default scope.
   * Pass one or more column names: `Post.unscope('archivedAt')` returns the
   * `defaultScope` minus the `archivedAt` clause. No-op when the Model has no
   * `defaultScope` declared.
   */
  static unscope<M extends typeof ModelClass>(this: M, ...keys: string[]) {
    return CollectionQuery.fromModel(this as any).unscope(...keys) as unknown as M;
  }

  /**
   * Combine another scope's filter / order / limit / skip into this chain.
   * Filters AND-combine; the merged scope's order / limit / skip override
   * this chain's when set. Mirrors Rails' `relation.merge`.
   */
  static merge<M extends typeof ModelClass>(this: M, other: typeof ModelClass): M {
    return CollectionQuery.fromModel(this as any).merge(other as any) as unknown as M;
  }

  /**
   * Return a chainable scope that resolves to zero rows without hitting the
   * underlying connector. Useful as a guard when you'd otherwise return an
   * unfiltered scope (`user.banned ? Post.none() : Post.filterBy({...})`).
   */
  static none<M extends typeof ModelClass>(this: M): M {
    return CollectionQuery.fromModel(this as any).none() as unknown as M;
  }

  /**
   * Add a HAVING-style filter applied to the post-aggregation result of
   * `countBy(...)`. Accepts either a function predicate or a comparison
   * object (`{ count: { $gt: 5 } }`).
   */
  static having<M extends typeof ModelClass>(this: M, predicate: HavingPredicate): M {
    return CollectionQuery.fromModel(this as any).having(predicate) as unknown as M;
  }

  /**
   * Restrict subsequent `all()` / `first()` / `last()` / `find()` / `findBy()`
   * fetches to the given columns. The Model's primary key(s) are always
   * included even when omitted from the list so instances can still save,
   * reload and delete.
   */
  static fields<M extends typeof ModelClass>(this: M, ...keys: string[]) {
    return CollectionQuery.fromModel(this as any).fields(...keys) as unknown as M;
  }

  static allFields<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).allFields() as unknown as M;
  }

  static on(event: keyof Callbacks<any>, handler: Callback<any> | AroundCallback<any>): () => void {
    if (!this.callbacks[event]) (this.callbacks as any)[event] = [];
    const list = (this.callbacks as any)[event] as Array<Callback<any> | AroundCallback<any>>;
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  /**
   * Run `fn` with the listed lifecycle events suppressed on this Model.
   * Registered handlers are NOT removed — they're hidden for the duration
   * of the call and restored in a `finally`, even if `fn` throws. Useful for
   * tests and bulk imports.
   */
  static async skipCallbacks<T>(
    events: Array<keyof Callbacks<any>>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const saved: Partial<Record<keyof Callbacks<any>, any>> = {};
    for (const event of events) {
      saved[event] = (this.callbacks as any)[event];
      (this.callbacks as any)[event] = undefined;
    }
    try {
      return await fn();
    } finally {
      for (const event of events) {
        (this.callbacks as any)[event] = saved[event];
      }
    }
  }

  static withDiscarded<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).withDiscarded() as unknown as M;
  }

  static onlyDiscarded<M extends typeof ModelClass>(this: M) {
    return CollectionQuery.fromModel(this as any).onlyDiscarded() as unknown as M;
  }

  static build<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init(createProps)) as InstanceType<M>;
  }

  static buildScoped<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init({ ...this.filter, ...createProps })) as InstanceType<M>;
  }

  static create<M extends typeof ModelClass>(this: M, createProps: any) {
    return this.build<M>(createProps).save();
  }

  static createScoped<M extends typeof ModelClass>(this: M, props: any) {
    return this.buildScoped<M>(props).save();
  }

  static async createMany<M extends typeof ModelClass>(this: M, propsList: any[]) {
    const now = new Date();
    const createdCol = this.createdAtColumn;
    const updatedCol = this.updatedAtColumn;
    const insertProps = propsList.map((p) => {
      const base = this.init(p) as Dict<any>;
      if (createdCol && base[createdCol] === undefined) base[createdCol] = now;
      if (updatedCol && base[updatedCol] === undefined) base[updatedCol] = now;
      return base;
    });
    const items = await this.connector.batchInsert(this.tableName, this.keys, insertProps);
    return items.map((item) => {
      const keys: Dict<any> = {};
      for (const key in this.keys) {
        keys[key] = item[key];
        delete item[key];
      }
      return new this(item, keys) as InstanceType<M>;
    });
  }

  /**
   * Declare associations to eager-load alongside subsequent `all()` / `first()`
   * / `last()` / `find()` calls. Each map entry names the property to attach
   * on each returned instance and how to load it.
   *
   * @example
   * const posts = await Post.includes({
   *   user: { belongsTo: User, foreignKey: 'userId' },
   *   comments: { hasMany: Comment, foreignKey: 'postId' },
   * }).all();
   * posts[0].user       // User instance (pre-loaded; no extra round-trip)
   * posts[0].comments   // Comment[]    (pre-loaded)
   *
   * Without `includes(...)` the same associations work as before — the
   * Rails-style `this.belongsTo(User)` / `this.hasMany(Comment)` helpers
   * on each instance still return a `Promise` (lazy load). `includes(...)`
   * is the opt-in to eager-load and cut N+1 round-trips when you know up
   * front which associations every row needs.
   */
  /**
   * Eager-load named associations. Each name must match an entry on
   * `Model.associations` (declared at the factory). Equivalent to Rails'
   * `User.includes(:posts, :company)`. The optional trailing options object
   * controls the strategy:
   *
   *   - `'preload'` (default): one batched `WHERE fk IN (...)` per
   *     association after the main fetch. Works on every connector.
   *   - `'join'`: routes through `Connector.queryWithJoins`. Throws if the
   *     connector doesn't implement it.
   *   - `'auto'`: picks `'join'` when supported, `'preload'` otherwise.
   *
   * Each loaded value lands on `record.<name>` — overwriting the auto-defined
   * lazy accessor with the resolved value.
   */
  static includes<M extends typeof ModelClass>(
    this: M,
    ...args: Array<string | IncludeOptions>
  ): M {
    return CollectionQuery.fromModel(this as any).includes(...args) as unknown as M;
  }

  static withoutIncludes<M extends typeof ModelClass>(this: M): M {
    return CollectionQuery.fromModel(this as any).withoutIncludes() as unknown as M;
  }

  /**
   * INNER JOIN (default) the named associations on the chain. Each name must
   * match an entry on `Model.associations`. Equivalent to Rails'
   * `User.joins(:posts, :company)`. On connectors that implement
   * `queryWithJoins`, runs as `WHERE EXISTS (...)`; on others, falls back to
   * a Model-resolved `$in` filter against the child table.
   *
   *   const active = await User.joins('posts').filterBy({ active: true }).all();
   */
  static joins<M extends typeof ModelClass>(this: M, ...names: string[]): M {
    return CollectionQuery.fromModel(this as any).joins(...names) as unknown as M;
  }

  /**
   * Filter the chain to records that have no matching child rows. Mirrors
   * Rails' `User.where.missing(:posts)`. The named association must be
   * `hasMany` or `hasOne`; `belongsTo` is rejected because "missing parent"
   * has different semantics (use `filterBy({ $null: 'parentId' })`).
   *
   * On connectors that implement `queryWithJoins`, runs as a single
   * `WHERE NOT EXISTS (...)` on the parent query. On others, the Model layer
   * resolves the child query to a concrete `$notIn: { [pk]: [...] }` filter
   * before reaching the connector — so even native sqlite/pg/mysql/mariadb
   * (which reject `$async`) work transparently.
   *
   *   await User.whereMissing('posts').filterBy({ active: true }).all();
   */
  static whereMissing<M extends typeof ModelClass>(this: M, name: string): M {
    return CollectionQuery.fromModel(this as any).whereMissing(name) as unknown as M;
  }

  /**
   * Declare a subclass for Single Table Inheritance. The base Model must have
   * been created with `inheritColumn: '...'`. Returns a new Model class that
   * shares the base's table / keys / connector / init but:
   *
   *   - auto-sets `{ [inheritColumn]: type }` on insert,
   *   - auto-filters reads to that type,
   *   - is registered on the base so `Base.find(id)` / `Base.all()` on a row
   *     whose type matches this subclass returns an instance of the subclass.
   *
   * Additional `validators` / `callbacks` are concatenated with the base's.
   */
  static inherit<M extends typeof ModelClass>(
    this: M,
    options: {
      type: string;
      validators?: Validator<any>[];
      callbacks?: Callbacks<any>;
    },
  ): M {
    if (!this.inheritColumn) {
      throw new Error(
        `${this.name || 'Model'}.inherit() requires the base to be declared with inheritColumn: '...'`,
      );
    }

    const mergedValidators = [...this.validators, ...(options.validators ?? [])];
    const mergedCallbacks: Callbacks<any> = { ...(this.callbacks as any) };
    for (const key in options.callbacks ?? {}) {
      const existing = ((mergedCallbacks as any)[key] ?? []) as any[];
      const added = ((options.callbacks as any)[key] ?? []) as any[];
      (mergedCallbacks as any)[key] = [...existing, ...added];
    }
    const Sub = class extends (this as typeof ModelClass) {
      static inheritType = options.type;
      static inheritRegistry: Map<string, typeof ModelClass> | undefined = undefined;
      static validators = mergedValidators as Validator<any>[];
      static callbacks = mergedCallbacks;
    };
    if (!this.inheritRegistry) this.inheritRegistry = new Map();
    this.inheritRegistry.set(options.type, Sub as unknown as typeof ModelClass);
    return Sub as M;
  }

  /**
   * Returns a chainable CollectionQuery that resolves to the matching
   * records. PromiseLike, so `await Model.all()` keeps working unchanged.
   * Chainable terminals (`.first()`, `.count()`, `.pluck(...)`, etc.) are
   * available on the returned builder.
   */
  static all<M extends typeof ModelClass>(this: M): CollectionQuery<InstanceType<M>[]> {
    return CollectionQuery.fromModel(this as any) as unknown as CollectionQuery<InstanceType<M>[]>;
  }

  /**
   * Returns a chainable InstanceQuery that resolves to the first record in
   * the current scope (or `undefined` when empty). PromiseLike, so
   * `await Model.first()` works unchanged.
   */
  static first<M extends typeof ModelClass>(this: M): InstanceQuery<InstanceType<M> | undefined> {
    return CollectionQuery.fromModel(this as any).first() as unknown as InstanceQuery<
      InstanceType<M> | undefined
    >;
  }

  /**
   * Returns a chainable InstanceQuery that resolves to the last record in
   * the current scope (or `undefined` when empty). Reverses any existing
   * orderBy and falls back to primary-key descending when no order is set.
   */
  static last<M extends typeof ModelClass>(this: M): InstanceQuery<InstanceType<M> | undefined> {
    return CollectionQuery.fromModel(this as any).last() as unknown as InstanceQuery<
      InstanceType<M> | undefined
    >;
  }

  /**
   * Walk the current scope in batches of `size`. Each yielded array holds at
   * most `size` records; the final batch may be smaller. The chain's existing
   * `orderBy` is preserved (defaulting to primary key when unset) so batches
   * are deterministic.
   */
  static inBatchesOf<M extends typeof ModelClass>(
    this: M,
    size: number,
  ): AsyncGenerator<InstanceType<M>[], void, void> {
    return CollectionQuery.fromModel(this as any).inBatchesOf(size) as AsyncGenerator<
      InstanceType<M>[],
      void,
      void
    >;
  }

  /**
   * Walk the current scope record-by-record, batching internally for
   * efficiency. Default batch size 100. Useful for streaming large result
   * sets without loading everything into memory.
   */
  static findEach<M extends typeof ModelClass>(
    this: M,
    size = 100,
  ): AsyncGenerator<InstanceType<M>, void, void> {
    return CollectionQuery.fromModel(this as any).findEach(size) as AsyncGenerator<
      InstanceType<M>,
      void,
      void
    >;
  }

  /**
   * Offset-based pagination on the current scope. Returns the page items,
   * total count, and metadata (total pages, hasNext, hasPrev). For large
   * tables prefer `paginateCursor()` — it avoids the O(skip) cost of
   * LIMIT/OFFSET.
   */
  static paginate<M extends typeof ModelClass>(
    this: M,
    page: number,
    perPage = 25,
  ): Promise<{
    items: InstanceType<M>[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    return CollectionQuery.fromModel(this as any).paginate(page, perPage) as Promise<{
      items: InstanceType<M>[];
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>;
  }

  /**
   * Cursor-based ("keyset") pagination. Avoids the O(skip) cost of
   * `.paginate()`'s LIMIT/OFFSET path, so it stays cheap on large tables.
   * Pass `after` to advance, `before` to walk backward; without either,
   * returns the first page. The chain's lead `orderBy` is the cursor key;
   * primary key is always the tiebreaker so identical sort values paginate
   * deterministically.
   */
  static paginateCursor<M extends typeof ModelClass>(
    this: M,
    options: { after?: string; before?: string; limit?: number } = {},
  ): Promise<{
    items: InstanceType<M>[];
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
  }> {
    return CollectionQuery.fromModel(this as any).paginateCursor(options) as Promise<{
      items: InstanceType<M>[];
      nextCursor?: string;
      prevCursor?: string;
      hasMore: boolean;
    }>;
  }

  /** Pluck the primary-key column from the current scope. */
  static ids<M extends typeof ModelClass>(this: M): Promise<unknown[]> {
    return CollectionQuery.fromModel(this as any).ids();
  }

  /**
   * Project the current scope to specific columns via the connector's
   * `select`. Returns rows shaped with only the requested keys — does NOT
   * hydrate Model instances.
   */
  static select<M extends typeof ModelClass>(this: M, ...keys: string[]): Promise<Dict<any>[]> {
    return CollectionQuery.fromModel(this as any).select(...keys);
  }

  /**
   * Pluck columns from the current scope. With one column, returns a
   * chainable ColumnQuery (PromiseLike) so `await Model.pluck('email')`
   * resolves to `string[]`. With multiple columns, returns
   * `Promise<unknown[][]>` (each row a tuple). With zero arguments, returns
   * `Promise<[]>`.
   */
  static pluck<M extends typeof ModelClass>(
    this: M,
    ...keys: string[]
  ): ColumnQuery<unknown[]> | Promise<unknown[]> {
    return CollectionQuery.fromModel(this as any).pluck(...keys);
  }

  /** Pluck a column with duplicates removed (preserving first-appearance order). */
  static pluckUnique<M extends typeof ModelClass>(this: M, key: string): Promise<unknown[]> {
    return CollectionQuery.fromModel(this as any).pluckUnique(key);
  }

  /**
   * Returns a chainable ScalarQuery resolving to the count of records in the
   * current scope. PromiseLike, so `await Model.count()` works unchanged.
   */
  static count<M extends typeof ModelClass>(this: M): ScalarQuery<number> {
    return CollectionQuery.fromModel(this as any).count() as unknown as ScalarQuery<number>;
  }

  /**
   * Group rows by the value of `key` and count each bucket. Honours `having`
   * — drops buckets the predicate rejects.
   */
  static countBy<M extends typeof ModelClass>(this: M, key: string): Promise<Map<unknown, number>> {
    return CollectionQuery.fromModel(this as any).countBy(key);
  }

  /**
   * Group rows by the value of `key`. Materialises every record (callbacks
   * fire) and buckets them by attribute value.
   */
  static groupBy<M extends typeof ModelClass>(
    this: M,
    key: string,
  ): Promise<Map<unknown, InstanceType<M>[]>> {
    return CollectionQuery.fromModel(this as any).groupBy(key) as Promise<
      Map<unknown, InstanceType<M>[]>
    >;
  }

  static async preloadBelongsTo<M extends typeof ModelClass>(
    this: M,
    records: any[],
    options: { foreignKey: string; primaryKey?: string },
  ): Promise<Map<any, InstanceType<M>>> {
    const fk = options.foreignKey;
    const pk = options.primaryKey ?? Object.keys(this.keys)[0] ?? 'id';
    const ids = new Set<any>();
    for (const record of records) {
      const attrs = record instanceof ModelClass ? record.attributes : record;
      const value = attrs?.[fk];
      if (value !== undefined && value !== null) ids.add(value);
    }
    if (ids.size === 0) return new Map();
    const related = await this.filterBy({ $in: { [pk]: [...ids] } } as Filter<any>).all<M>();
    const result = new Map<any, InstanceType<M>>();
    for (const r of related) {
      const key = (r.attributes as Dict<any>)[pk];
      result.set(key, r);
    }
    return result;
  }

  static async preloadHasMany<M extends typeof ModelClass>(
    this: M,
    records: any[],
    options: { foreignKey: string; primaryKey?: string },
  ): Promise<Map<any, InstanceType<M>[]>> {
    const fk = options.foreignKey;
    const pk = options.primaryKey ?? 'id';
    const ids = new Set<any>();
    for (const record of records) {
      const attrs = record instanceof ModelClass ? record.attributes : record;
      const value = attrs?.[pk];
      if (value !== undefined && value !== null) ids.add(value);
    }
    const result = new Map<any, InstanceType<M>[]>();
    for (const id of ids) result.set(id, []);
    if (ids.size === 0) return result;
    const related = await this.filterBy({ $in: { [fk]: [...ids] } } as Filter<any>).all<M>();
    for (const r of related) {
      const key = (r.attributes as Dict<any>)[fk];
      const list = result.get(key);
      if (list) list.push(r);
      else result.set(key, [r]);
    }
    return result;
  }

  /**
   * Run a single aggregate (sum / min / max / avg) against the current scope.
   * Most callers prefer `Model.sum(...)` / `Model.min(...)` etc. for the
   * chainable form. Returns `undefined` for empty result sets (except sum,
   * which returns 0 to match the `Model.sum` contract).
   */
  static async aggregate<M extends typeof ModelClass>(
    this: M,
    kind: AggregateKind,
    key: string,
  ): Promise<number | undefined> {
    const q = CollectionQuery.fromModel(this as any);
    if (kind === 'sum') return (await q.sum(key)) ?? 0;
    if (kind === 'min') return q.minimum<number>(key);
    if (kind === 'max') return q.maximum<number>(key);
    return q.average(key);
  }

  /**
   * SUM(column) on the current scope. Returns 0 on empty (the connector
   * returns undefined; the static adapter normalises to 0 — consistent with
   * the legacy `Model.sum(...)` contract).
   */
  static async sum<M extends typeof ModelClass>(this: M, key: string): Promise<number> {
    return (await CollectionQuery.fromModel(this as any).sum(key)) ?? 0;
  }

  /** Returns a chainable ScalarQuery resolving to MIN(column) (or undefined on empty). */
  static min<M extends typeof ModelClass>(this: M, key: string): ScalarQuery<number | undefined> {
    return CollectionQuery.fromModel(this as any).minimum<number>(key) as unknown as ScalarQuery<
      number | undefined
    >;
  }

  /** Returns a chainable ScalarQuery resolving to MAX(column) (or undefined on empty). */
  static max<M extends typeof ModelClass>(this: M, key: string): ScalarQuery<number | undefined> {
    return CollectionQuery.fromModel(this as any).maximum<number>(key) as unknown as ScalarQuery<
      number | undefined
    >;
  }

  /** Returns a chainable ScalarQuery resolving to AVG(column) (or undefined on empty). */
  static avg<M extends typeof ModelClass>(this: M, key: string): ScalarQuery<number | undefined> {
    return CollectionQuery.fromModel(this as any).average(key) as unknown as ScalarQuery<
      number | undefined
    >;
  }

  /**
   * Bulk DELETE on the current scope. Per-row callbacks DO NOT fire — use
   * `destroyAll()` for that. Returns the deleted row payloads.
   */
  static deleteAll<M extends typeof ModelClass>(this: M): Promise<unknown[]> {
    return CollectionQuery.fromModel(this as any).deleteAll();
  }

  /**
   * Materialise every matching record, then call `.delete()` on each so
   * per-row `beforeDelete` / `afterDelete` callbacks fire and any `cascade`
   * config takes effect. Slower than `deleteAll()` (N round-trips) but
   * matches Rails' `destroy_all` semantics.
   */
  static destroyAll<M extends typeof ModelClass>(this: M): Promise<InstanceType<M>[]> {
    return CollectionQuery.fromModel(this as any).destroyAll() as Promise<InstanceType<M>[]>;
  }

  /**
   * Bulk UPDATE on the current scope. Auto-stamps `updatedAt` (when the Model
   * declares one). Per-row `beforeUpdate` / `afterUpdate` callbacks DO NOT
   * fire — use `findEach` + `record.update(...)` for that.
   */
  static updateAll<M extends typeof ModelClass>(this: M, attrs: Dict<any>): Promise<unknown[]> {
    return CollectionQuery.fromModel(this as any).updateAll(attrs);
  }

  /**
   * Atomic `column = column + by` on every row matching the current scope.
   * Routes through the connector's `deltaUpdate(spec)` so each connector
   * picks the most efficient native shape (single-statement `UPDATE col =
   * col + ?` on SQL, `$inc` on Mongo, `HINCRBY` on Redis, in-process walk
   * on memory). Returns the affected row count.
   */
  static increment<M extends typeof ModelClass>(this: M, column: string, by = 1): Promise<number> {
    return CollectionQuery.fromModel(this as any).increment(column, by);
  }

  /** Sugar for `increment(column, -by)`. */
  static decrement<M extends typeof ModelClass>(this: M, column: string, by = 1): Promise<number> {
    return CollectionQuery.fromModel(this as any).decrement(column, by);
  }

  /**
   * Returns a chainable InstanceQuery resolving to the first matching record
   * (or `undefined` when no match). PromiseLike, so `await Model.findBy(x)`
   * works unchanged.
   */
  static findBy<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
  ): InstanceQuery<InstanceType<M> | undefined> {
    return CollectionQuery.fromModel(this as any).findBy(filter) as unknown as InstanceQuery<
      InstanceType<M> | undefined
    >;
  }

  /**
   * Cheap existence probe — `count() > 0` on the chained scope. Pass `filter`
   * to narrow without mutating the chain.
   */
  static exists<M extends typeof ModelClass>(this: M, filter?: Filter<any>): Promise<boolean> {
    return CollectionQuery.fromModel(this as any).exists(filter);
  }

  /**
   * Returns a chainable InstanceQuery resolving to the matched record. Throws
   * `NotFoundError` when no row matches (the terminal kind 'find' wires the
   * throwing semantics).
   */
  static find<M extends typeof ModelClass>(
    this: M,
    id: number | string,
  ): InstanceQuery<InstanceType<M>> {
    return CollectionQuery.fromModel(this as any).find(id) as unknown as InstanceQuery<
      InstanceType<M>
    >;
  }

  /**
   * Like `find(id)` but resolves to `null` on miss instead of throwing
   * `NotFoundError`. The conventional null-on-miss lookup pattern other
   * ORMs ship. Sugar over `findBy({ [pk]: id })` with an explicit `null`
   * sentinel — matches the function's name and lets callers `??`-coalesce.
   */
  static findOrNull<M extends typeof ModelClass>(
    this: M,
    id: number | string,
  ): InstanceQuery<InstanceType<M> | null> {
    return CollectionQuery.fromModel(this as any).findOrNull(
      id,
    ) as unknown as InstanceQuery<InstanceType<M> | null>;
  }

  /**
   * Same as `find(id)` but lookup is by arbitrary filter. Throws
   * `NotFoundError` when no row matches.
   */
  static findOrFail<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
  ): InstanceQuery<InstanceType<M>> {
    return CollectionQuery.fromModel(this as any).findOrFail(filter) as unknown as InstanceQuery<
      InstanceType<M>
    >;
  }

  static async findOrBuild<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.build<M>({ ...filter, ...createProps });
  }

  static async firstOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any = {},
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.create<M>({ ...filter, ...createProps });
  }

  static async updateOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    attrs: Dict<any>,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) {
      return (record as any).update(attrs) as Promise<InstanceType<M>>;
    }
    return this.create<M>({ ...filter, ...attrs });
  }

  /**
   * Insert a row or update an existing one when a conflict is found. By
   * default the conflict columns are the Model's primary key(s); pass
   * `onConflict` to use a different unique-key set. Returns the resulting
   * Model instance (either the freshly inserted row or the updated existing
   * row).
   *
   * When the connector exposes a native `upsert(spec)`, the operation
   * runs as a single atomic INSERT … ON CONFLICT … DO UPDATE statement
   * (no race window). The native path skips per-row lifecycle callbacks
   * and validators — matches Rails' `upsert` semantics. Use
   * `Model.create` / `record.update` (or wrap in `Model.transaction(...)`)
   * when callbacks / validators must run.
   */
  static async upsert<M extends typeof ModelClass>(
    this: M,
    props: Dict<any>,
    options: {
      onConflict?: string | string[];
      updateColumns?: string[];
      ignoreOnly?: boolean;
    } = {},
  ): Promise<InstanceType<M>> {
    const conflictKeys = resolveConflictKeys(this.keys, options.onConflict);
    for (const key of conflictKeys) {
      if (props[key] === undefined) {
        throw new PersistenceError(
          `upsert requires '${key}' to be present in the row (declared as a conflict column)`,
        );
      }
    }
    const [result] = await this.runUpsert<M>([props], conflictKeys, options);
    return result;
  }

  /**
   * Bulk variant of `upsert(...)`. Returns the resulting Model instances in
   * the input order. With a connector that exposes a native `upsert(spec)`
   * the entire batch runs in a single round-trip (one INSERT … ON CONFLICT
   * statement); the fallback path issues one bulk SELECT, one batched
   * INSERT, plus one UPDATE per matched row.
   */
  static async upsertAll<M extends typeof ModelClass>(
    this: M,
    propsList: Dict<any>[],
    options: {
      onConflict?: string | string[];
      updateColumns?: string[];
      ignoreOnly?: boolean;
    } = {},
  ): Promise<InstanceType<M>[]> {
    if (propsList.length === 0) return [];
    const conflictKeys = resolveConflictKeys(this.keys, options.onConflict);
    for (const row of propsList) {
      for (const key of conflictKeys) {
        if (row[key] === undefined) {
          throw new PersistenceError(
            `upsertAll requires '${key}' to be present in every row (declared as a conflict column)`,
          );
        }
      }
    }
    return this.runUpsert<M>(propsList, conflictKeys, options);
  }

  static async runUpsert<M extends typeof ModelClass>(
    this: M,
    propsList: Dict<any>[],
    conflictKeys: string[],
    options: { updateColumns?: string[]; ignoreOnly?: boolean },
  ): Promise<InstanceType<M>[]> {
    const now = new Date();
    const createdCol = this.createdAtColumn;
    const updatedCol = this.updatedAtColumn;

    const userSuppliedCols = new Set<string>();
    for (const row of propsList) {
      for (const key of Object.keys(row)) userSuppliedCols.add(key);
    }

    const insertRows = propsList.map((row) => {
      const base = this.init(row) as Dict<any>;
      // `init` may strip primary-key / conflict columns from the input
      // shape; the connector still needs them so it can match existing
      // rows and so the user's supplied keys aren't silently regenerated.
      for (const k of conflictKeys) {
        if (row[k] !== undefined) base[k] = row[k];
      }
      if (createdCol && base[createdCol] === undefined) base[createdCol] = now;
      if (updatedCol && base[updatedCol] === undefined) base[updatedCol] = now;
      return base;
    });

    let updateColumns: string[];
    if (options.updateColumns !== undefined) {
      updateColumns = options.updateColumns;
    } else {
      const cols = new Set<string>(userSuppliedCols);
      for (const k of conflictKeys) cols.delete(k);
      if (createdCol) cols.delete(createdCol);
      if (updatedCol) cols.add(updatedCol);
      updateColumns = [...cols];
    }

    const items = await this.connector.upsert({
      tableName: this.tableName,
      keys: this.keys,
      rows: insertRows,
      conflictTarget: conflictKeys,
      updateColumns,
      ignoreOnly: options.ignoreOnly,
    });

    return items.map((item) => {
      const keyValues: Dict<any> = {};
      for (const key in this.keys) {
        keyValues[key] = item[key];
        delete item[key];
      }
      return new this(item, keyValues) as InstanceType<M>;
    });
  }

  persistentProps: Dict<any>;
  changedProps: Dict<any> = {};
  lastSavedChanges: Dict<{ from: any; to: any }> = {};
  keys: Dict<any> | undefined;
  _errors: Errors | undefined;

  get errors(): Errors {
    if (!this._errors) this._errors = new Errors();
    return this._errors;
  }

  constructor(props: Dict<any>, keys?: Dict<any>) {
    this.persistentProps = props;
    this.keys = keys;

    const model = this.constructor as typeof ModelClass;

    // Install getters / setters for every column declared on the Model's
    // schema. Iterating only `persistentProps` would miss columns the caller
    // omitted at insert (e.g. nullable timestamps like `archivedAt`) — a
    // later `instance.update({ archivedAt: new Date() })` would store the
    // value but `instance.archivedAt` would still read `undefined` until
    // re-fetched. Falling back to `persistentProps` keeps the previous
    // behaviour for any Model built without a schema column list.
    const installed = new Set<string>();
    const schemaCols = model.schemaColumnNames ?? [];
    for (const key of schemaCols) {
      installed.add(key);
      Object.defineProperty(this, key, {
        get: () => this.attributes[key],
        set: (value) => this.assign({ [key]: value }),
        configurable: true,
      });
    }
    for (const key in this.persistentProps) {
      if (installed.has(key)) continue;
      Object.defineProperty(this, key, {
        get: () => this.attributes[key],
        set: (value) => this.assign({ [key]: value }),
        configurable: true,
      });
    }

    // Keys are configurable so they can re-define a same-named property
    // installed by the persistentProps loop above (e.g. when the caller
    // passes an explicit primary value through `init`). The descriptor is
    // intentionally setter-less — assignments to a key field flow through
    // `assign({...})` via the persistentProps getter chain, not by
    // overwriting the descriptor here.
    for (const key in model.keys) {
      Object.defineProperty(this, key, {
        get: () => (this.keys ? this.keys[key] : undefined),
        configurable: true,
      });
    }

    const initCallbacks = (model.callbacks as any).afterInitialize as Callback<any>[] | undefined;
    if (initCallbacks) {
      for (const cb of initCallbacks) {
        const result = cb(this);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(() => {
            /* afterInitialize callbacks should be sync — async returns are fire-and-forget */
          });
        }
      }
    }

    for (const column in model.storeAccessors) {
      const subKeys = model.storeAccessors[column];
      for (const subKey of subKeys) {
        if (Object.getOwnPropertyDescriptor(this, subKey)) continue;
        Object.defineProperty(this, subKey, {
          get: () => {
            const bag = (this.attributes as Dict<any>)[column];
            return bag != null ? bag[subKey] : undefined;
          },
          set: (value) => {
            const current = ((this.attributes as Dict<any>)[column] ?? {}) as Dict<any>;
            this.assign({ [column]: { ...current, [subKey]: value } });
          },
        });
      }
    }

    if (model.associations) {
      for (const name in model.associations) {
        if (Object.getOwnPropertyDescriptor(this, name)) continue;
        // Class-defined getters live on the prototype, not on `this`. Skip
        // auto-defining the property when the prototype chain already exposes
        // a descriptor for this name — the class author opted into custom
        // accessor logic and the auto-accessor would otherwise shadow it.
        if (hasPrototypeProperty(this, name)) continue;
        const spec = model.associations[name];
        let cached: unknown;
        let hasCached = false;
        Object.defineProperty(this, name, {
          get: () => {
            if (hasCached) return cached;
            return resolveAutoAssociation(this, spec);
          },
          set: (value: unknown) => {
            cached = value;
            hasCached = true;
          },
          enumerable: true,
          configurable: true,
        });
      }
    }
  }

  isPersistent() {
    return this.keys !== undefined;
  }

  isNew() {
    return this.keys === undefined;
  }

  get attributes(): Dict<any> {
    return { ...this.persistentProps, ...this.changedProps, ...this.keys };
  }

  toJSON(): Dict<any> {
    return this.attributes;
  }

  pick(keys: string[]): Dict<any> {
    const attrs = this.attributes;
    const result: Dict<any> = {};
    for (const key of keys) {
      if (key in attrs) result[key] = attrs[key];
    }
    return result;
  }

  omit(keys: string[]): Dict<any> {
    const attrs = this.attributes;
    const skip = new Set(keys);
    const result: Dict<any> = {};
    for (const key in attrs) {
      if (!skip.has(key)) result[key] = attrs[key];
    }
    return result;
  }

  assign<M extends ModelClass>(this: M, props: Dict<any>) {
    const model = this.constructor as typeof ModelClass;
    const normalizers = model.normalizers;
    for (const key in props) {
      const value = normalizers[key] ? normalizers[key](props[key]) : props[key];
      if (this.persistentProps[key] !== value) {
        this.changedProps[key] = value;
      } else {
        delete this.changedProps[key];
      }
    }
    return this as M;
  }

  isChanged(): boolean {
    return Object.keys(this.changedProps).length > 0;
  }

  isChangedBy(key: string): boolean {
    return key in this.changedProps;
  }

  changes(): Dict<{ from: any; to: any }> {
    const result: Dict<{ from: any; to: any }> = {};
    for (const key in this.changedProps) {
      result[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
    }
    return result;
  }

  changeBy(key: string): { from: any; to: any } | undefined {
    if (!(key in this.changedProps)) return undefined;
    return { from: this.persistentProps[key], to: this.changedProps[key] };
  }

  was(key: string): any {
    if (key in this.changedProps) return this.persistentProps[key];
    return this.attributes[key];
  }

  savedChanges(): Dict<{ from: any; to: any }> {
    return { ...this.lastSavedChanges };
  }

  savedChangeBy(key: string): { from: any; to: any } | undefined {
    return this.lastSavedChanges[key];
  }

  savedWas(key: string): any {
    if (key in this.lastSavedChanges) return this.lastSavedChanges[key].from;
    return this.attributes[key];
  }

  wasChanged(): boolean {
    return Object.keys(this.lastSavedChanges).length > 0;
  }

  wasChangedBy(key: string): boolean {
    return key in this.lastSavedChanges;
  }

  revertChange<M extends ModelClass>(this: M, key: string) {
    delete this.changedProps[key];
    return this as M;
  }

  revertChanges<M extends ModelClass>(this: M) {
    this.changedProps = {};
    return this as M;
  }

  itemScope(): Scope {
    const model = this.constructor as typeof ModelClass;
    return {
      tableName: model.tableName,
      filter: this.keys,
      limit: 1,
      skip: 0,
      order: [],
    };
  }

  /**
   * Manual belongsTo association — for user code that explicitly defines an
   * accessor like `author() { return this.belongsTo(User); }`. Returns a
   * chainable InstanceQuery (PromiseLike) so `await this.belongsTo(...)` works
   * but the result also supports further chaining (`.pluck(...)` etc.). When
   * the foreign-key value is null/undefined or polymorphic-type mismatches,
   * returns a `none()`-scoped InstanceQuery that resolves to `undefined`.
   */
  belongsTo<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): InstanceQuery<InstanceType<Related> | undefined> {
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(Related.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(Related.keys)[0] ?? 'id';
    const attrs = this.attributes as Dict<any>;
    const fkValue = attrs[fk];
    if (fkValue === undefined || fkValue === null) {
      return Related.none().findBy({ [pk]: null } as Filter<any>) as unknown as InstanceQuery<
        InstanceType<Related> | undefined
      >;
    }
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      const expectedType = options.typeValue ?? Related.tableName;
      if (attrs[typeKey] !== expectedType) {
        return Related.none().findBy({ [pk]: null } as Filter<any>) as unknown as InstanceQuery<
          InstanceType<Related> | undefined
        >;
      }
    }
    return Related.findBy({ [pk]: fkValue }) as unknown as InstanceQuery<
      InstanceType<Related> | undefined
    >;
  }

  /**
   * Manual hasMany association — for user code that explicitly defines an
   * accessor like `posts() { return this.hasMany(Post); }`. Returns a
   * chainable scope so `(await this.posts()).map(...)` works and further
   * chaining (`.where(...)`, `.pluck(...)`) is available.
   */
  hasMany<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Related {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.filterBy(filter) as Related;
  }

  /**
   * Manual hasOne association — for user code that explicitly defines an
   * accessor like `profile() { return this.hasOne(Profile); }`. Returns a
   * chainable InstanceQuery (PromiseLike); resolves to `undefined` when no
   * matching row exists or when the parent record is unsaved.
   */
  hasOne<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): InstanceQuery<InstanceType<Related> | undefined> {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    if (pkValue === undefined || pkValue === null) {
      return Related.none().findBy({ [fk]: null } as Filter<any>) as unknown as InstanceQuery<
        InstanceType<Related> | undefined
      >;
    }
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.findBy(filter) as unknown as InstanceQuery<InstanceType<Related> | undefined>;
  }

  hasManyThrough<Target extends typeof ModelClass, Through extends typeof ModelClass>(
    this: ModelClass,
    Target: Target,
    Through: Through,
    options: HasManyThroughOptions = {},
  ): Target {
    const selfModel = this.constructor as typeof ModelClass;
    const throughFk = options.throughForeignKey ?? `${singularize(selfModel.tableName)}Id`;
    const targetFk = options.targetForeignKey ?? `${singularize(Target.tableName)}Id`;
    const selfPk = options.selfPrimaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const targetPk = options.targetPrimaryKey ?? Object.keys(Target.keys)[0] ?? 'id';
    const selfPkValue = (this as any)[selfPk];
    const asyncPending = (async () => {
      const ids = await Through.filterBy({ [throughFk]: selfPkValue }).pluck(targetFk);
      return { $in: { [targetPk]: ids } } as Filter<any>;
    })();
    return Target.filterBy({ $async: asyncPending } as Filter<any>) as Target;
  }

  async increment<M extends ModelClass>(this: M, key: string, by = 1) {
    if (!this.keys) {
      throw new PersistenceError('Cannot increment a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const updatedCol = model.updatedAtColumn;
    const now = new Date();
    const set: Dict<any> | undefined = updatedCol ? { [updatedCol]: now } : undefined;
    const affected = await model.connector.deltaUpdate({
      tableName: model.tableName,
      filter: this.keys,
      deltas: [{ column: key, by }],
      set,
    });
    if (affected === 0) throw new NotFoundError('Item not found');
    const before = Number((this.persistentProps as Dict<any>)[key] ?? 0);
    const after = before + by;
    const snapshot: Dict<{ from: unknown; to: unknown }> = {
      [key]: { from: before, to: after },
    };
    (this.persistentProps as Dict<any>)[key] = after;
    if (updatedCol) {
      snapshot[updatedCol] = {
        from: (this.persistentProps as Dict<any>)[updatedCol],
        to: now,
      };
      (this.persistentProps as Dict<any>)[updatedCol] = now;
    }
    delete (this.changedProps as Dict<any>)[key];
    this.lastSavedChanges = snapshot;
    await this.runCallbacks('afterUpdate');
    await this._scheduleCommitCallbacks('update');
    return this as M;
  }

  async decrement<M extends ModelClass>(this: M, key: string, by = 1) {
    return this.increment(key, -by);
  }

  async isValid(): Promise<boolean> {
    const model = this.constructor as typeof ModelClass;
    this.errors.clear();
    await this.runCallbacks('beforeValidation');
    let valid = true;
    for (const validator of model.validators) {
      const result = await validator(this);
      if (!result) valid = false;
    }
    await this.runCallbacks('afterValidation');
    return valid;
  }

  async runCallbacks(kind: keyof Callbacks<any>): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    const callbacks = (model.callbacks as any)[kind] as Callback<any>[] | undefined;
    if (!callbacks) return;
    for (const callback of callbacks) {
      await callback(this);
    }
  }

  async runAround(kind: keyof Callbacks<any>, body: () => Promise<void>): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    const handlers = (model.callbacks as any)[kind] as AroundCallback<any>[] | undefined;
    if (!handlers || handlers.length === 0) {
      await body();
      return;
    }
    let i = -1;
    const dispatch = async (): Promise<void> => {
      i += 1;
      if (i < handlers.length) {
        await handlers[i](this, dispatch);
      } else {
        await body();
      }
    };
    await dispatch();
  }

  async save<M extends ModelClass>(this: M) {
    if (!(await this.isValid())) {
      throw new ValidationError('Validation failed', this.errors.toJSON());
    }
    const now = new Date();
    const isInsert = !this.keys;

    const body = async () => {
      await this._saveCore(now, isInsert);
    };
    await this.runAround('aroundSave', async () => {
      await this.runAround(isInsert ? 'aroundCreate' : 'aroundUpdate', body);
    });
    return this as M;
  }

  async _saveCore(now: Date, isInsert: boolean): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    await this.runCallbacks('beforeSave');
    await this.runCallbacks(isInsert ? 'beforeCreate' : 'beforeUpdate');

    const snapshot: Dict<{ from: any; to: any }> = {};

    if (this.keys) {
      const changedKeys = Object.keys(this.changedProps);
      if (changedKeys.length > 0) {
        if (model.updatedAtColumn) {
          this.changedProps[model.updatedAtColumn] = now;
        }
        let scope = this.itemScope();
        const lockColumn = model.lockVersionColumn;
        let expectedLock: number | undefined;
        if (lockColumn) {
          expectedLock = (this.attributes as Dict<any>)[lockColumn] ?? 0;
          scope = { ...scope, filter: { ...scope.filter, [lockColumn]: expectedLock } };
          this.changedProps[lockColumn] = (expectedLock as number) + 1;
        }
        for (const key in this.changedProps) {
          snapshot[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
        }
        const items = await model.connector.updateAll(scope, this.changedProps);
        const item = items.pop();
        if (item) {
          for (const key in model.keys) {
            this.keys[key] = item[key];
            delete item[key];
          }
          this.persistentProps = item;
          this.changedProps = {};
        } else if (lockColumn) {
          throw new StaleObjectError(
            `Stale ${model.name || 'record'} (${lockColumn} expected ${expectedLock})`,
          );
        } else {
          throw new NotFoundError('Item not found');
        }
      }
    } else {
      const insertProps = { ...this.persistentProps, ...this.changedProps };
      if (model.createdAtColumn && insertProps[model.createdAtColumn] === undefined) {
        insertProps[model.createdAtColumn] = now;
      }
      if (model.updatedAtColumn && insertProps[model.updatedAtColumn] === undefined) {
        insertProps[model.updatedAtColumn] = now;
      }
      if (model.lockVersionColumn && insertProps[model.lockVersionColumn] === undefined) {
        insertProps[model.lockVersionColumn] = 0;
      }
      if (model.inheritColumn && model.inheritType !== undefined) {
        insertProps[model.inheritColumn] = model.inheritType;
      }
      for (const column in model.secureTokenColumns) {
        const current = insertProps[column];
        if (current === undefined || current === null || current === '') {
          insertProps[column] = generateSecureToken(model.secureTokenColumns[column].length);
        }
      }
      const items = await model.connector.batchInsert(model.tableName, model.keys, [insertProps]);
      const item = items.pop();
      if (item) {
        this.keys = {};
        for (const key in model.keys) {
          this.keys[key] = item[key];
          delete item[key];
        }
        for (const key in item) {
          snapshot[key] = { from: undefined, to: item[key] };
        }
        for (const key in this.keys) {
          snapshot[key] = { from: undefined, to: this.keys[key] };
        }
        this.persistentProps = item;
        this.changedProps = {};
      } else {
        throw new PersistenceError('Failed to insert item');
      }
    }

    this.lastSavedChanges = snapshot;

    await this.runCallbacks(isInsert ? 'afterCreate' : 'afterUpdate');
    await this.runCallbacks('afterSave');

    await this._scheduleCommitCallbacks(isInsert ? 'create' : 'update');
  }

  async _scheduleCommitCallbacks(kind: 'create' | 'update' | 'delete'): Promise<void> {
    const commitEvent = (
      kind === 'create'
        ? 'afterCreateCommit'
        : kind === 'update'
          ? 'afterUpdateCommit'
          : 'afterDeleteCommit'
    ) as keyof Callbacks<any>;
    const rollbackEvent = (
      kind === 'create'
        ? 'afterCreateRollback'
        : kind === 'update'
          ? 'afterUpdateRollback'
          : 'afterDeleteRollback'
    ) as keyof Callbacks<any>;
    const ctx = activeTransaction();
    if (ctx) {
      ctx.afterCommit.push(async () => {
        await this.runCallbacks(commitEvent);
        await this.runCallbacks('afterCommit');
      });
      ctx.afterRollback.push(async () => {
        await this.runCallbacks(rollbackEvent);
        await this.runCallbacks('afterRollback');
      });
    } else {
      await this.runCallbacks(commitEvent);
      await this.runCallbacks('afterCommit');
    }
  }

  async update<M extends ModelClass>(this: M, attrs: Dict<any>) {
    this.assign(attrs);
    return this.save();
  }

  async touch<M extends ModelClass>(
    this: M,
    options: { time?: Date; columns?: string[] } = {},
  ): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot touch a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const updatedCol = model.updatedAtColumn;
    const columns = options.columns ? options.columns : updatedCol ? [updatedCol] : [];
    if (columns.length === 0) {
      throw new PersistenceError(
        'Cannot touch a record whose Model has no updatedAt column (and no `columns` were provided)',
      );
    }
    const time = options.time ?? new Date();
    const update: Dict<any> = {};
    for (const column of columns) update[column] = time;
    const items = await model.connector.updateAll(this.itemScope(), update);
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
    return this as M;
  }

  async reload<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot reload a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const items = await model.connector.query(this.itemScope());
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
    return this as M;
  }

  /**
   * Run cascade declarations for this record's parent before its own delete.
   * `restrict` throws if any matching child exists; `destroy` calls `.delete()`
   * on each child (recursively cascading); `deleteAll` is a bulk delete that
   * skips child callbacks; `nullify` updates the foreign-key column to null.
   */
  async _runCascade(): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    const map = model.cascadeMap;
    if (!map) return;
    for (const name in map) {
      const spec = map[name];
      const target = (
        'hasMany' in spec
          ? typeof spec.hasMany === 'function' && !(spec.hasMany as any).tableName
            ? (spec.hasMany as () => typeof ModelClass)()
            : (spec.hasMany as typeof ModelClass)
          : typeof spec.hasOne === 'function' && !(spec.hasOne as any).tableName
            ? (spec.hasOne as () => typeof ModelClass)()
            : (spec.hasOne as typeof ModelClass)
      ) as typeof ModelClass;
      const fk = spec.foreignKey;
      const pkName = spec.primaryKey ?? Object.keys(model.keys)[0] ?? 'id';
      const pkValue = (this.attributes as Dict<any>)[pkName];
      if (pkValue === undefined || pkValue === null) continue;
      const childScope = target.filterBy({ [fk]: pkValue } as Filter<any>);
      switch (spec.dependent) {
        case 'restrict': {
          const count = await childScope.count();
          if (count > 0) {
            throw new PersistenceError(
              `Cannot delete ${model.name || 'record'}: '${name}' association has ${count} child row(s) (cascade='restrict')`,
            );
          }
          break;
        }
        case 'destroy': {
          const children = await childScope.all();
          for (const child of children) {
            await (child as any).delete();
          }
          break;
        }
        case 'deleteAll': {
          await childScope.deleteAll();
          break;
        }
        case 'nullify': {
          await childScope.updateAll({ [fk]: null } as Dict<any>);
          break;
        }
      }
    }
  }

  async delete<M extends ModelClass>(
    this: M,
    options: { skipCallbacks?: boolean } = {},
  ): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot delete a record that has not been saved');
    }
    const body = async () => {
      await this._deleteCore(options);
    };
    await this.runAround('aroundDelete', body);
    return this as M;
  }

  async _deleteCore(options: { skipCallbacks?: boolean } = {}): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    if (!options.skipCallbacks) await this.runCallbacks('beforeDelete');
    await this._runCascade();
    let scope = this.itemScope();
    const lockColumn = model.lockVersionColumn;
    let expectedLock: number | undefined;
    if (lockColumn) {
      expectedLock = (this.attributes as Dict<any>)[lockColumn] ?? 0;
      scope = { ...scope, filter: { ...scope.filter, [lockColumn]: expectedLock } };
    }
    const items = await model.connector.deleteAll(scope);
    if (items.length === 0) {
      if (lockColumn) {
        throw new StaleObjectError(
          `Stale ${model.name || 'record'} (${lockColumn} expected ${expectedLock})`,
        );
      }
      throw new NotFoundError('Item not found');
    }
    this.persistentProps = { ...this.persistentProps, ...this.changedProps, ...this.keys };
    this.changedProps = {};
    this.keys = undefined;
    if (!options.skipCallbacks) await this.runCallbacks('afterDelete');
    await this._scheduleCommitCallbacks('delete');
  }

  isDiscarded(): boolean {
    const model = this.constructor as typeof ModelClass;
    const value = (this.attributes as Dict<any>)[model.softDeleteColumn];
    return value !== null && value !== undefined;
  }

  async discard<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot discard a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    (this as ModelClass).assign({ [model.softDeleteColumn]: new Date() } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }

  async restore<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot restore a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    (this as ModelClass).assign({ [model.softDeleteColumn]: null } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }
}

/**
 * Returns true when any prototype in `obj`'s chain (excluding Object.prototype
 * itself) owns a property descriptor for `name`. Used to detect class-defined
 * getters so the constructor's auto-association installer can skip them and let
 * the user's custom accessor run instead.
 */
function hasPrototypeProperty(obj: object, name: string): boolean {
  let proto: object | null = Object.getPrototypeOf(obj);
  while (proto && proto !== Object.prototype) {
    if (Object.getOwnPropertyDescriptor(proto, name)) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

/**
 * Translate a schema-level `tableDefinition.associations` map (target-table
 * strings) into the runtime `AssociationsMap` shape (target-class refs) the
 * factory consumes. The runtime stores the *table* metadata, not the Model
 * class — `resolveAssociationTarget` reads `target.tableName` and
 * `target.keys` only, so we hand it a minimal table-shaped shim until the
 * user's Model class registers itself.
 *
 * Each call site is invoked lazily by `resolveAssociationTarget` via a
 * `() => target` thunk, so the user's Model classes for sibling tables
 * don't have to be defined yet when `Model({ schema, tableName })` runs
 * for any single table.
 */
function schemaAssociationsToRuntime(
  selfDef: TableDefinition,
  allDefs: { [name: string]: TableDefinition },
): AssociationsMap | undefined {
  const raw = selfDef.associations as Record<string, TypedAssociation> | undefined;
  if (!raw) return undefined;
  const result: AssociationsMap = {};
  for (const [name, spec] of Object.entries(raw)) {
    const targetTable =
      'belongsTo' in spec
        ? spec.belongsTo
        : 'hasMany' in spec
          ? spec.hasMany
          : 'hasOne' in spec
            ? spec.hasOne
            : spec.hasManyThrough;
    const targetDef = allDefs[targetTable];
    if (!targetDef) {
      throw new Error(
        `Model(): association '${name}' on '${selfDef.name}' references unknown table '${targetTable}'. Known: ${Object.keys(
          allDefs,
        ).join(', ')}`,
      );
    }
    const targetThunk = () => tableDefinitionAsModelShim(targetDef);
    if ('belongsTo' in spec) {
      result[name] = {
        belongsTo: targetThunk as any,
        foreignKey: spec.foreignKey,
        primaryKey: spec.primaryKey,
        polymorphic: spec.polymorphic,
        typeKey: spec.typeKey,
        typeValue: spec.typeValue,
      };
    } else if ('hasMany' in spec) {
      result[name] = {
        hasMany: targetThunk as any,
        foreignKey: spec.foreignKey,
        primaryKey: spec.primaryKey,
        polymorphic: spec.polymorphic,
        typeKey: spec.typeKey,
        typeValue: spec.typeValue,
      };
    } else if ('hasOne' in spec) {
      result[name] = {
        hasOne: targetThunk as any,
        foreignKey: spec.foreignKey,
        primaryKey: spec.primaryKey,
        polymorphic: spec.polymorphic,
        typeKey: spec.typeKey,
        typeValue: spec.typeValue,
      };
    } else {
      const throughTable = spec.through;
      const throughDef = allDefs[throughTable];
      if (!throughDef) {
        throw new Error(
          `Model(): hasManyThrough association '${name}' on '${selfDef.name}' references unknown through table '${throughTable}'. Known: ${Object.keys(allDefs).join(', ')}`,
        );
      }
      result[name] = {
        hasManyThrough: targetThunk as any,
        through: (() => tableDefinitionAsModelShim(throughDef)) as any,
        throughForeignKey: spec.throughForeignKey,
        targetForeignKey: spec.targetForeignKey,
        selfPrimaryKey: spec.selfPrimaryKey,
        targetPrimaryKey: spec.targetPrimaryKey,
      };
    }
  }
  return result;
}

/**
 * Build an `init` function from a schema's `TableDefinition`. The returned
 * function applies each column's static `default` to the in-memory record
 * when the caller did not supply that key, leaving caller-supplied values
 * untouched. `'currentTimestamp'` defaults are evaluated at call time —
 * each `build()` gets a fresh `Date`. Auto-increment primary keys are
 * skipped (the connector assigns them).
 */
function buildSchemaInit(
  tableDef: TableDefinition,
): (props: Record<string, unknown>) => Record<string, unknown> {
  return (props) => {
    const out: Record<string, unknown> = { ...props };
    for (const col of tableDef.columns) {
      if (col.primary && col.autoIncrement) continue;
      if (out[col.name] !== undefined) continue;
      if (col.default === undefined) continue;
      if (col.default === 'currentTimestamp') {
        out[col.name] = new Date();
      } else {
        out[col.name] = col.default;
      }
    }
    return out;
  };
}

/**
 * Build a minimal Model-shaped object from a `TableDefinition`. The runtime
 * association resolver (`resolveAssociationTarget`) reads only `tableName`
 * and `keys` from the target. After the user's Model class registers itself
 * via `ModelClass.tableRegistry`, every lookup returns that class. Until
 * registration, the fallback shim provides just enough surface for the
 * resolver to compute query keys.
 *
 * **Shim limitations:** the fallback is missing `connector`, `defaultScope`,
 * and other Model state. If a thunk fires before the user's sibling Model
 * class is constructed (e.g. `await user.tasks.all()` is called before the
 * `class Task extends Model(...)` declaration runs), `CollectionQuery`
 * will throw a confusing `connector is undefined` error at materialise
 * time. In practice every association access happens after both Model
 * classes are declared, so the shim is never the materialise target.
 */
function tableDefinitionAsModelShim(def: TableDefinition): typeof ModelClass {
  const registered = ModelClass.tableRegistry.get(def.name);
  if (registered) return registered;
  return {
    tableName: def.name,
    keys: deriveKeysFromTableDefinition(def),
  } as unknown as typeof ModelClass;
}

/**
 * Connector-attached schema overload — pass a `Connector<DatabaseSchema>`
 * (a connector instance constructed with `{ schema }`) and a `tableName`.
 * TypeScript walks the connector's attached schema's `tables[tableName]` and
 * derives the Model's prop shape and key types from the column map. `init`
 * defaults to identity; `keys` is derived from the schema's primary columns.
 */
export function Model<
  Conn extends Connector<DatabaseSchema<any>>,
  K extends keyof NonNullable<Conn['schema']>['tables'] & string,
  Keys extends Dict<KeyType> = SchemaKeys<NonNullable<Conn['schema']>, K>,
  Scopes extends ScopeMap = {},
>(props: {
  connector: Conn;
  tableName: K;
  /**
   * Optional row-shape transformer. Defaults to identity — the props passed
   * to `create` / `build` flow straight through to the connector.
   */
  init?: (props: SchemaCreateProps<NonNullable<Conn['schema']>, K>) => Schema;
  filter?: Filter<
    SchemaProps<NonNullable<Conn['schema']>, K> & {
      [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }
  >;
  defaultScope?: Filter<
    SchemaProps<NonNullable<Conn['schema']>, K> & {
      [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }
  >;
  limit?: number;
  skip?: number;
  order?: Order<
    SchemaProps<NonNullable<Conn['schema']>, K> & {
      [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }
  >;
  /** Override the keys map derived from the schema's primary columns. */
  keys?: Keys;
  timestamps?: boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };
  softDelete?: boolean | string | { column?: string };
  lockVersion?: boolean | string;
  validators?: Validator<
    SchemaProps<NonNullable<Conn['schema']>, K> & {
      [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }
  >[];
  callbacks?: Callbacks<
    SchemaProps<NonNullable<Conn['schema']>, K> & {
      [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number;
    }
  >;
  scopes?: Scopes;
  enums?: Dict<readonly string[]>;
  inheritColumn?: string;
  storeAccessors?: Dict<readonly string[]>;
  cascade?: CascadeMap;
  normalizes?: Dict<(value: any) => any>;
  secureTokens?: string[] | Dict<{ length?: number }>;
  counterCaches?: CounterCacheSpec[];
}): SchemaModelClass<
  SchemaCreateProps<NonNullable<Conn['schema']>, K>,
  SchemaProps<NonNullable<Conn['schema']>, K>,
  Keys,
  Scopes,
  SchemaAssociations<NonNullable<Conn['schema']>, K>
>;

export function Model(props: any): any {
  // Schema-driven path: look up the schema attached to the connector.
  let resolvedSchema: DatabaseSchema | undefined;
  if (
    props.connector &&
    typeof props.connector === 'object' &&
    'schema' in props.connector &&
    props.connector.schema
  ) {
    resolvedSchema = props.connector.schema as DatabaseSchema;
  }

  if (!resolvedSchema) {
    throw new Error(
      'Model() requires a connector with an attached schema. ' +
        'Pass `connector` constructed with `{ schema }` (e.g. `new MemoryConnector({}, { schema })`). ' +
        'The legacy `Model({ tableName, init, keys })` overload was removed.',
    );
  }

  const tableName = props.tableName as string;
  const tableDefinition = resolvedSchema.tableDefinitions[tableName];
  if (!tableDefinition) {
    throw new Error(
      `Model(): tableName '${tableName}' is not declared on the attached schema. Known tables: ${Object.keys(
        resolvedSchema.tableDefinitions,
      ).join(', ')}`,
    );
  }
  const keys: Dict<KeyType> = props.keys ?? deriveKeysFromTableDefinition(tableDefinition);
  // Caller-supplied `init` replaces the schema default builder entirely — there
  // is no composition. If schema defaults need to apply alongside a custom
  // transform, the caller should re-derive them inside their `init`.
  const init = props.init ?? buildSchemaInit(tableDefinition);
  const associations = schemaAssociationsToRuntime(
    tableDefinition,
    resolvedSchema.tableDefinitions,
  );
  const schemaColumnNames = tableDefinition.columns.map((c) => c.name);
  // When the caller does not pass `timestamps` explicitly, peek at the
  // schema to infer a safe default. Writing `createdAt` / `updatedAt`
  // on insert against a table that does not declare those columns
  // surfaces as `SqliteError: table X has no column named createdAt` —
  // forcing users to remember `timestamps: false` for plumbing tables
  // (sessions, ad-hoc lookups, ...). Inference:
  //   - both columns present → keep current default (enable both)
  //   - only `createdAt` → behave as `{ updatedAt: false }`
  //   - only `updatedAt` → behave as `{ createdAt: false }`
  //   - neither column   → behave as `timestamps: false`
  // Explicit `timestamps:` (any value, including `false` / partial object)
  // always wins — no inference, no warning.
  const resolvedTimestamps =
    props.timestamps === undefined
      ? inferTimestampsFromSchema(schemaColumnNames)
      : props.timestamps;
  const result = modelFactoryImpl({
    ...props,
    timestamps: resolvedTimestamps,
    tableName,
    keys,
    init,
    associations,
    schemaColumnNames,
  });
  ModelClass.tableRegistry.set(tableName, result as unknown as typeof ModelClass);
  return result;
}

/**
 * Map the schema's declared column set into the inferred default for the
 * Model factory's `timestamps` option. Only consulted when the caller does
 * NOT pass `timestamps:` explicitly.
 */
function inferTimestampsFromSchema(
  columnNames: readonly string[],
): boolean | { createdAt: boolean; updatedAt: boolean } {
  const hasCreated = columnNames.includes('createdAt');
  const hasUpdated = columnNames.includes('updatedAt');
  if (hasCreated && hasUpdated) return true;
  if (!hasCreated && !hasUpdated) return false;
  return { createdAt: hasCreated, updatedAt: hasUpdated };
}

function modelFactoryImpl<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number },
  Scopes extends ScopeMap = {},
>(props: {
  tableName: string;
  init: (props: CreateProps) => PersistentProps;
  filter?: Filter<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  defaultScope?: Filter<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  limit?: number;
  skip?: number;
  order?: Order<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  connector?: Connector<any>;
  keys?: Keys;
  timestamps?: boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };
  softDelete?: boolean | string | { column?: string };
  lockVersion?: boolean | string;
  validators?: Validator<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >[];
  callbacks?: Callbacks<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  scopes?: Scopes;
  enums?: Dict<readonly string[]>;
  inheritColumn?: string;
  storeAccessors?: Dict<readonly string[]>;
  cascade?: CascadeMap;
  normalizes?: Dict<(value: any) => any>;
  secureTokens?: string[] | Dict<{ length?: number }>;
  counterCaches?: CounterCacheSpec[];
  associations?: AssociationsMap;
  /**
   * Column names declared on the schema's `tableDefinition` for this model.
   * The instance constructor uses this list to pre-install property getters
   * for every declared column — including those that are absent at insert
   * time (nullable columns, defaults supplied at insert by the DB, ...) —
   * so a subsequent `update({ col: value })` makes `instance.col` readable
   * without a re-fetch. Optional so the legacy non-schema-driven Model
   * factory path stays compilable.
   */
  schemaColumnNames?: string[];
}) {
  const connector = props.connector ? props.connector : new MemoryConnector();
  const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
  const keyDefinitions = props.keys || { id: KeyType.number };
  const { createdAtColumn, updatedAtColumn } = resolveTimestampColumns(props.timestamps);
  const { softDeleteMode, softDeleteColumn } = resolveSoftDelete(props.softDelete);
  const enumDefs = props.enums || {};
  const builtInValidators: Validator<any>[] = [];
  if (Object.keys(enumDefs).length > 0) {
    builtInValidators.push((record) => {
      const attrs = record.attributes as Dict<any>;
      for (const column in enumDefs) {
        const value = attrs[column];
        if (value === undefined || value === null) continue;
        if (!enumDefs[column].includes(value)) return false;
      }
      return true;
    });
  }
  const validators = [...(props.validators || []), ...builtInValidators];
  const lockVersionColumn =
    props.lockVersion === true
      ? 'lockVersion'
      : typeof props.lockVersion === 'string'
        ? props.lockVersion
        : undefined;
  const callbacks = props.callbacks || {};
  const scopeDefs = props.scopes || ({} as Scopes);
  const associationDefs = (props.associations ?? {}) as AssociationsMap;
  // Factory-time collision detection for association names. Anything that
  // would resolve to the same instance property is a hard error so the
  // user finds out at construction time (matching the existing `enums` /
  // `storeAccessors` collision policy) rather than at first record fetch.
  for (const name of Object.keys(associationDefs)) {
    if (name === 'constructor' || name === '__proto__') {
      throw new Error(`Association name '${name}' is reserved`);
    }
    if (name in keyDefinitions) {
      throw new Error(
        `Association '${name}' collides with a primary key column declared on Model.keys`,
      );
    }
    if (name in (props.storeAccessors ?? {})) {
      throw new Error(
        `Association '${name}' collides with a JSON column declared on Model.storeAccessors`,
      );
    }
    for (const column in props.storeAccessors ?? {}) {
      const subKeys = (props.storeAccessors as Dict<readonly string[]>)[column];
      if (subKeys.includes(name)) {
        throw new Error(
          `Association '${name}' collides with a storeAccessors sub-key on column '${column}'`,
        );
      }
    }
    for (const column in enumDefs) {
      for (const value of enumDefs[column]) {
        if (`is${pascalize(value)}` === name) {
          throw new Error(
            `Association '${name}' collides with the enum predicate generated from value '${value}' on column '${column}'`,
          );
        }
      }
    }
    if (name in ModelClass.prototype) {
      throw new Error(
        `Association '${name}' collides with the built-in instance method '${name}' on Model`,
      );
    }
  }

  const ModelSubclass = class Model extends ModelClass {
    static tableName = props.tableName;
    static schemaColumnNames: readonly string[] = props.schemaColumnNames ?? [];
    static filter = props.filter;
    static defaultScope = props.defaultScope;
    static limit = props.limit;
    static skip = props.skip;
    static order = order;
    static keys = keyDefinitions;
    static connector = connector;
    static init = props.init as any;
    static createdAtColumn = createdAtColumn;
    static updatedAtColumn = updatedAtColumn;
    static softDelete = softDeleteMode;
    static softDeleteColumn = softDeleteColumn;
    static enums = enumDefs;
    static lockVersionColumn = lockVersionColumn;
    static inheritColumn = props.inheritColumn;
    static inheritRegistry: Map<string, typeof ModelClass> | undefined = props.inheritColumn
      ? new Map<string, typeof ModelClass>()
      : undefined;
    static storeAccessors = props.storeAccessors ?? {};
    static cascadeMap = props.cascade;
    static normalizers = (props.normalizes ?? {}) as Dict<(value: any) => any>;
    static secureTokenColumns = (() => {
      const tokens = props.secureTokens;
      if (!tokens) return {};
      if (Array.isArray(tokens)) {
        const map: Dict<{ length: number }> = {};
        for (const col of tokens) map[col] = { length: 24 };
        return map;
      }
      const map: Dict<{ length: number }> = {};
      for (const col in tokens) map[col] = { length: tokens[col].length ?? 24 };
      return map;
    })();
    static validators = validators as Validator<any>[];
    static callbacks = callbacks as Callbacks<any>;
    static associations: AssociationsMap | undefined =
      Object.keys(associationDefs).length > 0 ? associationDefs : undefined;

    static orderBy<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orderBy(order) as M;
    }

    static withOrder<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.withOrder(order) as M;
    }

    /**
     * @deprecated Use {@link ModelClass.withOrder | withOrder} instead.
     */
    static reorder<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.reorder(order) as M;
    }

    static filterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.filterBy(filter) as M;
    }

    static orFilterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orFilterBy(filter) as M;
    }

    static on(
      event: keyof Callbacks<any>,
      handler: Callback<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ): () => void {
      return super.on(event, handler as Callback<any>);
    }

    static select(...keys: Array<keyof Keys | keyof PersistentProps>) {
      return super.select(...(keys as string[])) as Promise<
        Partial<
          PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
        >[]
      >;
    }

    static pluck(...keys: Array<keyof Keys | keyof PersistentProps>) {
      return super.pluck(...(keys as string[]));
    }

    static pluckUnique(key: keyof Keys | keyof PersistentProps) {
      return super.pluckUnique(key as string);
    }

    static ids<M extends typeof ModelClass>(this: M) {
      return super.ids();
    }

    static all<M extends typeof ModelClass>(this: M) {
      return super.all() as unknown as CollectionQuery<
        (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[]
      >;
    }

    static first<M extends typeof ModelClass>(this: M) {
      return super.first() as unknown as InstanceQuery<
        | (InstanceType<M> &
            PersistentProps &
            Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)
        | undefined
      >;
    }

    static last<M extends typeof ModelClass>(this: M) {
      return super.last() as unknown as InstanceQuery<
        | (InstanceType<M> &
            PersistentProps &
            Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)
        | undefined
      >;
    }

    static async *inBatchesOf<M extends typeof ModelClass>(this: M, size: number) {
      for await (const batch of super.inBatchesOf(size)) {
        yield batch as (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
      }
    }

    static async *findEach<M extends typeof ModelClass>(this: M, size?: number) {
      for await (const item of super.findEach(size)) {
        yield item as InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
      }
    }

    static paginate<M extends typeof ModelClass>(this: M, page: number, perPage?: number) {
      return super.paginate(page, perPage) as Promise<{
        items: (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      }>;
    }

    static paginateCursor<M extends typeof ModelClass>(
      this: M,
      options?: { after?: string; before?: string; limit?: number },
    ) {
      return super.paginateCursor(options) as Promise<{
        items: (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
        nextCursor?: string;
        prevCursor?: string;
        hasMore: boolean;
      }>;
    }

    static count<M extends typeof ModelClass>(this: M) {
      return super.count();
    }

    static countBy(key: keyof Keys | keyof PersistentProps) {
      return super.countBy(key as string);
    }

    static async groupBy<M extends typeof ModelClass>(
      this: M,
      key: keyof Keys | keyof PersistentProps,
    ) {
      const result = await super.groupBy(key as string);
      return result as Map<
        any,
        (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[]
      >;
    }

    static async preloadBelongsTo<M extends typeof ModelClass>(
      this: M,
      records: any[],
      options: { foreignKey: string; primaryKey?: keyof Keys & string },
    ) {
      const result = await super.preloadBelongsTo(records, options);
      return result as Map<
        any,
        InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>
      >;
    }

    static async preloadHasMany<M extends typeof ModelClass>(
      this: M,
      records: any[],
      options: { foreignKey: keyof PersistentProps & string; primaryKey?: string },
    ) {
      const result = await super.preloadHasMany(records, options);
      return result as Map<
        any,
        (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[]
      >;
    }

    static sum<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.sum(key as string);
    }

    static min<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.min(key as string);
    }

    static max<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.max(key as string);
    }

    static avg<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.avg(key as string);
    }

    static async deleteAll<M extends typeof ModelClass>(this: M) {
      return (await super.deleteAll()) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static async updateAll<M extends typeof ModelClass>(this: M, attrs: Partial<PersistentProps>) {
      return (await super.updateAll(attrs)) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static findBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.findBy(filter) as unknown as InstanceQuery<
        | (InstanceType<M> &
            PersistentProps &
            Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)
        | undefined
      >;
    }

    static exists<M extends typeof ModelClass>(
      this: M,
      filter?: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.exists(filter);
    }

    static find<M extends typeof ModelClass>(
      this: M,
      id: Keys[keyof Keys] extends KeyType.uuid ? string : number,
    ) {
      return super.find(id as number | string) as unknown as InstanceQuery<
        InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>
      >;
    }

    static findOrNull<M extends typeof ModelClass>(
      this: M,
      id: Keys[keyof Keys] extends KeyType.uuid ? string : number,
    ) {
      return super.findOrNull(id as number | string) as unknown as InstanceQuery<
        | (InstanceType<M> &
            PersistentProps &
            Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)
        | null
      >;
    }

    static findOrFail<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.findOrFail(filter) as unknown as InstanceQuery<
        InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>
      >;
    }

    static async findOrBuild<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: CreateProps,
    ) {
      return (await super.findOrBuild(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async firstOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: Partial<CreateProps> = {},
    ) {
      return (await super.firstOrCreate(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async updateOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      attrs: Partial<PersistentProps>,
    ) {
      return (await super.updateOrCreate(filter, attrs)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static build<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return super.build(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static buildScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return super.buildScoped(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async create<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return (await super.create(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async createScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return (await super.createScoped(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async createMany<M extends typeof ModelClass>(this: M, propsList: CreateProps[]) {
      return (await super.createMany(propsList)) as (InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
    }

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number } | undefined;

    // biome-ignore lint/complexity/noUselessConstructor: narrows parent's Dict<any> params to PersistentProps/Keys
    constructor(
      props: PersistentProps,
      keys?: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number },
    ) {
      super(props, keys);
    }

    get attributes() {
      return {
        ...(this.persistentProps as object),
        ...(this.changedProps as object),
        ...(this.keys as object),
      } as PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
    }

    toJSON() {
      return this.attributes;
    }

    pick<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.pick(keys as string[]) as Pick<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
    }

    omit<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.omit(keys as string[]) as Omit<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
    }

    assign<M extends ModelClass>(this: M, props: Partial<PersistentProps>): M {
      return super.assign(props as Dict<any>) as M;
    }

    isChangedBy(key: keyof PersistentProps): boolean {
      return super.isChangedBy(key as string);
    }

    changeBy<K extends keyof PersistentProps>(
      key: K,
    ): { from: PersistentProps[K]; to: PersistentProps[K] } | undefined {
      return super.changeBy(key as string) as
        | { from: PersistentProps[K]; to: PersistentProps[K] }
        | undefined;
    }

    was<K extends keyof PersistentProps>(key: K): PersistentProps[K] {
      return super.was(key as string) as PersistentProps[K];
    }

    savedWas<K extends keyof PersistentProps>(key: K): PersistentProps[K] {
      return super.savedWas(key as string) as PersistentProps[K];
    }

    revertChange<M extends ModelClass>(this: M, key: keyof PersistentProps): M {
      return super.revertChange(key as string) as M;
    }

    update<M extends ModelClass>(this: M, attrs: Partial<PersistentProps>): Promise<M> {
      return super.update(attrs as Dict<any>) as Promise<M>;
    }
  };

  // Named scopes are either `Filter<any>` literals (no-arg method) or
  // `(...args) => Filter<any>` factories (args-forwarding method). Both
  // call `this.filterBy(...)`. For multi-clause logic declare a static
  // method on the user's subclass instead.
  for (const name in scopeDefs) {
    const def = scopeDefs[name];
    if (typeof def === 'function') {
      (ModelSubclass as any)[name] = function (this: typeof ModelSubclass, ...args: any[]) {
        return this.filterBy((def as (...args: any[]) => Filter<any>)(...args) as any);
      };
    } else {
      (ModelSubclass as any)[name] = function (this: typeof ModelSubclass) {
        return this.filterBy(def as any);
      };
    }
  }

  for (const column in enumDefs) {
    const values = enumDefs[column];
    (ModelSubclass as any)[`${column}Values`] = values;
    for (const value of values) {
      const scopeName = camelize(value);
      const predicateName = `is${pascalize(value)}`;
      if (scopeName in ModelSubclass) {
        throw new Error(
          `Enum value '${value}' for column '${column}' collides with existing static method '${scopeName}' on the Model`,
        );
      }
      if (predicateName in ModelSubclass.prototype) {
        throw new Error(
          `Enum value '${value}' for column '${column}' collides with existing instance method '${predicateName}' on the Model`,
        );
      }
      (ModelSubclass as any)[scopeName] = function (this: typeof ModelSubclass) {
        return this.filterBy({ [column]: value } as any);
      };
      (ModelSubclass.prototype as any)[predicateName] = function (this: ModelClass) {
        return (this.attributes as Dict<any>)[column] === value;
      };
    }
  }

  if (props.counterCaches && props.counterCaches.length > 0) {
    const resolveTarget = (spec: CounterCacheSpec): typeof ModelClass => {
      const ref = spec.belongsTo as any;
      return ref?.tableName ? (ref as typeof ModelClass) : (ref as () => typeof ModelClass)();
    };
    const adjustCounter = async (
      spec: CounterCacheSpec,
      fkValue: unknown,
      delta: number,
    ): Promise<void> => {
      if (fkValue === undefined || fkValue === null) return;
      const target = resolveTarget(spec);
      const pk = spec.primaryKey ?? Object.keys(target.keys)[0] ?? 'id';
      const updatedCol = target.updatedAtColumn;
      await target.connector.deltaUpdate({
        tableName: target.tableName,
        filter: { [pk]: fkValue } as Filter<any>,
        deltas: [{ column: spec.column, by: delta }],
        set: updatedCol ? { [updatedCol]: new Date() } : undefined,
      });
    };
    for (const spec of props.counterCaches) {
      ModelSubclass.on('afterCreate', async (record) => {
        const fkValue = (record.attributes as Dict<any>)[spec.foreignKey];
        await adjustCounter(spec, fkValue, +1);
      });
      ModelSubclass.on('afterDelete', async (record) => {
        const fkValue = (record.attributes as Dict<any>)[spec.foreignKey];
        await adjustCounter(spec, fkValue, -1);
      });
      ModelSubclass.on('afterUpdate', async (record) => {
        const change = record.savedChangeBy(spec.foreignKey);
        if (!change) return;
        await adjustCounter(spec, change.from, -1);
        await adjustCounter(spec, change.to, +1);
      });
    }
  }

  return ModelSubclass as typeof ModelSubclass & ScopesToMethods<typeof ModelSubclass, Scopes>;
}

export default Model;
