# History

## vNext

## v1.1.6

## v1.1.5

### Changed

- Column accessors installed on every Model instance (schema columns, persistent-prop columns, primary-key columns, and `storeAccessors` sub-keys) are now `enumerable: true`. This makes raw Model instances structured-clone-friendly: `structuredClone(instance)` invokes each getter and stores the value on the clone, so receivers across structured-clone boundaries (Electron IPC, Web Workers, `BroadcastChannel`) see the column shape they expect instead of only the internal bookkeeping fields (`persistentProps`, `changedProps`, `lastSavedChanges`, `keys`). **Observable behaviour change** — `Object.keys(instance)` and `for (const k in instance)` now surface column names alongside the bookkeeping fields; any consumer code that enumerated instances expecting just the bookkeeping shape will now see more keys. `JSON.stringify(instance)` is unaffected (still routes through `toJSON()`). Note: `@next-model/react` wraps instances in a `Proxy` for reactivity; Proxies are unconditionally non-cloneable in V8/Chromium, so this change benefits raw instances only — consumers crossing IPC must still extract attributes from the Proxy via `instance.toJSON()` or `instance.attributes` first. See the README's "Serialization → Structured clone / IPC" section for the full pattern.

### Docs

- README `Serialization` section adds a "Structured clone / IPC" subsection covering the Electron renderer-to-main and Web Worker boundaries: which clone variant works on raw instances vs. `@next-model/react` Proxies, when to reach for `.toJSON()` / `.attributes`, and why.

## v1.1.4

### Added

- `withOrder(order)` is the new "replace ORDER BY" chainable on `CollectionQuery` and the Model static surface — semantically identical to the old `reorder()` but the name no longer shadows user-facing static methods on subclasses (e.g. `Item.reorder([...])` for "reorder items by sortOrder"). `reorder()` still works as a deprecated alias and emits a one-shot `console.warn` per process.
- `Model.Instance` is a phantom static type alias on every Model factory output (`typeof MyModel.Instance`). The runtime value is always `undefined`; TypeScript consults the declared shape `InstanceType<M> & Assoc & PersistentProps & Readonly<Keys…>` so subclass static methods returning hydrated records can use `typeof MyModel.Instance` as their return / parameter type without spelling out `Awaited<ReturnType<typeof MyModel.create>>` or losing the column-getter intersection.

### Changed

- **Breaking (in-memory only)**: `MemoryConnector` and its subclasses no longer compile `$raw.$query` / `execute(query, ...)` strings at runtime through dynamic code evaluation. The shipped `dist/*.js` bundles are now free of every dynamic-code-evaluation call site, so `@next-model/core` can be consumed under a strict `Content-Security-Policy: script-src 'self'` (the default in Electron renderers and most security-sensitive web apps). It also unblocks tree-shaking and source-map fidelity. SQL connectors (Knex / Postgres / Sqlite / Mysql / MariaDB / DataApi) are unaffected — they treat `$raw.$query` as a SQL fragment, not JS source. Migration: pass a function instead of a string source.
  - `$raw.$query: '(item, x) => item.age > x'` → `$raw.$query: (item, x) => item.age > x`.
  - `MemoryConnector.execute('(storage) => storage.users', [])` → `MemoryConnector.execute((storage) => storage.users, [])`.
  - Passing a string to a JS-evaluating connector now throws a `FilterError` / `UnsupportedOperationError` with a migration hint pointing at the function form.
- A new acceptance test (`.github/scripts/no-eval-in-dist.test.mjs`, wired into `pnpm test:release`) scans every `packages/*/dist/**/*.js` and fails CI if any future change reintroduces a dynamic-evaluation call site.
- The Model factory's `timestamps:` option is now inferred from the schema's column declarations when the caller doesn't pass it explicitly. A table with both `createdAt` and `updatedAt` columns keeps the historical default (enable both); only-`createdAt` behaves as `{ updatedAt: false }`; only-`updatedAt` behaves as `{ createdAt: false }`; neither behaves as `timestamps: false`. **Behaviour change in the niche where it bites** — `Model({ tableName: 'sessions', connector })` against a `sessions` table that didn't declare `createdAt` / `updatedAt` previously failed inserts with `SqliteError: table sessions has no column named createdAt`; it now succeeds. Explicit `timestamps:` (any value) always wins. Two internal test fixtures (`Model.spec` foo, `persistenceErgonomics.spec` posts) gained `createdAt` / `updatedAt` columns to preserve their existing semantics under the new schema-aware default.

### Docs

- README sections added / expanded across `@next-model/core` + `@next-model/sqlite-connector`: Electron integration walkthrough (preload + `contextIsolation: false`, Vite renderer config, renderer top-level-await bootstrap chain, `window.require('fs')` gotcha), `defineSchema` vs `defineTable` distinction callout, `Object.keys(schema.tableDefinitions)` iteration snippet, validators-are-a-flat-array callout, "Testing with Models" subsection (typed `makeX(props?)` factory helper pattern instead of `as any` in fixtures), refreshed `orderBy` / `withOrder` section, schema-aware Timestamps inference notes.

## v1.1.2

### Added

- `Model.findOrNull(id)` — null-on-miss counterpart to `find(id)`. Sugar over `findBy({ [pk]: id })` with the same `id`-only signature as `find`, but returns an explicit `null` (not `undefined`) on miss so callers can `??`-coalesce cleanly — the function's name reflects the actual sentinel. The typed factory mirrors the `Keys`-inferred id type. `find` keeps throwing `NotFoundError` on miss; nothing existing changes.
- `orderBy` accepts the conventional `{ [col]: 'asc' | 'desc' }` shape alongside the strict `{ key, dir }` shape. A new shared `normalizeOrderEntry` helper lives on the core surface and is consumed by `MemoryConnector` and every external connector that builds order fragments — both shapes round-trip into the same `{ key, dir }` pair before any SQL or JS sort runs. Strict + loose shapes can be mixed in a multi-key `orderBy([...])` call; uppercase `'DESC'` / `'ASC'` and the `SortDirection` enum on the loose shape are also accepted.
- `MemoryConnector` accepts a single-arg `{ schema }` constructor: `new MemoryConnector({ schema })` (and `new MemoryConnector({ storage, lastIds, schema })`) now expose the schema, rather than silently dropping it on the floor like the old `(props, extras)` arity did. The legacy two-arg form is kept for backwards compatibility; when both args carry `schema` the extras arg wins. `LocalStorageConnector` mirrors the widening on its options interface.

### Changed

- `TableBuilder.column(name, type, options)` (and the `applyAlterOps` `buildColumnDefinition` helper) default `options.null` to **false**, matching the typed-schema convention. Previously the builder defaulted to `true` while `defineSchema(...)` defaulted to `false`, so iterating `schema.tableDefinitions` to bootstrap a connector silently inverted every column's nullability. **Behaviour change** — callers relying on the old `null: true` default must now pass `{ null: true }` explicitly. Copy-pasting from `defineSchema` into `t.column(...)` round-trips cleanly post-flip.

## v1.1.1

### Added

- `Connector.ensureSchema()` is now declared on the `Connector` interface as an optional method. Calling it on a connector with an attached schema iterates `schema.tableDefinitions`, dispatches every missing table through the connector's existing `createTable` path, and returns `{ created: string[]; existing: string[] }` — no more boilerplate that walks `Object.keys(schema.tableDefinitions)` and translates columns + indexes back into the builder DSL. Implemented on `MemoryConnector` (and inherited by `LocalStorageConnector`); third-party connectors stay compilable because the method is optional.
- `ValidationError` now formats its `.message` as `"Validation failed: <field>: <reason>; <field>: <reason>"` synthesised from the structured `.errors` payload, so test assertions like `expect(p).rejects.toThrow(/name/)` and `instanceOf(ValidationError)` checks pass without inspecting the rejected instance. The new single-argument shape `new ValidationError(errors)` is supported alongside the existing two-arg shape; plain-string callers (no errors map) keep the previous bare message.
- The Model factory now publishes the resolved schema's column list on the subclass as `static schemaColumnNames` (read by the instance constructor — see below).

### Changed

