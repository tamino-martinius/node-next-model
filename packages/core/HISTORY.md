# History

## vNext

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

### Tooling

- Converted to a pnpm monorepo; `@next-model/core` lives under `packages/core` alongside `knex-connector` and `data-api-connector`.
- Migrated test runner from jest to vitest (now on vitest 4).
- Migrated linter/formatter from prettier + eslint to biome (now on biome 2).
- Replaced Travis CI with GitHub Actions (typecheck + lint + tests on every branch/PR).
- Bumped toolchain to TypeScript 6, `@types/node` 25, and `@vitest/coverage-v8` 4 across every package. Knex connectors moved to knex 3 (from 0.19); the `data-api-client` dependency jumped to 2.x. `lib`/`target` raised to `ES2023` and `structuredClone` is now sourced via `@types/node` globals. Removed the dead `faker` / `@types/faker` / `@types/knex` dev deps (faker was never used; knex bundles its own types since 0.95). `pnpm audit` reports zero vulnerabilities.
- Build modernization: every package is now pure ESM (`"type": "module"`, `exports` field, `.js` extensions on relative imports) built with `module: NodeNext`. Dropped the `tsc-mjs` dual-build. `dist/` is no longer tracked in git and is rebuilt via `pnpm build` / `prepublishOnly`.
- Shared `runModelConformance` test helper (`@next-model/conformance`) gives every connector the same Model-level CRUD/Query/Transactions/Schema-DSL coverage. Wired into MemoryConnector, KnexConnector (sqlite/pg/mysql) and LocalStorageConnector specs. CI now runs `pnpm -r coverage` and each package's vitest config enforces coverage thresholds.
- Schema DSL: `ColumnOptions.autoIncrement` now generates `t.increments(...)` on KnexConnector, so a table created via the DSL works with `KeyType.number` Models out of the box.
- KnexConnector: `deleteAll`/`updateAll` no longer apply `limit`/`skip` to the underlying knex builder, fixing a sqlite "limit has no effect on a delete" error when the Model layer sets `limit: 1` on its single-row scope.
- Repository documentation overhaul: new top-level `README.md`, fully rewritten READMEs for `knex-connector`, `data-api-connector`, `local-storage-connector`, and a new `migrations` README. Each connector README maps every relevant Model feature (filters, transactions, batchInsert, schema DSL, …) to that connector's specifics.
- New `@next-model/redis-connector` package: targets Redis via `node-redis`. Each row is a HASH (column → JSON-encoded value), each table has a ZSET of ids (used for ordered iteration), and table existence is tracked via a `:meta` key. Filters / aggregates are evaluated client-side via core's `filterList`. Transactions snapshot every table at block start and restore on throw (matches the in-memory connector's semantics — not Redis `MULTI/EXEC`). Validated with shared `runModelConformance` against a real Redis 7 service container in CI.
- New `@next-model/mariadb-connector` package: thin extension of `mysql-connector` that exploits MariaDB's `RETURNING *` for `INSERT` (10.5+) and `DELETE` (10.0+) to skip the up-front SELECT capture and the consecutive auto-increment id-expansion that MySQL needs. `updateAll` falls through to the parent (MariaDB has no `UPDATE … RETURNING`). Also emits `LONGTEXT CHECK (JSON_VALID(...))` for `t.json(...)` columns since MariaDB's JSON is an alias for LONGTEXT. Validated against a real MariaDB 11 service container in CI. Required exposing a few `MysqlConnector` internals (`run`, `runMutation`, `buildWhere`, `quoteIdent`) to subclasses — no behavior change.
- New `@next-model/mysql-connector` package: native MySQL connector that uses `mysql2/promise` directly (no Knex dependency). Backtick-quoted identifiers; transactions check out a single pooled connection; `batchInsert` does one bulk `INSERT` and re-fetches via the consecutive-id expansion trick (MySQL has no `RETURNING`); `updateAll`/`deleteAll` capture matching rows up-front via `SELECT`. Schema DSL emits InnoDB tables with utf8mb4. Validated with shared `runModelConformance` against a real MySQL 8 service container in CI.
- New `@next-model/sqlite-connector` package: native SQLite connector that uses `better-sqlite3` directly (no Knex dependency). Wraps the synchronous driver in async-returning Connector methods, coerces `Date`/`boolean` bindings at the parameter boundary, and translates the schema DSL to SQLite affinity types (`INTEGER`/`REAL`/`NUMERIC`/`TEXT`). `autoIncrement` becomes `INTEGER PRIMARY KEY AUTOINCREMENT`. Validated with the shared `runModelConformance` suite + driver-specific tests.
- New `@next-model/postgres-connector` package: native PostgreSQL connector that uses `node-postgres` directly (no Knex dependency). Implements the full `Connector` interface including parameterised SQL filter compilation, `RETURNING *` for batchInsert/updateAll/deleteAll, transactional pool-client checkout, and PostgreSQL DDL for the schema DSL. Validated with the shared `runModelConformance` suite against a real Postgres 17 service container in CI.
- `runModelConformance` widened to cover Model-level features: `createMany`, `reload`, bulk `updateAll` / `deleteAll`, `first`/`last`/`exists`, `pluck`/`pluckUnique`/`ids`, `paginate`, `inBatchesOf`, `findEach`, `countBy`/`groupBy`, find variants (`findOrFail`, `findOrBuild`, `firstOrCreate`, `updateOrCreate`), dirty tracking (`isChanged`, `changes`, `revertChange`, `savedChanges`/`wasChanged`), validators + lifecycle callbacks + `Model.on`, soft delete (`discard`/`restore`/`withDiscarded`/`onlyDiscarded`), named scopes, and `belongsTo`/`hasMany` associations. Each connector's spec runs the full suite, so every supported language feature is now exercised against each backend (memory, sqlite, pg, mysql, local-storage).

