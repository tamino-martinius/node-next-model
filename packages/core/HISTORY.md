# History

## vNext

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

- New `enums: { status: ['draft', 'published'] as const }` factory option for typed enum columns. Each value becomes a chainable class scope (`Post.draft()` → filtered scope, composes with `.filterBy` / `.orderBy` / `.limitBy`) plus an instance predicate (`post.isPublished()`). Snake_case values map to camelCase scopes / PascalCase predicates (`'in_review'` → `Item.inReview()` / `item.isInReview()`). The full list per column is exposed as `Post.statusValues` (readonly array). A built-in validator rejects out-of-range values at `isValid()` / `save()` time; collisions with existing static or prototype methods throw at factory construction so accidents surface immediately. Also exports the `camelize` / `pascalize` helpers powering the name resolution.
- `SqliteConnector` now round-trips nested objects and arrays in `t.json(...)` columns automatically. Previously passing an object to `batchInsert` or `update` would fail at the `better-sqlite3` binding ("cannot bind type"); now those values are serialized to JSON text on insert / update and parsed back on query / select. The connector tracks JSON column metadata per table at `createTable` time; reconnecting to an existing file without calling `createTable` will return raw strings (the DDL type would be `TEXT` either way — sqlite has no native JSON type). Other connectors were already JSON-safe: memory / local-storage / redis serialize transparently, and pg / mysql2 / mariadb-connector round-trip `JSON` / `JSONB` columns through their native JSON path.
- Schema DSL: new `t.references(name, options?)` shortcut. Declares an integer foreign-key column (`<name>Id` by default, overridable via `column`) and — unless `index: false` is passed — adds an index on it in one call. Rails-style ergonomics for the common join-column case. The generated column + index flow through every existing connector unchanged (they already honour `columns` and `indexes` from the table definition); the MongoDbConnector now also honours declared indexes by calling `collection.createIndex` at table-create time.
- Every package README now shows an `npm install` alternative underneath the `pnpm add` snippet. pnpm remains the recommended / documented-first option across the monorepo; the comment form makes it copy-pastable for users who aren't on pnpm.
- `demos/nextjs/todo` overhaul: adds user CRUD (create / inline rename / cascading delete) and wraps the server-rendered lists in client components using `useOptimistic` so inserts, toggles and deletes show up before the `revalidatePath` round-trip completes. Deleting the signed-in user clears the `nm-todo-user` cookie. Styles moved out of inline `style` props into a plain `globals.css`.
- `demos/react/todo` rewritten. Single shared `LocalStorageConnector` (no more per-user prefix switching) with two Models — `User` and `Task` — linked by a `userId` foreign key. New UI: user CRUD (add / inline rename / delete with task cascade), per-task toggle / delete, optimistic updates on by default with a togglable checkbox. Mutations produce state deltas instead of full-list reloads; the whole list never reloads on a single toggle or add. Keyboard affordances (Enter / Esc during rename) and a transient error banner for failed persistence. Old `nm-todo:<user>:*` localStorage data is left untouched — the new demo writes to `nm-todo-v2:` so existing installs don't need a migration.
- New `Model.includes({ assoc: ... })` chainable for eager loading associations. Each entry names the property attached to returned instances and how to load it — `belongsTo`, `hasMany`, or `hasOne`. Runs a single batched query per association via the existing `preloadBelongsTo` / `preloadHasMany` primitives, cutting the N+1 round-trips you'd get from calling `this.user` / `this.posts` on every row. Instance-level `this.belongsTo(User)` / `this.hasMany(Post)` continue to return a `Promise` — the Rails-style lazy path — so pages that don't opt in still work unchanged. `Model.withoutIncludes()` and `unscoped()` both clear the eager-load chain.
- `@next-model/migrations` now ships a `SchemaCollector` wrapper that mirrors `createTable` / `dropTable` DDL into a machine-readable `SchemaSnapshot`. `collector.writeSchema(path)` persists it as JSON after `migrate()` so downstream tooling (GraphQL / REST / OpenAPI generators, form builders, admin UIs) can consume the schema instead of re-declaring field sets by hand. Rollbacks drop tables from the snapshot, so the file always reflects what's currently applied.
- `@next-model/redis-connector` / `@next-model/valkey-connector` now have a primary-key fast path: `find(id)` / `filterBy({id: value})` / `filterBy({$in: {id: [...]}})` dispatch to direct `HGETALL` on the known row key(s) instead of loading the whole table via `ZRANGE` + scan. O(k) in ids requested, regardless of table size.
- Filter operators now accept the more idiomatic column-first shape: `filterBy({ age: { $gt: 18 } })` / `filterBy({ status: { $in: ['open', 'pending'] } })` / `filterBy({ name: { $not: 'john' } })` in addition to the legacy `filterBy({ $gt: { age: 18 } })` shape. Multi-op column maps (`{ age: { $gt: 18, $lt: 65 } }`) are expanded into a top-level `$and`. `$and` / `$or` / `$not` / `$raw` / `$async` continue to live at the top level (and still nest into child filters). Normalization happens at the `filterBy` / `orFilterBy` entry points so every connector keeps seeing the existing internal shape — no connector changes required. Exported as `normalizeFilterShape(filter)` for anyone composing filters by hand.
- New `Model.fields(...keys)` chainable for partial fetches — restricts `all()` / `first()` / `last()` / `find()` / `findBy()` to the listed columns while still returning Model instances. Primary key(s) are always included even when not in the list so instances can still `save` / `reload` / `delete`. `allFields()` undoes the restriction; `unscoped()` also clears it. Built on top of the existing `Connector.select(scope, ...keys)` primitive — no connector changes required.
- `demos/node/` split into `server/` (DB drivers / Express / GraphQL / native modules) and `client/` (pure-JS connectors that also work in a browser: `memory`, `local-storage`). New `demos/nextjs/api` — a Next.js 15 App Router app that exposes a REST resource via `@next-model/nextjs-api` route handlers (per-action auth, sqlite-backed) alongside the existing `demos/nextjs/todo`. pnpm workspace globs updated (`demos/node/server/*`, `demos/node/client/*`). Every demo README — including `nextjs/todo` — now points at the `pnpm rebuild better-sqlite3` fix for the `NODE_MODULE_VERSION` mismatch users hit when the native binding was compiled against a different Node version than the one running `next dev`.

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
- Fixed an ESM-runtime regression in `@next-model/knex-connector` and `@next-model/aurora-data-api-connector`: both packages used `import { knex as createKnex } from 'knex'`, which compiled cleanly under TypeScript's `esModuleInterop` but failed at runtime under Node ESM (`SyntaxError: Named export 'knex' not found. … 'knex' is a CommonJS module`). Switched to the portable default-import + destructure shape (`import knexPkg from 'knex'; const createKnex = knexPkg.knex;`). Tests caught nothing because vitest's bundler synthesises the named exports — only real Node ESM consumers (the new demos) hit it.
- `@next-model/aurora-data-api-connector` now exposes `MockDataApiClient` as a public `/mock-client` sub-export. Apps targeting Aurora Serverless v1 can develop locally against the same `DataApiClient` interface (executes via in-memory sqlite + knex) without an AWS account. The class moved out of `src/__mocks__/` into `src/`; it's no longer test-only.
- Added the final node demos: `demos/knex-node` (sqlite default, env-switchable to pg/mysql via docker-compose profiles) and `demos/aurora-data-api-node` (uses the new `/mock-client` sub-export so it runs without AWS credentials).
- Added native non-SQL demos under `demos/`: `redis-node` (HASH-per-row layout, client-side filter eval, snapshot transactions), `valkey-node` (wire-compatibility with Redis, identical surface), `mongodb-node` (filter-DSL → native mongo query language, `$raw` escape hatch for `$elemMatch`-style operators).
- Added native-SQL demos under `demos/`: `postgres-node`, `mysql-node`, `mariadb-node`. Each ships a `docker-compose.yml` so `pnpm db:up && pnpm start` is the full path. The `mariadb-node` demo highlights the parts of the connector that diverge from `mysql-node` (RETURNING for INSERT/DELETE, `LONGTEXT CHECK (JSON_VALID(...))` for `t.json`, no UPDATE…RETURNING).
- New `demos/` directory with self-contained, runnable scripts. First wave covers the zero-infrastructure connectors: `demos/memory-node`, `demos/sqlite-node`, `demos/local-storage-node`. Each demo is a single `demo.ts` you run with `pnpm start` (Node's experimental type-stripping does the TypeScript work — no `tsx` / `ts-node` dependency).
- New `paginateCursor({ after?, before?, limit? })` chainable on every Model. Cursor-based ("keyset") pagination over the primary key; avoids the `O(skip)` cost of `.paginate()`'s LIMIT/OFFSET path so it stays cheap on large tables. Cursors are opaque base64-url-encoded JSON of the boundary row's primary key. Returns `{ items, nextCursor?, prevCursor?, hasMore }`. `nextCursor` is set only when `hasMore`; `prevCursor` whenever items are present. Wired through every connector by the existing `$gt` / `$lt` filter primitives — no connector changes required.
- `@next-model/express-rest-api` now ships `buildOpenApiDocument(...)` — a plain-object OpenAPI 3.1 generator with no external deps. Pass a list of resources (name, basePath, field map, optional action subset) and get back a document you can serve from `GET /openapi.json`. Generated schemas: `<Name>`, `<Name>CreateInput`, `<Name>UpdateInput`, `<Name>FilterInput`, `<Name>List` plus shared 400/401/404/422 `Error` responses on every operation. The field map is explicit (or derivable from the `@next-model/zod` / `typebox` / `arktype` bridges' `describeColumns()` output).
- New `@next-model/arktype` package: `fromArkType(type)` bridges an arktype `type({...})` into the Model's `init` (throws `ValidationError` with `ArkErrors.summary`), validator, and schema-DSL columns. Reads arktype's stable public `type.json` projection; detects booleans (`[{unit:false},{unit:true}]`) and integers (`divisor: 1`) from the tagged tree.
- New `@next-model/typebox` package: `fromTypeBox(objectSchema)` bridges a single TypeBox `TObject` into a Model's `init` (applies `Value.Default` + `Value.Check`, throws `ValidationError` with formatted errors), validator, and schema-DSL columns. Same surface as `@next-model/zod`.
- New `@next-model/zod` package: `fromZod(objectSchema)` bridges a single zod schema into a Model's `init` (parses + throws `ValidationError` with formatted issue list), the `validators: [...]` entry (boolean-valued), and the schema-DSL `createTable` columns (`applyColumns(t)`). Classifies zod primitives to `string` / `integer` / `float` / `boolean` / `datetime` / `json`; `.optional()` / `.nullable()` / `.default()` flow through as `null: true` / `default: value`. Class-name sniffing keeps the bridge compatible with both zod 3 and zod 4.
- `demos/` restructured into `demos/<runtime>/<name>` (`node` / `react` / `nextjs`). Old paths like `demos/memory-node` moved to `demos/node/memory`, `demos/react-todo` → `demos/react/todo`, `demos/nextjs-todo` → `demos/nextjs/todo`, etc. Package names (which are all private) are unchanged; pnpm workspace globs updated (`demos/node/*`, `demos/react/*`, `demos/nextjs/*`).
- `timestamps` now accepts per-column control. In addition to `true` / `false` you can now pass `{ createdAt?: boolean | string; updatedAt?: boolean | string }` to enable only one of the two timestamps or to rename the columns (e.g. `timestamps: { createdAt: 'inserted_at', updatedAt: false }`). Exposed as `ModelClass.createdAtColumn` / `updatedAtColumn`; `touch()` now throws a `PersistenceError` when the Model has no `updatedAt` column.
- `softDelete` now accepts a column-name override. In addition to `true` / `false` you can now pass a string (shorthand for the column) or `{ column?: string }` — e.g. `softDelete: 'deleted_at'`. `discard()` / `restore()` / `withDiscarded()` / `onlyDiscarded()` and the active-only default scope all key off the configured `ModelClass.softDeleteColumn`.
- **Fix**: `paginateCursor` now honours the chain's `orderBy` column. Previously it always filtered via `{ $gt/$lt: { id: ... } }`, which meant pages came back in primary-key order regardless of the order you'd chained. The cursor now keys off `this.order[0]` (falling back to the primary key when no order is set), flips `$gt`/`$lt` for descending orders, and always includes the primary key as a tie-breaker so rows with duplicated sort values paginate deterministically. Tokens produced by earlier versions keep decoding (the single-key shape is unchanged when the order is the primary key); tokens from ordered chains are composite (`{[orderKey]: ..., [primaryKey]: ...}`). `@next-model/express-rest-api`, `@next-model/graphql-api` and `@next-model/nextjs-api` all pick up the fix automatically since they delegate to `Model.paginateCursor`.
- New `@next-model/migrations-generator` package: CLI (`nm-generate-migration`) + programmatic API (`generateMigration`, `writeMigration`) for scaffolding `@next-model/migrations` files. Timestamped filenames with millisecond resolution, optional `--create-table` body with typed column specs, `--parent` for the dependency-graph runner, safe against overwriting (`wx` flag).
- New `@next-model/nextjs-api` package: Next.js App Router adapter. `createCollectionHandlers(Model, options)` + `createMemberHandlers(Model, options)` produce `{ GET, POST }` / `{ GET, PATCH, DELETE }` exports with the same hook surface as `@next-model/express-rest-api` (per-action + global `authorize`, per-row `serialize`, full-envelope `envelope`, `NotFoundError`→404 / `ValidationError`→422 / `UnauthorizedError`→401 / `BadRequestError`→400). Works against Next 14 (sync `params`) and Next 15 (promise-wrapped `params`) from a single export. Depends only on the web-standard `Request` / `Response` globals, so it also works from any Node 18+ runtime.
- New `@next-model/graphql-api` package: GraphQL schema generator that turns any Model into a resource with six default operations (`list`, `get`, `count`, `create`, `update`, `delete`). `buildModelResource({ Model, name, fields, ... })` returns `{ typeDefs, resolvers }` for drop-in use with `@graphql-tools/schema` / Yoga / Apollo / graphql-http; `composeSchema([resources])` merges multiple resources into one bundle. Per-operation + global `authorize` hooks (`UnauthorizedError` → `extensions.code = 'UNAUTHORIZED'`); per-row `serialize`; generated input types for filter (each field optional), order (`[{ key, dir: ASC | DESC }]`), create, update (every field optional); offset pagination (`page` / `perPage`) or cursor pagination (`after` / `before`) via the existing `Model.paginate` / `Model.paginateCursor` primitives. Shipped with `demos/graphql-api-node` exercising the full flow through `graphql-http` on Express 5.
- New `@next-model/express-rest-api` package: Express 5 REST adapter that turns any Model into a REST resource with eight default actions (`index`, `show`, `create`, `update`, `delete`, `count`, `first`, `last`). Per-action + global `authorize` callbacks; per-row `serialize` + full-envelope `envelope` response mappers; `NotFoundError`→404 / `ValidationError`→422 / `UnauthorizedError`→401 / `BadRequestError`→400 error mapping; query param parsing for `filter` (JSON or bracket), `order` (CSV, `-` prefix for desc), `limit`/`skip`, `page`/`perPage`, and cursor-mode `after`/`before` (opt-in via presence). Replaces the long-unmaintained `@next-model/api-router` + `@next-model/api-server-express` packages (now deleted). Ships with `demos/express-rest-api-node` exercising every hook.
- Added `demos/nextjs-todo`: a Next.js 15 App Router UI on top of `@next-model/sqlite-connector`. Server components call the connector directly (no API route); server actions handle every mutation via `revalidatePath('/')`. Multi-user via a `nm-todo-user` cookie + `Task.userId → User.id` foreign key; SQLite file lives under `./.data/` and the connector is cached on `globalThis` so `next dev` HMR doesn't reopen it.
- Added `demos/react-todo`: a React 19 + Vite UI on top of `@next-model/local-storage-connector`. Multi-user todos via per-user `prefix:` switching; uses React 19's `use(promise)` hook with `<Suspense>` for the loading state. Pure browser demo — no backend.
- Renamed `@next-model/data-api-connector` to **`@next-model/aurora-data-api-connector`**. The package always targeted the AWS Aurora Serverless v1 RDS Data API specifically — the new name makes that explicit and clears the `data-api` namespace for future, unrelated "data API" connectors. Directory moved to `packages/aurora-data-api-connector/`; CI filter / job names updated to match. No runtime behaviour change. Apps depending on the old name need to update their `package.json`.
- CI: documentation-only PRs (README.md, HISTORY.md changes) now skip every job. Each per-package paths-filter gained a `!**/*.md` exclusion, and a new `code` filter (any non-markdown source change) gates the `validate` job. Outcome: a typo-fix PR runs only the `changes` job + an empty `coverage-report`.
- Cleaned up stale per-package `.nvmrc` files (each pinned to Node 4.3.2 / 8.10). The root `.nvmrc` (Node 22 LTS) is now the single source of truth; per-package overrides were redundant since CI sets the node version explicitly per job.
- CI: bump every GitHub Action to its current major: `actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `dorny/paths-filter@v4`, `marocchino/sticky-pull-request-comment@v3`, `pnpm/action-setup@v5`. The latter now picks up the pinned pnpm version from the root `packageManager` field automatically.
- CI: every package now has its own dedicated job (`test-core`, `test-knex-connector`, `test-data-api-connector`, `test-local-storage-connector`, `test-sqlite-connector`, `test-migrations`, plus the seven existing native-DB jobs). Failures surface against the responsible package name in the GitHub UI instead of being lumped into a single combined "test" log. The previous workspace-wide `test` job was renamed to `validate` and now only runs lint + build + typecheck (still on the Node 22 + 24 matrix). Each per-package job is gated on its paths-filter output (`core`/`<package>`/`ci`).
- CI: per-package real-database jobs are now skipped when nothing they depend on has changed. A new `changes` job fronts the workflow and uses `dorny/paths-filter` to detect which package directories were touched; each `test-<connector>` job is gated on `changes.outputs.<connector> || changes.outputs.core || changes.outputs.ci`. Documentation-only PRs (READMEs, HISTORY) now skip every real-DB job, cutting CI runtime to ~40s. The main `test` job (lint + build + typecheck + in-memory coverage) still always runs.
- CI now posts a sticky coverage report on every PR. Each per-package coverage job uploads its `coverage-summary.json` as an artifact; a final `coverage-report` job downloads them all, renders a markdown table (per-package statements / branches / functions / lines %), and either creates or updates the comment via `marocchino/sticky-pull-request-comment`. Vitest configs gained `reporter: ['text', 'json-summary']` so the JSON is emitted alongside the existing text output.
- New `@next-model/mongodb-connector` package: native MongoDB connector using the official `mongodb` driver. Each table maps to a MongoDB collection; `_nm_schemas` and `_nm_counters` track table existence and per-table auto-increment counters. Filter operators compile to native MongoDB query language (`$in`/`$nin`/`$gte`/`$lte`/regex for `$like`/etc.); `$raw` accepts a JSON-encoded mongo filter document as an escape hatch. Transactions are snapshot/restore (single-node mongo can't do real multi-doc tx). Validated with shared `runModelConformance` against a real MongoDB 7 service container in CI.
- New `@next-model/valkey-connector` package: thin extension of `redis-connector` for apps targeting Valkey. Currently identical in behaviour (Valkey is wire-compatible with the Redis protocol); exists as its own publishable name so apps can pin the right database and pick up Valkey-specific overrides as they emerge (Valkey 8.x JSON / vector / clustering features).
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