- Mixed-object filter shapes now compose correctly. `filterBy({ workspaceId: 1, $null: 'archivedAt' })` used to silently drop the equality predicate because the connector's `compileFilter` short-circuits on the first `$`-prefixed key it sees. `normalizeFilterShape` now lifts every top-level operator out into its own AND-piece, so equality + `$null` / `$in` / `$gt` / `$and` / `$or` / column-op maps all coexist in a single filter object and survive end-to-end through every connector. Single-operator and pure-equality shapes are unchanged.
- Nested column-op syntax (`filterBy({ col: { $in: [...] } })`) and the legacy top-level syntax (`filterBy({ $in: { col: [...] } })`) are now explicitly pinned as equivalent — `normalizeFilterShape` already rewrote one to the other, the test surface just makes the contract load-bearing so future refactors can't silently regress.
- Property getters on Model instances are now installed for every column declared on the schema's `tableDefinition`, not only the keys present in `persistentProps` at construction. Columns omitted at insert (e.g. nullable timestamps like `archivedAt`) are now readable as `instance.col` immediately after `instance.update({ col: value })` — no more `Model.findBy({ id })` re-fetch dance. Legacy Model paths without `defineSchema` still fall back to the previous `persistentProps`-driven loop.

## v1.1.0

## v1.0.0

Rolling changelog for the next major release. Items below group related changes; this list will be finalized into a version heading when the release is cut.

### Headline: promise-like chainable query builders

- Static chainable Model methods now return CollectionQuery / InstanceQuery / ScalarQuery / ColumnQuery builders instead of class subclasses or eager Promises. `Model.filterBy({...})` / `.orderBy(...)` / `.limitBy(...)` / `.includes(...)` / `.joins(...)` / `.whereMissing(...)` / `.fields(...)` / `.having(...)` / `.merge(...)` / `.none()` / `.withDiscarded()` / `.onlyDiscarded()` / `.unscoped()` (and every other chain primitive) all forward to `CollectionQuery.fromModel(this).<method>(...)`. Single-record terminals — `findBy(...)` / `find(id)` / `findOrFail(...)` — return InstanceQuery; collection terminal `all()` returns CollectionQuery; aggregates `count()` / `sum(col)` / `min(col)` / `max(col)` / `avg(col)` return ScalarQuery; `first()` / `last()` return InstanceQuery. Each builder is PromiseLike, so existing `await Post.filterBy(...).all()` / `await Post.find(1)` / `await Post.count()` callers keep working unchanged. Static method types are precise — `Model.findBy(...)` returns `InstanceQuery<InstanceType<M> | undefined>` directly, `Model.count()` returns `ScalarQuery<number>`, `Model.all()` returns `CollectionQuery<InstanceType<M>[]>`, etc. — so `User.findBy({email}).pluck('name')` typechecks without intermediate awaits. `CollectionQuery.materialize` owns the full row-hydration pipeline directly: afterFind callbacks, STI dispatch via `inheritColumn → inheritRegistry`, includes preload + JOIN-mode attach, `selectedFields`, soft-delete / STI implicit filters, and the `queryWithJoins` fast path; the shared `applyIncludes` / `attachIncludesPayload` helpers live in `query/includes.ts` so the builder layer reuses them. ScalarQuery and ColumnQuery resolve `pendingJoins` to flat `$in` / `$notIn` filters before calling `queryScoped`, so connectors always see a clean spec — `Model.whereMissing('posts').count()` lowers the join into a filter first, and SQL connectors throw if `pendingJoins` ever arrive at `queryScoped`. The query-pipeline scope helpers live in `query/scope.ts` (`builderScopeBase`, `resolvePendingJoinsToScope`, `resolveParentScopesToFilter`); cursor encode/decode helpers live in `query/cursor.ts`. The 16 builder methods that used to scope through a temporary subclass — `pluckUnique`, `ids`, `countBy`, `exists`, `groupBy`, `updateAll`, `deleteAll`, `destroyAll`, `increment`, `decrement`, `paginate`, `paginateCursor`, `inBatchesOf`, `findEach`, `select`, multi-column `pluck` — are now first-class methods that call connector primitives directly via a shared `resolvedScope()` helper. Named scopes / enum scopes / factory-time `scopes:` declarations are auto-attached to every CollectionQuery so chains like `Post.filterBy(...).published().recent()` keep working.
- Auto-installed instance association accessors now return chainable query builders rather than eager promises. `record.todos` (declared `hasMany`) returns a `CollectionQuery<Todo>`; `record.author` / `record.profile` (declared `belongsTo` / `hasOne`) return `InstanceQuery<Related>` directly — symmetric with auto-installed accessors and the `hasMany` shape; `record.roles` (declared `hasManyThrough`) returns a `CollectionQuery` with the nested through-chain wired up via `withParent`. Both query types are PromiseLike, so existing `await user.todos` / `await post.author` shapes keep working unchanged. Inside the constructor the lazy getter delegates to the same `createAssociationQuery(upstream, spec)` pipeline that powers `<InstanceQuery>.<assoc>` / `<CollectionQuery>.<assoc>`, so polymorphic + every other refinement applies uniformly. The eager-load + `includes(...)` paths still overwrite the cached value with the resolved instances. Net effect: `await User.findBy({email}).todos.filterBy({status: 'open'})` reads as one chain end-to-end.
- Subquery filter values: any builder can be passed as a `filterBy(...)` value. `Todo.filterBy({userId: User.filterBy({active: true})})` lowers to a correlated subquery on the related table's primary key; `ColumnQuery` (from `.pluck(...)`) uses the projected column directly; `ScalarQuery` (from `.sum(...)` / `.count()` / `.min(...)`) is resolved eagerly when used as a top-level value or spliced into operator-form filters like `{ total: { $gt: itemTotal } }`. Extraction descends into `$and` / `$or` / `$not` arms so the same shape works wherever a literal would. Six native-SQL connectors (Knex / Sqlite / Postgres / MySQL / MariaDB / Aurora Data API) emit one-statement subqueries; every other connector resolves the inner builder to concrete `$in` filter values at the Model layer, so even connectors that reject `$async` work transparently.
- `record.attributes` is now a zero-arg getter rather than a method — symmetric with the chainable association accessors. `JSON.stringify(user)` keeps working unchanged because `toJSON()` reads the same getter, and `pick(...)` / `omit(...)` / `was(...)` / `savedWas(...)` route through the new property internally.

### Breaking changes

The headline migration is mostly transparent (await on a builder works exactly like await on the old Promise), but four call sites need code changes:

- **`record.attributes()` → `record.attributes`.** Drop the parens. TypeScript catches the mismatch on the spot. `validators.ts`'s `RecordLike` shape, the `defaultSerialize` paths in `@next-model/express-rest-api` / `@next-model/graphql-api` / `@next-model/nextjs-api`, and the validator bridges in `@next-model/zod` / `@next-model/arktype` / `@next-model/typebox` were all updated; test fixtures using the `{ attributes: () => ({...}) }` shape need to swap to `{ attributes: {...} }`.
- **`scopes: { name: (self) => self.filterBy(...) }` callbacks → declarative literals or filter factories.** Named `scopes` are now either `Filter<any>` literals (no-arg method, e.g. `published: { published: true }`) or `(...args) => Filter<any>` factories (args-forwarding method, e.g. `olderThan: (age: number) => ({ $gt: { age } })`). Both call `filterBy(...)` under the hood and produce a `CollectionQuery`. For multi-clause / multi-step logic, declare a static method on your subclass (`static admins() { return this.filterBy({role: 'admin'}); }`); it composes with every chainable. The legacy `(self, ...args) => self` callback shape is gone — convert each scope to one of the two new forms. `ScopeMap` is now `Dict<Filter<any> | (...args: any[]) => Filter<any>>`. Enum value scopes (`Post.draft()`) auto-generate the no-arg literal shape.
- **Inline-spec JOIN chainables → declared associations.** `Model.joins({ hasMany: Post, foreignKey: 'userId' })`, `Model.whereMissing({ ... })`, and `Model.includes({ posts: { ... } })` no longer accept inline specs. Declare `associations` on the factory and pass names: `Model.joins('posts')`, `Model.whereMissing('posts')`, `Model.includes('posts')`. Cross-association `filterBy({ posts: {...} })` looks up the same registry. Association name collisions with primary-key columns, `storeAccessors` sub-keys, enum predicates, or built-in instance methods throw at factory construction.
- **Third-party connectors** must now implement two new required methods on the `Connector` interface: `deltaUpdate(spec)` and `upsert(spec)`. `alterTable(spec)` and `queryWithJoins(spec)` are also new (the latter is optional). See the Connector capability section below for what each method does.

### Associations