### Factory & configuration

- New `Model({ tableName, init, ... })` factory returning a subclassable class. Replaces the old `NextModel<Schema>()` decorator/generic form.
- Factory options: `connector`, `keys`, `filter`, `order`, `limit`, `skip`, `timestamps`, `softDelete`, `validators`, `callbacks`, `scopes`.
- `KeyType.uuid` and `KeyType.number` primary key generation (auto-assigned on insert).
- Named scopes declared in `scopes: {...}` installed as typed class methods.

### Query chainables

- `filterBy`, `orFilterBy`, `unfiltered`.
- `orderBy`, `reorder`, `unordered`, `reverse` (flips current order; falls back to descending primary key).
- `limitBy`, `unlimited`, `skipBy`, `unskipped`.
- `unscoped` clears filter, limit, skip, order, and the soft-delete scope in one call.

### Filter operators

- Boolean composition: `$and`, `$or`, `$not`.
- Set membership: `$in`, `$notIn`.
- Null checks: `$null`, `$notNull`.
- Range: `$between`, `$notBetween`.
- Comparisons: `$gt`, `$gte`, `$lt`, `$lte`.
- Pattern: `$like`.
- Lazy filter resolution: `$async` (await a promise that resolves to a filter).
- Connector-specific raw SQL + bindings: `$raw`.
- `FilterEngine` extracted from `MemoryConnector` for reuse.

### Fetching

- `all`, `first`, `last` (`last` reuses `reverse()` + `first`).
- `find(id)` throws `NotFoundError`.
- `findBy(filter)`, `findOrFail(filter)`, `findOrBuild(filter, props)`, `firstOrCreate(filter, props)`, `updateOrCreate(filter, attrs)`.
- `exists()` / `exists(filter)`.
- `ids()`, `pluck(key)`, `pluckUnique(key)`.
- `paginate(page, perPage = 25)` returning `{ items, total, page, perPage, totalPages, hasNext, hasPrev }`.
- Async-iterator batch iteration: `inBatchesOf(size)` yields arrays; `findEach(size = 100)` yields individual instances.

### Creating & updating

- `build`, `create`, `createMany`, `buildScoped`, `createScoped`.
- Instance `save`, `update(attrs)`, `assign(attrs)`, `reload`.
- `increment(key, by = 1)`, `decrement(key, by = 1)`, `touch()`.
- Static `updateAll(attrs)` bumping `updatedAt` when timestamps are on.