- Declarative `associations` factory option drives every JOIN-shaped chainable. Declare `belongsTo` / `hasMany` / `hasOne` per name (use `() => Other` thunks for circular imports) and the rest follows automatically: `Model.joins(...names)`, `Model.whereMissing(name)`, `Model.includes(...names, { strategy })`, and cross-association `filterBy({ <name>: {...} })` all look up the same registry. Each association name also defines a chainable accessor on every instance — `user.posts` (`CollectionQuery<Post>`), `user.profile` (`InstanceQuery<Profile | undefined>`), `user.company` (`InstanceQuery<Company | undefined>`) — that the eager-load and JOIN-includes paths overwrite with the resolved value.
- Optional Connector JOIN-execution capability, plus four model-layer entry points that route through it. The `Connector` interface gains one optional method — `queryWithJoins?(spec: JoinQuerySpec): Promise<Dict<any>[]>` — and `KnexConnector` / `SqliteConnector` / `PostgresConnector` / `MysqlConnector` / `MariaDbConnector` / `DataApiConnector` implement it; the Model layer treats the method's presence as the capability bit (no separate boolean flag). `Model.whereMissing(...)` switches from a `$async` + `$notIn` subquery to a single `WHERE NOT EXISTS (SELECT 1 FROM child WHERE child.fk = parent.pk)` on connectors that opt in. `Model.joins(...names)` adds INNER JOINs against the named associations. Cross-association `filterBy({ <name>: {...} })` auto-promotes to an INNER JOIN with the child filter applied. `Model.includes(...)` gains `{ strategy: 'preload' | 'join' | 'auto' }`: `'preload'` is the previous one-batched-query-per-association behaviour; `'join'` routes through `queryWithJoins`; `'auto'` picks `'join'` when supported and `'preload'` otherwise. Memory / Redis / Mongo / LocalStorage stay on the subquery fallback — the Model layer pre-resolves the child queries to concrete `$in` / `$notIn` filters before reaching the connector, so even connectors that reject `$async` work transparently. `unscoped()` clears `pendingJoins` and the include strategy alongside everything else.
- New `Model.includes({ assoc: ... })` chainable for eager loading associations. Each entry names the property attached to returned instances and how to load it — `belongsTo`, `hasMany`, or `hasOne`. Runs a single batched query per association via the existing `preloadBelongsTo` / `preloadHasMany` primitives, cutting the N+1 round-trips you'd get from calling `this.user` / `this.posts` on every row. `Model.withoutIncludes()` and `unscoped()` both clear the eager-load chain.
- New `Model.whereMissing(name)` chainable for parents that have no matching child rows — Rails' `User.where.missing(:posts)`. On connectors with `queryWithJoins` it emits a single `WHERE NOT EXISTS (...)` on the parent query; on others it falls back to `pluckUnique(foreignKey)` + `$notIn` filter. Multiple `whereMissing` calls AND together. When the child table is empty, all parents match (the natural `$notIn []` outcome).

### Breaking changes — schema is mandatory

- The legacy `Model({ tableName, init, keys })` overload has been removed. Every Model must be constructed via `Model({ connector, tableName })` where the connector carries a `defineSchema(...)` schema attached at construction time.
- The schema-direct `Model({ schema, tableName })` overload has been removed. Pass the schema through the connector instead — `new XyzConnector(opts, { schema })`.
- The Model-level `associations: { … }` factory field has been removed. Declare associations on the schema (`defineSchema({ users: { associations: { ... } } })`).
- The `Model<UserProps>(...)` interface-generic overload has been removed. Schema-derived props are the only path.

### Schema-first associations

- Schema-level associations: `defineSchema({ users: { associations: { tasks: { hasMany: 'tasks', foreignKey: 'userId' } } } })`. Cycle-free declarations (target tables are strings); `Model({ connector, tableName })` exposes typed accessors derived from the schema.
- `ModelRegistry` interface: augment via declaration merging (`declare module '@next-model/core' { interface ModelRegistry { tasks: import('./task').Task } }`) to upgrade association accessors from row shapes to class instance types with custom methods. Type-only — does not introduce runtime imports.
- Default `init` derived from the schema: when no `init` is passed, columns with `default` values (including `'currentTimestamp'`) are applied at `build()` time. Caller-supplied props win.
- `Model.ts` now skips the auto-defined association accessor when a class getter for the same name exists on the prototype. Class authors can override `user.tasks` to return class instances with custom methods without touching the registry.

### Connector capabilities

- New `Connector.deltaUpdate(spec)` capability — required on the `Connector` interface. `spec` is `{ tableName, filter, deltas: [{ column, by }], set? }` and applies every `column = column + by` to matching rows; the optional `set` lands absolute writes (e.g. `updatedAt = now`) alongside the deltas. Returns the affected row count. Each connector picks the most efficient native shape: `postgres-connector` / `mysql-connector` / `mariadb-connector` / `sqlite-connector` / `aurora-data-api-connector` / `knex-connector` compile to SQL `UPDATE col = COALESCE(col, 0) + ?`; `mongodb-connector` uses `$inc`; `redis-connector` / `valkey-connector` queue `HINCRBY` / `HINCRBYFLOAT` per-row inside a `MULTI`; `MemoryConnector` / `local-storage-connector` walk in-process. Wired into `record.increment(col, by)` / `record.decrement(col, by)` (skips validation + full save callbacks à la Rails `update_columns`; still fires `afterUpdate` / `afterUpdateCommit`; bumps `updatedAt` automatically), the new chainable class-level `Model.where(...).increment(col, by)` / `Model.where(...).decrement(col, by)` (returns affected count), and the `counterCaches` afterCreate / afterDelete / afterUpdate hooks (one round-trip, no parent SELECT). Race-free under concurrency on every connector with native single-statement support: 1 000 concurrent `Comment.create({ postId: 1 })` calls land the right counter value.
- Native UPSERT capability — `Connector.upsert(spec)` is now a required method on the `Connector` interface. Every bundled connector (Memory, LocalStorage, Knex, Postgres, Sqlite, Mysql, MariaDB, MongoDB, Aurora-DataApi, Redis, Valkey) implements it; SQL/Mongo/Aurora go through a single atomic statement (`INSERT … ON CONFLICT … DO UPDATE` / `ON DUPLICATE KEY UPDATE` / `bulkWrite` with `upsert: true`), Redis / Valkey compose their own primitives (non-atomic SELECT-then-INSERT-or-UPDATE — Redis has no native conflict resolution on non-PK columns). `Model.upsert(...)` / `Model.upsertAll(...)` always route through `connector.upsert` — there is no longer a Model-layer fallback. Bulk upserts collapse from N×2 round-trips to one on connectors with native support (sqlite is internally chunked at 200 rows/statement to stay under `SQLITE_LIMIT_COMPOUND_SELECT`, all chunks share one transaction). New options `updateColumns: string[]` (whitelist columns that are overwritten on conflict) and `ignoreOnly: true` (`DO NOTHING` — keep the existing row untouched and return it) layer on top of the existing `onConflict` option. Mirroring Rails' `upsert` / `upsert_all`, the upsert path skips per-row lifecycle callbacks and validators on every connector — use `Model.create` / `record.update` (or `Model.transaction(...)`) when those must run.
- New schema-mutation primitives. `Connector.alterTable(spec)` is now part of the interface alongside `createTable` / `dropTable`, and `defineAlter(tableName, (a) => { ... })` is a chainable builder that emits `AlterTableSpec` shapes. Op set: `addColumn` / `removeColumn` / `renameColumn` / `changeColumn`, `addIndex` / `removeIndex` / `renameIndex`, `addForeignKey` / `removeForeignKey`, `addCheckConstraint` / `removeCheckConstraint`, plus `addReference` / `removeReference` sugar (column + index + optional FK in one call). Stable default names (`fk_<table>_<refTable>`, `idx_<table>_<columns>`) so `remove*` ops can target the constraint without bookkeeping. `applyAlterOps(table, ops)` is exported for tooling that needs to project the same ops onto an in-memory `TableDefinition` (the `SchemaCollector` uses this to keep its snapshot in sync). `MemoryConnector` rewrites rows on column rename / remove and back-fills `addColumn` with the column's default; foreign keys + check constraints throw the new `UnsupportedOperationError` since they can't be enforced in-memory. SQL-shaped connectors implement every op in their native dialect — `SqliteConnector` uses ALTER TABLE for the natively-supported ops and the standard "create new table + copy + drop + rename" recreate dance for `changeColumn` / FK / check changes.

### Model features (Rails parity)

- New `defineSchema(...)` shape — declares a full multi-table database schema and attaches it to a connector for type-aware Models. `defineSchema({ users: { columns: {...} }, posts: { columns: {...} } })` returns a `DatabaseSchema` with `tables` (the raw column maps for type inference) and `tableDefinitions` (one runtime `TableDefinition` per table for migration / tooling consumption). Connectors accept the schema via an optional second `extras: { schema }` constructor arg — `new SqliteConnector(':memory:', { schema })`. Every bundled connector (Memory, SQLite, Postgres, MySQL, MariaDB, Aurora Data API, Knex, Redis, Valkey, MongoDB, LocalStorage) is now generic over an attached `DatabaseSchema`, defaulting to `undefined` so existing untyped call sites keep compiling. The `Connector` interface itself gains a `readonly schema?: Schema` field so the Model factory can read it from any concrete connector without runtime probing. This replaces the previous per-table `defineSchema({ tableName, columns })` shape — pre-release, breaking change.
- New `Model({ connector, tableName: 'users' })` overload infers props from a connector's attached `DatabaseSchema`. TypeScript walks `connector.schema.tables[tableName].columns`, derives the prop type, default `keys` map, and identity `init` automatically — no per-Model schema, no explicit generic argument, no `init` callback. `tableName` is statically constrained to keys of the attached schema, so a typo is a TypeScript error at the Model declaration site; the runtime mirror throws `Model(): tableName 'X' is not declared on the attached schema` if you bypass the type system. The complementary `Model({ schema, tableName })` overload accepts the same `DatabaseSchema` directly when the connector isn't statically typed (dynamic connector swapping); explicit `schema:` always wins over the connector's. Column-kind → TS-type mapping is unchanged: `'string' | 'text' → string`, `'integer' | 'bigint' | 'float' | 'decimal' → number`, `'boolean' → boolean`, `'date' | 'datetime' | 'timestamp' → Date`, `'json' → unknown`; `null: true` widens to `T | null`; string / text primaries become `KeyType.uuid`, numeric primaries become `KeyType.number`. The legacy `Model({ tableName, init, ... })` form and the interface-generic `Model<Props>({...})` form are both unchanged — all three coexist via overloads.
- `generateSchemaSource(tables)` now emits a single `export const schema = defineSchema({...})` call with all tables nested instead of one `defineSchema` per table. The migrator's `schemaOutputPath` integration and the `schema-from-db` CLI subcommand both flow through the same generator, so generated files line up with the new API. Pass `{ exportName: 'mySchema' }` to override the emitted const name; `header` and `importPath` keep working unchanged.
- Interface-generic `Model<Props>({...})` form: pass a TypeScript interface as the generic and omit `init` — it now defaults to identity, so `Model<UserProps>({ tableName: 'users' })` typechecks end-to-end (`User.create(...)` accepts `UserProps`, instances expose them as typed fields). Works alongside the existing schema-driven and explicit-`init` forms; the latter two are unchanged. Best fit when you already have a TS type for the row shape (e.g. inferred from a Zod / OpenAPI / Arktype schema) and don't need the runtime `TableDefinition` that `defineSchema(...)` carries.
- New `defaultScope` factory option declares a sticky filter applied to every chained read on the Model — `Post.all()`, `Post.count()`, `Post.filterBy({...})`, terminals (`find` / `findBy`), and the deferred `pluck` / `select` / `updateAll` / `deleteAll` / `increment` paths all see it (it's merged into `filter` at lower-time, after subquery resolution and association-key processing, before the spec is sent to the connector). Distinct from the existing `filter` factory option: `filter` only seeds the chain's initial state and is cleared by `unfiltered()`; `defaultScope` is sticky and only `unscope` / `unscoped` removes it. Two new escapes: `Model.unscope('column', ...)` drops the listed columns from the default scope for one builder while leaving the rest of the chain untouched (walks `$null` / `$notNull` / column-value-map ops like `$gt` / `$in` / `$between` / `$like`, prunes column-keyed equality, and recurses into `$and` / `$or` / `$not`); the existing `Model.unscoped()` is extended to suppress `defaultScope` entirely alongside everything it already clears. State carries two new flags — `unscopedKeys` / `unscopedAll` — and an `applyDefaultScope(filter, defaultScope, unscopedKeys, unscopedAll)` helper is exported from `query/lower.ts` for tests / tooling.
- Single Table Inheritance. Declare the base with `inheritColumn: 'type'`, then create subclasses via `Base.inherit({ type: 'Dog' })` — each subclass shares the base's table / keys / connector / init, auto-fills the discriminator column on insert, and scopes reads to its own type. `Base.find(id)` and `Base.all()` inspect the column and instantiate the matching registered subclass (unknown type values fall back to the base). Subclass-specific `validators` / `callbacks` are concatenated with the base's; subclass filters / scopes compose on top of the auto-filter. Works across every connector — the subclass filter goes through the normal `filterBy` / `builderScopeBase` path.
- New `enums: { status: ['draft', 'published'] as const }` factory option for typed enum columns. Each value becomes a chainable class scope (`Post.draft()` → filtered scope, composes with `.filterBy` / `.orderBy` / `.limitBy`) plus an instance predicate (`post.isPublished()`). Snake_case values map to camelCase scopes / PascalCase predicates (`'in_review'` → `Item.inReview()` / `item.isInReview()`). The full list per column is exposed as `Post.statusValues` (readonly array). A built-in validator rejects out-of-range values at `isValid()` / `save()` time; collisions with existing static or prototype methods throw at factory construction so accidents surface immediately. Also exports the `camelize` / `pascalize` helpers powering the name resolution.
- New `lockVersion: true` (or `lockVersion: 'columnName'`) factory option enables Rails-style optimistic locking. Inserts default the column to `0`; every successful `save()` / `delete()` requires the in-memory value to still match the row's current value and increments it on update. A concurrent writer whose in-memory value is stale gets a new `StaleObjectError` (re-exported from `@next-model/core`) and the row is left untouched — call `reload()` to pick up the latest value and retry. Implemented at the Model layer by extending the WHERE clause of the existing `updateAll` / `deleteAll` connector primitives, so it works across every connector with no connector changes.
- New `cascade` factory option declares per-association dependent behaviour for `delete()`, mirroring Rails' `dependent: :destroy / :delete_all / :nullify / :restrict_with_error`. Each entry names a `hasMany` or `hasOne` child Model (or a `() =>` thunk for circular imports), the foreign key, optional primary key, and one of: `'destroy'` (load each child and call `.delete()` — recursive cascade, child callbacks fire), `'deleteAll'` (bulk delete via the connector — no child callbacks), `'nullify'` (bulk update children's foreign-key column to null), or `'restrict'` (throws `PersistenceError` if any matching child exists, leaving the parent intact). Cascades run before the parent's own delete; soft-deleted children still count for `restrict`. Models without `cascade` are unaffected.
- New `counterCaches` factory option auto-maintains a count of child rows on the parent. Each spec names the parent Model (or a `() =>` thunk for circular imports), the foreign-key column on the child, and the counter column on the parent. The Model registers `afterCreate` (+1), `afterDelete` (−1), and `afterUpdate` (handles foreign-key reassignment: −1 from the old parent, +1 to the new) hooks on construction. Null foreign keys and missing parents are silent no-ops; Models without `counterCaches` are unaffected. Builds on the existing `instance.increment(column, by)` helper — no connector changes required.
- New `storeAccessors: { settings: ['theme', 'locale'] }` factory option adds top-level instance accessors that proxy into a JSON column. `user.theme = 'dark'` mutates `user.settings.theme`; reads pull the value back out. Writes go through `assign({ [column]: { ...current, [subKey]: value } })`, so dirty tracking sees the JSON column as changed (`isChangedBy('settings') === true`) and `save()` ships the merged blob to the connector. Sub-keys that collide with an existing column or key are skipped (the column accessor wins). Built on PR #127's transparent JSON serialization — no connector changes required.
- Two attribute-boundary helpers borrowed from Rails 7.1+: `normalizes: { email: (v) => v.trim().toLowerCase() }` runs the function whenever the column is written through `assign(...)` (which covers every direct setter, `update(...)`, and round-trip through the property accessor). `secureTokens: ['apiKey']` (or `{ apiKey: { length: 32 } }`) auto-fills the column with a URL-safe random base64url token on insert when the value is blank — explicitly-provided values are preserved. Default token length is 24 bytes (32-character output). The underlying token primitive is exported as `generateSecureToken(length?)` for ad-hoc use. Both options are layered onto the existing `assign` / `save` paths; no connector changes required.
- New built-in validator factories: `validatePresence` / `validateFormat` / `validateLength` / `validateInclusion` / `validateExclusion` / `validateNumericality` / `validateUniqueness` / `validateConfirmation`. Each returns a `Validator<T>` that drops into the existing `validators: [...]` array alongside function-form validators (which keep working unchanged), and each accepts `{ message?, allowNull?, allowBlank?, if?, unless? }` for the usual ergonomics. Every Model instance now carries an `errors` collection populated during `isValid()` (`record.errors.on(key)` / `.full()` / `.any()` / `.count()` / `.clear()` / `.toJSON()`); `isValid()` runs ALL validators so the collection is complete, rather than short-circuiting on the first failure. `save()` throws `ValidationError` whose `.errors` property carries the same structured payload (`{ email: ['cannot be blank', 'is invalid'], name: ['is too short (minimum 3)'] }`). `validateUniqueness` runs through `Model.unscoped()` (so soft-deleted rows still count), excludes the current record by primary key on updates, and supports `scope` (multi-column uniqueness) and `caseSensitive: false`.
- Lifecycle callback expansion. Six new events on top of the existing `beforeSave` / `afterSave` / `beforeCreate` / `afterCreate` / `beforeUpdate` / `afterUpdate` / `beforeDelete` / `afterDelete` pair up: `afterInitialize` fires from the constructor (synchronous — async returns are fire-and-forget to keep `build()` sync); `afterFind` fires after every query-based hydration (`all` / `first` / `last` / `find` / `findBy` and their friends); `beforeValidation` / `afterValidation` wrap every `isValid()` call (including the implicit one inside `save()`); `aroundSave` / `aroundCreate` / `aroundUpdate` / `aroundDelete` accept `(record, next) => Promise<void>` middleware that compose LIFO — an around that skips `await next()` skips the body. Also adds `Model.skipCallbacks(events, fn)` which temporarily hides the listed handlers for the duration of `fn` and restores them in a `finally`. The existing function-form `Model.on(event, handler)` registry unchanged — the new events piggyback on the same storage.
- Transactional callbacks: new `afterCommit` / `afterRollback` events plus the per-operation `afterCreateCommit` / `afterUpdateCommit` / `afterDeleteCommit` and matching rollback variants. Inside `Model.transaction(...)` these hooks are queued and drained only after the transaction body resolves — afterCommit on success, afterRollback on throw. Outside a transaction the commit hooks fire immediately after `save()` / `delete()` (auto-commit semantics, matching Rails). Implementation uses `AsyncLocalStorage` so detection is automatic regardless of how deep the call stack goes; nested `Model.transaction(...)` calls reuse the outer context so commit-time effects drain once at the outermost boundary. Per-callback errors during rollback drain are swallowed so the original throw propagates intact. Connector-level transactions called directly (`connector.transaction(fn)`) bypass the queue — wrap in `Model.transaction` to opt in.