### Deleting

- Instance `delete()`, static `deleteAll()`.

### Soft deletes

- `softDelete: true` factory flag filters out rows with `discardedAt` by default.
- Instance `discard()`, `restore()`, `isDiscarded()`.
- Scope modifiers `withDiscarded()` and `onlyDiscarded()`.

### Dirty tracking

- Pending-state: `isChanged()`, `isChangedBy(key)`, `changes()`, `revertChange(key)`, `revertChanges()`.
- Post-save snapshot: `savedChanges()`, `savedChangeBy(key)`, `wasChanged()`, `wasChangedBy(key)` — populated before `afterSave`/`afterUpdate` callbacks run.

### Aggregates

- `count`, `sum`, `min`, `max`, `avg` (pushed to the connector via `aggregate(scope, kind, key)`).
- `countBy(key)` → `Map<value, number>`.
- `groupBy(key)` → `Map<value, InstanceType[]>`.

### Serialization

- `attributes()`, `toJSON()`, `pick(keys)`, `omit(keys)` with typed overrides in the factory subclass.

### Validators

- Static `validators: Validator[]` array on the factory.
- Instance `isValid()` short-circuits on the first failing validator.
- `save()` throws `ValidationError` when any validator returns `false`.

### Lifecycle callbacks

- Factory `callbacks: { beforeSave, afterSave, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete }`.
- Dynamic subscription via `Model.on(event, handler)` returning an unsubscribe function. Composes with factory-declared callbacks (factory fires first, then dynamic subscribers in registration order).

### Timestamps

- Automatic `createdAt` on insert and `updatedAt` on every save, controlled by the `timestamps` factory flag (defaults to `true`). User-supplied values on insert are preserved.

### Associations

- Instance-level helpers: `belongsTo(Related, options?)`, `hasMany(Related, options?)`, `hasOne(Related, options?)`, `hasManyThrough(Target, Through, options?)`.
- Options: `foreignKey`, `primaryKey`, `throughForeignKey`, `targetForeignKey`, `selfPrimaryKey`, `targetPrimaryKey`.
- Polymorphic associations via `polymorphic`, `typeKey`, `typeValue`.
- Batch preload helpers to avoid N+1 queries: `Related.preloadBelongsTo(records, { foreignKey, primaryKey? })` returns `Map<parentPk, Related>`, `Related.preloadHasMany(records, { foreignKey, primaryKey? })` returns `Map<parentPk, Related[]>` (empty buckets are pre-seeded for every parent).

### Transactions

- `Model.transaction(fn)` delegates to the connector. `MemoryConnector` snapshots storage + last-ids on entry and restores on throw. Nestable (inner block joins the outer transaction).

### Connector interface

- `query`, `count`, `select`, `updateAll`, `deleteAll`, `batchInsert`, `aggregate(scope, kind, key)`, `execute(query, bindings)`, `transaction`.
- New backend-agnostic schema DSL: `createTable(name, (t) => { ... })`, `dropTable(name)`, `hasTable(name)`. Rails-style builder with column shortcuts (`t.string`, `t.integer`, `t.bigint`, `t.float`, `t.decimal`, `t.boolean`, `t.date`, `t.datetime`, `t.timestamp`, `t.text`, `t.json`), `t.timestamps()`, `t.index()`, and shared options (`null`, `default`, `limit`, `primary`, `unique`, `precision`, `scale`). Each connector translates the table definition into its native DDL, so migrations and bootstrap code no longer embed SQL.
- `KeyType.manual` added for caller-supplied primary key values (used by the migrations version column and any table where the PK is not auto-generated).
- `MemoryConnector` ships in `@next-model/core`.
- Sort-before-slice bug in `MemoryConnector` fixed, so `limitBy(1).orderBy(...)` is consistent and `last()` is correct without workarounds.
- `KnexConnector` brought to parity: adds `$like`, `$async`, `$raw`, `aggregate`, nested `transaction`, and `execute` with driver-aware result normalization; all filter validation now throws `FilterError`.
- `DataApiConnector` brought to parity: full filter operator set (`$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt/$gte/$lt/$lte`, `$like`, `$async`, `$raw`), `aggregate`, nested `transaction` via `beginTransaction`/`commit`/`rollback`, and `execute` with positional-binding translation to Aurora Data API `:paramN` placeholders. Constructor accepts either Aurora Data API config (delegates to `data-api-client`) or an injected client for tests. Ships with `MockDataApiClient` backed by sqlite3 so the suite exercises real SQL end-to-end.
- `LocalStorageConnector` (new, client-side) now subclasses `MemoryConnector` and persists to any `Storage`-compatible backend (browser `localStorage`, injected mock, etc.). Deferred writes during transactions preserve rollback semantics. Supports `prefix`/`suffix` for namespaced keys and rehydrates on construction.
- `FilterEngine` now implements `$like` (with `%` and `_` wildcards), closing a parity gap between `MemoryConnector` and the SQL connectors.