### Persistence helpers

- Three small Rails-parity persistence helpers: `instance.delete({ skipCallbacks: true })` skips `beforeDelete` / `afterDelete` (matches Rails' `record.delete` vs `record.destroy` distinction); `instance.touch({ time?, columns? })` accepts an explicit timestamp and/or a custom set of columns to update (defaults to the Model's `updatedAtColumn`); and `Model.destroyAll()` is a new static that loads each matching row and calls `.delete()` on it (per-row callbacks fire and `cascade` config takes effect, unlike the bulk `deleteAll()`). All three pile additively on top of the existing API — no signature changes to existing surface, all defaults are backwards-compatible.
- New `Model.upsert(props, { onConflict? })` and `Model.upsertAll(propsList, { onConflict? })` for insert-or-update flows. The conflict columns default to the Model's primary key(s); pass a single column name or a tuple for unique-key sets (`{ onConflict: ['tenantId', 'key'] }`). `upsertAll` partitions the input with a single SELECT against the existing rows, dispatches one bulk insert for newcomers and one update per match, and returns instances in the input order. Now routes through native `Connector.upsert` on every bundled connector (see "Connector capabilities" above for atomicity guarantees per backend).
- New dirty-tracking shortcuts on every Model instance: `was('attr')` returns the value the attribute had before the in-memory change (Rails' `<attr>_was` — falls back to the current value when unchanged); `savedWas('attr')` returns the value the record had immediately before the last save (Rails' `attribute_before_last_save`); `changeBy('attr')` returns `{ from, to } | undefined` as a single-attribute companion to `changes()`. All three are typed against the Model's `PersistentProps`. The existing `changes()` / `savedChanges()` / `isChangedBy` / `wasChangedBy` / `savedChangeBy` / `revertChange(s)` surface is unchanged.

### Query helpers

- Four query-builder gaps closed: `Model.merge(otherScope)` AND-combines filters and lets the merged scope's order / limit / skip override the receiver's (Rails parity); `Model.none()` returns a chainable scope that resolves to zero rows without hitting the connector — implemented by swapping in a new exported `NullConnector` so writes silently no-op too; `Model.having(predicate | { count: { $gt: N } })` post-filters the `countBy(...)` result map (function predicate or `$eq`/`$gt`/`$gte`/`$lt`/`$lte` operators); `Model.pluck(...keys)` accepts multiple columns and returns `[A, B, C][]` tuples (single-column callers keep the existing flat-array shape). `unscoped()` clears the `having` predicate alongside everything else it already clears.
- New `Model.fields(...keys)` chainable for partial fetches — restricts `all()` / `first()` / `last()` / `find()` / `findBy()` to the listed columns while still returning Model instances. Primary key(s) are always included even when not in the list so instances can still `save` / `reload` / `delete`. `allFields()` undoes the restriction; `unscoped()` also clears it. Built on top of the existing `Connector.select(scope, ...keys)` primitive — no connector changes required.
- New `paginateCursor({ after?, before?, limit? })` chainable on every Model. Cursor-based ("keyset") pagination over the primary key; avoids the `O(skip)` cost of `.paginate()`'s LIMIT/OFFSET path so it stays cheap on large tables. Cursors are opaque base64-url-encoded JSON of the boundary row's primary key. Returns `{ items, nextCursor?, prevCursor?, hasMore }`. `nextCursor` is set only when `hasMore`; `prevCursor` whenever items are present. Wired through every connector by the existing `$gt` / `$lt` filter primitives — no connector changes required.
- **Fix**: `paginateCursor` now honours the chain's `orderBy` column. Previously it always filtered via `{ $gt/$lt: { id: ... } }`, which meant pages came back in primary-key order regardless of the order you'd chained. The cursor now keys off `this.order[0]` (falling back to the primary key when no order is set), flips `$gt`/`$lt` for descending orders, and always includes the primary key as a tie-breaker so rows with duplicated sort values paginate deterministically. Tokens produced by earlier versions keep decoding (the single-key shape is unchanged when the order is the primary key); tokens from ordered chains are composite (`{[orderKey]: ..., [primaryKey]: ...}`). `@next-model/express-rest-api`, `@next-model/graphql-api` and `@next-model/nextjs-api` all pick up the fix automatically since they delegate to `Model.paginateCursor`.
- Filter operators now accept the more idiomatic column-first shape: `filterBy({ age: { $gt: 18 } })` / `filterBy({ status: { $in: ['open', 'pending'] } })` / `filterBy({ name: { $not: 'john' } })` in addition to the legacy `filterBy({ $gt: { age: 18 } })` shape. Multi-op column maps (`{ age: { $gt: 18, $lt: 65 } }`) are expanded into a top-level `$and`. `$and` / `$or` / `$not` / `$raw` / `$async` continue to live at the top level (and still nest into child filters). Normalization happens at the `filterBy` / `orFilterBy` entry points so every connector keeps seeing the existing internal shape — no connector changes required. Exported as `normalizeFilterShape(filter)` for anyone composing filters by hand.

### Soft-delete & timestamps configuration

- `softDelete` now accepts a column-name override. In addition to `true` / `false` you can now pass a string (shorthand for the column) or `{ column?: string }` — e.g. `softDelete: 'deleted_at'`. `discard()` / `restore()` / `withDiscarded()` / `onlyDiscarded()` and the active-only default scope all key off the configured `ModelClass.softDeleteColumn`.
- `timestamps` now accepts per-column control. In addition to `true` / `false` you can now pass `{ createdAt?: boolean | string; updatedAt?: boolean | string }` to enable only one of the two timestamps or to rename the columns (e.g. `timestamps: { createdAt: 'inserted_at', updatedAt: false }`). Exposed as `ModelClass.createdAtColumn` / `updatedAtColumn`; `touch()` now throws a `PersistenceError` when the Model has no `updatedAt` column.

### Schema DSL

- New `generateSchemaSource(tables, options?)` helper for emitting `defineSchema(...)` declarations as parseable TypeScript source. Pairs with the new `Connector.reflectSchema?(): Promise<TableDefinition[]>` capability and the `Migrator` `schemaOutputPath` option to give users an end-to-end pipeline: migrations describe the schema → `SchemaCollector` mirrors it → migrator emits `src/schema.ts` → `Model({ schema })` consumes it. Output drops default-valued column options for compactness, camelCases each table name into `<name>Schema` consts, quotes string defaults, emits `'currentTimestamp'` as a literal, and renders `Date` defaults as `new Date('...')`. Configurable via `{ importPath?, header? }` so generated files match the consumer's module aliases. The companion `nm-generate-migration schema-from-db --connector ./db.js --output ./src/schema.ts` subcommand reflects a live database via the same primitives. SQLite is the first reflection-capable connector (parses `PRAGMA table_info` / `PRAGMA index_list` and recovers `AUTOINCREMENT` from `sqlite_master.sql`); native Postgres / MySQL / MariaDB / Aurora reflection ships in follow-up releases. Memory / Redis / Valkey / Mongo connectors leave `reflectSchema` undefined by design (no canonical schema to introspect).
- Schema DSL: new `t.references(name, options?)` shortcut. Declares an integer foreign-key column (`<name>Id` by default, overridable via `column`) and — unless `index: false` is passed — adds an index on it in one call. Rails-style ergonomics for the common join-column case. The generated column + index flow through every existing connector unchanged (they already honour `columns` and `indexes` from the table definition); the MongoDbConnector now also honours declared indexes by calling `collection.createIndex` at table-create time.
- `SqliteConnector` now round-trips nested objects and arrays in `t.json(...)` columns automatically. Previously passing an object to `batchInsert` or `update` would fail at the `better-sqlite3` binding ("cannot bind type"); now those values are serialized to JSON text on insert / update and parsed back on query / select. The connector tracks JSON column metadata per table at `createTable` time; reconnecting to an existing file without calling `createTable` will return raw strings (the DDL type would be `TEXT` either way — sqlite has no native JSON type). Other connectors were already JSON-safe: memory / local-storage / redis serialize transparently, and pg / mysql2 / mariadb-connector round-trip `JSON` / `JSONB` columns through their native JSON path.

### New connector packages

- New `@next-model/postgres-connector` package: native PostgreSQL connector that uses `node-postgres` directly (no Knex dependency). Implements the full `Connector` interface including parameterised SQL filter compilation, `RETURNING *` for batchInsert/updateAll/deleteAll, transactional pool-client checkout, and PostgreSQL DDL for the schema DSL. Validated with the shared `runModelConformance` suite against a real Postgres 17 service container in CI.
- New `@next-model/sqlite-connector` package: native SQLite connector that uses `better-sqlite3` directly (no Knex dependency). Wraps the synchronous driver in async-returning Connector methods, coerces `Date`/`boolean` bindings at the parameter boundary, and translates the schema DSL to SQLite affinity types (`INTEGER`/`REAL`/`NUMERIC`/`TEXT`). `autoIncrement` becomes `INTEGER PRIMARY KEY AUTOINCREMENT`. Validated with the shared `runModelConformance` suite + driver-specific tests.
- New `@next-model/mysql-connector` package: native MySQL connector that uses `mysql2/promise` directly (no Knex dependency). Backtick-quoted identifiers; transactions check out a single pooled connection; `batchInsert` does one bulk `INSERT` and re-fetches via the consecutive-id expansion trick (MySQL has no `RETURNING`); `updateAll`/`deleteAll` capture matching rows up-front via `SELECT`. Schema DSL emits InnoDB tables with utf8mb4. Validated with shared `runModelConformance` against a real MySQL 8 service container in CI.
- New `@next-model/mariadb-connector` package: thin extension of `mysql-connector` that exploits MariaDB's `RETURNING *` for `INSERT` (10.5+) and `DELETE` (10.0+) to skip the up-front SELECT capture and the consecutive auto-increment id-expansion that MySQL needs. `updateAll` falls through to the parent (MariaDB has no `UPDATE … RETURNING`). Also emits `LONGTEXT CHECK (JSON_VALID(...))` for `t.json(...)` columns since MariaDB's JSON is an alias for LONGTEXT. Validated against a real MariaDB 11 service container in CI. Required exposing a few `MysqlConnector` internals (`run`, `runMutation`, `buildWhere`, `quoteIdent`) to subclasses — no behavior change.
- New `@next-model/mongodb-connector` package: native MongoDB connector using the official `mongodb` driver. Each table maps to a MongoDB collection; `_nm_schemas` and `_nm_counters` track table existence and per-table auto-increment counters. Filter operators compile to native MongoDB query language (`$in`/`$nin`/`$gte`/`$lte`/regex for `$like`/etc.); `$raw` accepts a JSON-encoded mongo filter document as an escape hatch. Transactions are snapshot/restore (single-node mongo can't do real multi-doc tx). Validated with shared `runModelConformance` against a real MongoDB 7 service container in CI.
- New `@next-model/redis-connector` package: targets Redis via `node-redis`. Each row is a HASH (column → JSON-encoded value), each table has a ZSET of ids (used for ordered iteration), and table existence is tracked via a `:meta` key. Filters / aggregates are evaluated client-side via core's `filterList`. Transactions snapshot every table at block start and restore on throw (matches the in-memory connector's semantics — not Redis `MULTI/EXEC`). Validated with shared `runModelConformance` against a real Redis 7 service container in CI.
- New `@next-model/valkey-connector` package: thin extension of `redis-connector` for apps targeting Valkey. Currently identical in behaviour (Valkey is wire-compatible with the Redis protocol); exists as its own publishable name so apps can pin the right database and pick up Valkey-specific overrides as they emerge (Valkey 8.x JSON / vector / clustering features).
- `@next-model/redis-connector` / `@next-model/valkey-connector` now have a primary-key fast path: `find(id)` / `filterBy({id: value})` / `filterBy({$in: {id: [...]}})` dispatch to direct `HGETALL` on the known row key(s) instead of loading the whole table via `ZRANGE` + scan. O(k) in ids requested, regardless of table size.
- Renamed `@next-model/data-api-connector` to **`@next-model/aurora-data-api-connector`**. The package always targeted the AWS Aurora Serverless v1 RDS Data API specifically — the new name makes that explicit and clears the `data-api` namespace for future, unrelated "data API" connectors. Directory moved to `packages/aurora-data-api-connector/`; CI filter / job names updated to match. No runtime behaviour change. Apps depending on the old name need to update their `package.json`.

### Adapter packages