### Migrations

- New `@next-model/migrations` package ships a `Migrator` that tracks applied migrations in a `schema_migrations` table through any next-model `Connector`. Provides `migrate`, `up`, `down`, `rollback`, `status`, and `pending`; each migration runs inside `connector.transaction` so a failing `up` leaves no trace. Zero runtime dependencies beyond `@next-model/core` — the connector you already use drives the DDL via the new Rails-style schema DSL, so the same migration works across MemoryConnector, KnexConnector, DataApiConnector, LocalStorageConnector, and any future backend.

### Errors

- Typed error subclasses: `NextModelError` (base), `NotFoundError`, `PersistenceError`, `ValidationError`, `FilterError`.

### Docs

- README fully rewritten for the current factory API with sections for every feature above.

## v1.0.0

Complete rewrite in TypeScript

* Added new Default connector
* Basic validation
* Implemented as Decorator

## v0.4.1

Bugfix:
before and after callback.
They were broken cause of wrong test.

## v0.4.0

Added Platform specific callbacks.
Callbacks can be postfixed with `Client` or `Server`.

## v0.3.0

Tracked property changes.

New functions:

* `.trackChanges`
* `#isChanged`
* `#changes`
* `.afterChange()`
* `.after${name}Change()`

## v0.2.0

Improved browser compatibility

## v0.1.0

Added Browser compatibility

## v0.0.4

Callbacks:

* Supported actions: `build`, `create`, `save` and `delete`
* have `before` and `after` hooks
* can be an `Function`, `Promise`, `Redirect` or `Array`

Added `promiseBuild` which returns Promise and supports callbacks for building new Instances.

## v0.0.3

Addec CI with Travis CI

## v0.0.2

Published knex connector

Functions removed:

* `.useCache`

Functions added:

* `.getCache`
* `.setCache`

## v0.0.1

First release includes following functions

### required properties

* `.modelName`
* `.schema`
* `.connector`

### optional properties

* `.identifier`
* `.tableName`
* `.attrAccessors`
* `.belongsTo`
* `.hasMany`
* `.hasOne`
* `.useCache`
* `.cacheData`
* `.defaultScope`
* `.defaultOrder`

### computed properties

* `.keys`
* `.databaseKeys`
* `.hasCache`
* `.all`
* `.first`
* `.last`
* `.count`
* `.model`
* `.withoutScope`
* `.unorder`
* `.reload`

### functions

* `.build(attrs)`
* `.create(attrs)`
* `.limit(amount)`
* `.unlimit()`
* `.skip(amount)`
* `.unskip()`
* `.withScope(scope)`
* `.order(order)`
* `.scope(options)`
* `.where(filter)`
* `.createTable()`
* `.fetchSchema()`
* `.fetchBelongsTo()`
* `.fetchHasMany()`
* `.fetchHasOne()`
* `.constructor(attrs)`

### computed properties

* `#attributes`
* `#databaseAttributes`
* `#isNew`
* `#isPersisted`

### functions

* `#assignAttribute(key, value)`
* `#assign(attrs)`
* `#save()`
* `#delete()`
* `#reload()`