- New `@next-model/express-rest-api` package: Express 5 REST adapter that turns any Model into a REST resource with eight default actions (`index`, `show`, `create`, `update`, `delete`, `count`, `first`, `last`). Per-action + global `authorize` callbacks; per-row `serialize` + full-envelope `envelope` response mappers; `NotFoundError`→404 / `ValidationError`→422 / `UnauthorizedError`→401 / `BadRequestError`→400 error mapping; query param parsing for `filter` (JSON or bracket), `order` (CSV, `-` prefix for desc), `limit`/`skip`, `page`/`perPage`, and cursor-mode `after`/`before` (opt-in via presence). Replaces the long-unmaintained `@next-model/api-router` + `@next-model/api-server-express` packages (now deleted). Ships with `demos/express-rest-api-node` exercising every hook.
- `@next-model/express-rest-api` now ships `buildOpenApiDocument(...)` — a plain-object OpenAPI 3.1 generator with no external deps. Pass a list of resources (name, basePath, field map, optional action subset) and get back a document you can serve from `GET /openapi.json`. Generated schemas: `<Name>`, `<Name>CreateInput`, `<Name>UpdateInput`, `<Name>FilterInput`, `<Name>List` plus shared 400/401/404/422 `Error` responses on every operation. The field map is explicit (or derivable from the `@next-model/zod` / `typebox` / `arktype` bridges' `describeColumns()` output).
- New `@next-model/graphql-api` package: GraphQL schema generator that turns any Model into a resource with six default operations (`list`, `get`, `count`, `create`, `update`, `delete`). `buildModelResource({ Model, name, fields, ... })` returns `{ typeDefs, resolvers }` for drop-in use with `@graphql-tools/schema` / Yoga / Apollo / graphql-http; `composeSchema([resources])` merges multiple resources into one bundle. Per-operation + global `authorize` hooks (`UnauthorizedError` → `extensions.code = 'UNAUTHORIZED'`); per-row `serialize`; generated input types for filter (each field optional), order (`[{ key, dir: ASC | DESC }]`), create, update (every field optional); offset pagination (`page` / `perPage`) or cursor pagination (`after` / `before`) via the existing `Model.paginate` / `Model.paginateCursor` primitives. Shipped with `demos/graphql-api-node` exercising the full flow through `graphql-http` on Express 5.
- New `@next-model/nextjs-api` package: Next.js App Router adapter. `createCollectionHandlers(Model, options)` + `createMemberHandlers(Model, options)` produce `{ GET, POST }` / `{ GET, PATCH, DELETE }` exports with the same hook surface as `@next-model/express-rest-api` (per-action + global `authorize`, per-row `serialize`, full-envelope `envelope`, `NotFoundError`→404 / `ValidationError`→422 / `UnauthorizedError`→401 / `BadRequestError`→400). Works against Next 14 (sync `params`) and Next 15 (promise-wrapped `params`) from a single export. Depends only on the web-standard `Request` / `Response` globals, so it also works from any Node 18+ runtime.
- New `@next-model/migrations-generator` package: CLI (`nm-generate-migration`) + programmatic API (`generateMigration`, `writeMigration`) for scaffolding `@next-model/migrations` files. Timestamped filenames with millisecond resolution, optional `--create-table` body with typed column specs, `--parent` for the dependency-graph runner, safe against overwriting (`wx` flag).
- `@next-model/migrations` now ships a `SchemaCollector` wrapper that mirrors `createTable` / `dropTable` DDL into a machine-readable `SchemaSnapshot`. `collector.writeSchema(path)` persists it as JSON after `migrate()` so downstream tooling (GraphQL / REST / OpenAPI generators, form builders, admin UIs) can consume the schema instead of re-declaring field sets by hand. Rollbacks drop tables from the snapshot, so the file always reflects what's currently applied.
- New `@next-model/zod` package: `fromZod(objectSchema)` bridges a single zod schema into a Model's `init` (parses + throws `ValidationError` with formatted issue list), the `validators: [...]` entry (boolean-valued), and the schema-DSL `createTable` columns (`applyColumns(t)`). Classifies zod primitives to `string` / `integer` / `float` / `boolean` / `datetime` / `json`; `.optional()` / `.nullable()` / `.default()` flow through as `null: true` / `default: value`. Class-name sniffing keeps the bridge compatible with both zod 3 and zod 4.
- New `@next-model/typebox` package: `fromTypeBox(objectSchema)` bridges a single TypeBox `TObject` into a Model's `init` (applies `Value.Default` + `Value.Check`, throws `ValidationError` with formatted errors), validator, and schema-DSL columns. Same surface as `@next-model/zod`.
- New `@next-model/arktype` package: `fromArkType(type)` bridges an arktype `type({...})` into the Model's `init` (throws `ValidationError` with `ArkErrors.summary`), validator, and schema-DSL columns. Reads arktype's stable public `type.json` projection; detects booleans (`[{unit:false},{unit:true}]`) and integers (`divisor: 1`) from the tagged tree.

### Demos

- New `demos/` directory with self-contained, runnable scripts. First wave covers the zero-infrastructure connectors: `demos/memory-node`, `demos/sqlite-node`, `demos/local-storage-node`. Each demo is a single `demo.ts` you run with `pnpm start` (Node's experimental type-stripping does the TypeScript work — no `tsx` / `ts-node` dependency).
- Added native-SQL demos under `demos/`: `postgres-node`, `mysql-node`, `mariadb-node`. Each ships a `docker-compose.yml` so `pnpm db:up && pnpm start` is the full path. The `mariadb-node` demo highlights the parts of the connector that diverge from `mysql-node` (RETURNING for INSERT/DELETE, `LONGTEXT CHECK (JSON_VALID(...))` for `t.json`, no UPDATE…RETURNING).
- Added native non-SQL demos under `demos/`: `redis-node` (HASH-per-row layout, client-side filter eval, snapshot transactions), `valkey-node` (wire-compatibility with Redis, identical surface), `mongodb-node` (filter-DSL → native mongo query language, `$raw` escape hatch for `$elemMatch`-style operators).
- Added the final node demos: `demos/knex-node` (sqlite default, env-switchable to pg/mysql via docker-compose profiles) and `demos/aurora-data-api-node` (uses the new `/mock-client` sub-export so it runs without AWS credentials).
- Added `demos/react-todo`: a React 19 + Vite UI on top of `@next-model/local-storage-connector`. Multi-user todos via per-user `prefix:` switching; uses React 19's `use(promise)` hook with `<Suspense>` for the loading state. Pure browser demo — no backend.
- Added `demos/nextjs-todo`: a Next.js 15 App Router UI on top of `@next-model/sqlite-connector`. Server components call the connector directly (no API route); server actions handle every mutation via `revalidatePath('/')`. Multi-user via a `nm-todo-user` cookie + `Task.userId → User.id` foreign key; SQLite file lives under `./.data/` and the connector is cached on `globalThis` so `next dev` HMR doesn't reopen it.
- `demos/` restructured into `demos/<runtime>/<name>` (`node` / `react` / `nextjs`). Old paths like `demos/memory-node` moved to `demos/node/memory`, `demos/react-todo` → `demos/react/todo`, `demos/nextjs-todo` → `demos/nextjs/todo`, etc. Package names (which are all private) are unchanged; pnpm workspace globs updated (`demos/node/*`, `demos/react/*`, `demos/nextjs/*`).
- `demos/react/todo` rewritten. Single shared `LocalStorageConnector` (no more per-user prefix switching) with two Models — `User` and `Task` — linked by a `userId` foreign key. New UI: user CRUD (add / inline rename / delete with task cascade), per-task toggle / delete, optimistic updates on by default with a togglable checkbox. Mutations produce state deltas instead of full-list reloads; the whole list never reloads on a single toggle or add. Keyboard affordances (Enter / Esc during rename) and a transient error banner for failed persistence. Old `nm-todo:<user>:*` localStorage data is left untouched — the new demo writes to `nm-todo-v2:` so existing installs don't need a migration.
- `demos/nextjs/todo` overhaul: adds user CRUD (create / inline rename / cascading delete) and wraps the server-rendered lists in client components using `useOptimistic` so inserts, toggles and deletes show up before the `revalidatePath` round-trip completes. Deleting the signed-in user clears the `nm-todo-user` cookie. Styles moved out of inline `style` props into a plain `globals.css`.
- `demos/node/` split into `server/` (DB drivers / Express / GraphQL / native modules) and `client/` (pure-JS connectors that also work in a browser: `memory`, `local-storage`). New `demos/nextjs/api` — a Next.js 15 App Router app that exposes a REST resource via `@next-model/nextjs-api` route handlers (per-action auth, sqlite-backed) alongside the existing `demos/nextjs/todo`. pnpm workspace globs updated (`demos/node/server/*`, `demos/node/client/*`). Every demo README — including `nextjs/todo` — now points at the `pnpm rebuild better-sqlite3` fix for the `NODE_MODULE_VERSION` mismatch users hit when the native binding was compiled against a different Node version than the one running `next dev`.
- Every package README now shows an `npm install` alternative underneath the `pnpm add` snippet. pnpm remains the recommended / documented-first option across the monorepo; the comment form makes it copy-pastable for users who aren't on pnpm.
- Demo cleanup. Every demo now has a `pre*` hook (`prestart` for node demos, `predev` / `prebuild` / `prestart` for react / nextjs demos) that runs the new root `build:packages` script — building all packages in `./packages/*` so demos with workspace `workspace:*` deps just work after `pnpm install` without a manual rebuild step. Each node demo gets a `tsconfig.json` (extending the new `demos/node/tsconfig.base.json`), `@types/node`, `typescript`, and a `typecheck` script; `react/todo` gets a `typecheck` script too. Fixed the TS errors that surfaced once typecheck ran: `react/todo` `.tsx` / `.ts` import extensions removed (vite was tolerant, `tsc` is not), `node/server/graphql-api` `Ctx` made compatible with `graphql-http`'s `OperationContext` (object-literal type so the index signature is inferred), and `node/client/memory`'s `scopes` callback parameter typed as `any` (matches the conformance pattern). New root `typecheck:demos` script runs `tsc --noEmit` across all 16 demos.

### Tooling

- Converted to a pnpm monorepo; `@next-model/core` lives under `packages/core` alongside `knex-connector` and `data-api-connector`.
- Migrated test runner from jest to vitest (now on vitest 4).
- Migrated linter/formatter from prettier + eslint to biome (now on biome 2).
- Replaced Travis CI with GitHub Actions (typecheck + lint + tests on every branch/PR).
- Bumped toolchain to TypeScript 6, `@types/node` 25, and `@vitest/coverage-v8` 4 across every package. Knex connectors moved to knex 3 (from 0.19); the `data-api-client` dependency jumped to 2.x. `lib`/`target` raised to `ES2023` and `structuredClone` is now sourced via `@types/node` globals. Removed the dead `faker` / `@types/faker` / `@types/knex` dev deps (faker was never used; knex bundles its own types since 0.95). `pnpm audit` reports zero vulnerabilities.
- Build modernization: every package is now pure ESM (`"type": "module"`, `exports` field, `.js` extensions on relative imports) built with `module: NodeNext`. Dropped the `tsc-mjs` dual-build. `dist/` is no longer tracked in git and is rebuilt via `pnpm build` / `prepublishOnly`.
- Shared `runModelConformance` test helper (`@next-model/conformance`) gives every connector the same Model-level CRUD/Query/Transactions/Schema-DSL coverage. Wired into MemoryConnector, KnexConnector (sqlite/pg/mysql) and LocalStorageConnector specs. CI now runs `pnpm -r coverage` and each package's vitest config enforces coverage thresholds.
- `runModelConformance` widened to cover Model-level features: `createMany`, `reload`, bulk `updateAll` / `deleteAll`, `first`/`last`/`exists`, `pluck`/`pluckUnique`/`ids`, `paginate`, `inBatchesOf`, `findEach`, `countBy`/`groupBy`, find variants (`findOrFail`, `findOrBuild`, `firstOrCreate`, `updateOrCreate`), dirty tracking (`isChanged`, `changes`, `revertChange`, `savedChanges`/`wasChanged`), validators + lifecycle callbacks + `Model.on`, soft delete (`discard`/`restore`/`withDiscarded`/`onlyDiscarded`), named scopes, and `belongsTo`/`hasMany` associations. Each connector's spec runs the full suite, so every supported language feature is now exercised against each backend.
- Conformance suite gained a "Builder pipeline" section that exercises the chainable query builders end-to-end on every connector: `User.findBy({...}).todos` parent-scope traversal, two-hop `Order.first().customer.address` belongsTo chains, `filterBy({col: <CollectionQuery>})` / `filterBy({col: <ColumnQuery.pluck>})` / `filterBy({$gt: {col: <ScalarQuery.sum>}})` subquery-as-filter-value shapes, and the `attributes` getter's JSON round-trip (no association accessor leakage).
- Schema DSL: `ColumnOptions.autoIncrement` now generates `t.increments(...)` on KnexConnector, so a table created via the DSL works with `KeyType.number` Models out of the box.
- KnexConnector: `deleteAll`/`updateAll` no longer apply `limit`/`skip` to the underlying knex builder, fixing a sqlite "limit has no effect on a delete" error when the Model layer sets `limit: 1` on its single-row scope.
- Repository documentation overhaul: new top-level `README.md`, fully rewritten READMEs for `knex-connector`, `data-api-connector`, `local-storage-connector`, and a new `migrations` README. Each connector README maps every relevant Model feature (filters, transactions, batchInsert, schema DSL, …) to that connector's specifics.
- Fixed an ESM-runtime regression in `@next-model/knex-connector` and `@next-model/aurora-data-api-connector`: both packages used `import { knex as createKnex } from 'knex'`, which compiled cleanly under TypeScript's `esModuleInterop` but failed at runtime under Node ESM (`SyntaxError: Named export 'knex' not found. … 'knex' is a CommonJS module`). Switched to the portable default-import + destructure shape (`import knexPkg from 'knex'; const createKnex = knexPkg.knex;`). Tests caught nothing because vitest's bundler synthesises the named exports — only real Node ESM consumers (the new demos) hit it.
- `@next-model/aurora-data-api-connector` now exposes `MockDataApiClient` as a public `/mock-client` sub-export. Apps targeting Aurora Serverless v1 can develop locally against the same `DataApiClient` interface (executes via in-memory sqlite + knex) without an AWS account. The class moved out of `src/__mocks__/` into `src/`; it's no longer test-only.
- CI: documentation-only PRs (README.md, HISTORY.md changes) now skip every job. Each per-package paths-filter gained a `!**/*.md` exclusion, and a new `code` filter (any non-markdown source change) gates the `validate` job. Outcome: a typo-fix PR runs only the `changes` job + an empty `coverage-report`.
- Cleaned up stale per-package `.nvmrc` files (each pinned to Node 4.3.2 / 8.10). The root `.nvmrc` (Node 22 LTS) is now the single source of truth; per-package overrides were redundant since CI sets the node version explicitly per job.
- CI: bump every GitHub Action to its current major: `actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `dorny/paths-filter@v4`, `marocchino/sticky-pull-request-comment@v3`, `pnpm/action-setup@v5`. The latter now picks up the pinned pnpm version from the root `packageManager` field automatically.
- CI: every package now has its own dedicated job (`test-core`, `test-knex-connector`, `test-data-api-connector`, `test-local-storage-connector`, `test-sqlite-connector`, `test-migrations`, plus the seven existing native-DB jobs). Failures surface against the responsible package name in the GitHub UI instead of being lumped into a single combined "test" log. The previous workspace-wide `test` job was renamed to `validate` and now only runs lint + build + typecheck (still on the Node 22 + 24 matrix). Each per-package job is gated on its paths-filter output (`core`/`<package>`/`ci`).
- CI: per-package real-database jobs are now skipped when nothing they depend on has changed. A new `changes` job fronts the workflow and uses `dorny/paths-filter` to detect which package directories were touched; each `test-<connector>` job is gated on `changes.outputs.<connector> || changes.outputs.core || changes.outputs.ci`. Documentation-only PRs (READMEs, HISTORY) now skip every real-DB job, cutting CI runtime to ~40s. The main `test` job (lint + build + typecheck + in-memory coverage) still always runs.
- CI now posts a sticky coverage report on every PR. Each per-package coverage job uploads its `coverage-summary.json` as an artifact; a final `coverage-report` job downloads them all, renders a markdown table (per-package statements / branches / functions / lines %), and either creates or updates the comment via `marocchino/sticky-pull-request-comment`. Vitest configs gained `reporter: ['text', 'json-summary']` so the JSON is emitted alongside the existing text output.

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

- `attributes` (getter), `toJSON()`, `pick(keys)`, `omit(keys)` with typed overrides in the factory subclass.

### Validators

- Static `validators: Validator[]` array on the factory.
- Instance `isValid()` runs every validator and populates `record.errors`.
- `save()` throws `ValidationError` (with structured `.errors` payload) when any validator returns `false`.

### Lifecycle callbacks

- Factory `callbacks: { beforeSave, afterSave, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete }`.
- Dynamic subscription via `Model.on(event, handler)` returning an unsubscribe function. Composes with factory-declared callbacks (factory fires first, then dynamic subscribers in registration order).

### Timestamps

- Automatic `createdAt` on insert and `updatedAt` on every save, controlled by the `timestamps` factory flag (defaults to `true`). User-supplied values on insert are preserved.

### Associations

- Declarative `associations: { name: { belongsTo|hasMany|hasOne|hasManyThrough, foreignKey?, primaryKey?, polymorphic? } }` factory option (see "Associations" section above for the full surface).
- Each declared name installs a chainable instance accessor (`record.posts` returns a `CollectionQuery<Post>`, `record.author` an `InstanceQuery<User | undefined>`).
- Options per spec: `foreignKey`, `primaryKey`, `throughForeignKey`, `targetForeignKey`, `selfPrimaryKey`, `targetPrimaryKey`, `polymorphic`, `typeKey`, `typeValue`.
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
