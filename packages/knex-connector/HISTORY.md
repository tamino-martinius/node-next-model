# History

## vNext

## v1.1.2

### Changed

- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`). Downstream consumers now install core alongside the connector — fixes the `Cannot find package '@next-model/core'` runtime error when only the connector was added to a project. Monorepo workspaces keep resolving the in-tree core via the existing `devDependencies` entry.

## v1.1.1

## v1.1.0

## v1.0.0

- Implements `Connector.reflectSchema()` for schema introspection, dispatching by `knex.client.config.client` to the matching dialect's introspection path: `sqlite3` / `better-sqlite3` use `PRAGMA` queries against `sqlite_master`; `pg` / `postgres` use `information_schema` + `pg_index` / `pg_class`; `mysql` / `mysql2` / `mariadb` use MySQL `information_schema`. Each branch mirrors what the corresponding native connector (`SqliteConnector`, `PostgresConnector`, `MysqlConnector`) returns, including auto-increment detection (`AUTOINCREMENT` keyword in SQLite DDL, `nextval(...)` in Postgres column defaults, `EXTRA = 'auto_increment'` in MySQL) and the type-table mappings (e.g., `tinyint(1)` → `boolean` on MySQL). Throws `PersistenceError` for any other Knex client name. Pairs with `generateSchemaSource` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.
- Implements the optional `Connector.queryWithJoins(spec)` capability: translates the `JoinQuerySpec` shape from `@next-model/core` into knex builder calls. `'select'` joins compile to `WHERE EXISTS (SELECT 1 FROM child WHERE child.<col> = parent.<col> AND <filter>)`; `'antiJoin'` to `WHERE NOT EXISTS (...)`; `'includes'` to a single batched `WHERE child.fk IN (parent_pks)` per association whose results are grouped by parent key in JS and attached under `__includes[attachAs]` on each parent row. Result rows for `'select'` / `'antiJoin'` are de-duplicated naturally because the parent query stays unjoined; `'includes'` adds zero cartesian rows. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` for callers that would otherwise pay the `$async` + `$notIn` round-trip.

Rewritten to match the current `@next-model/core` connector interface.

- Implements `Connector.alterTable(spec)`. Each op delegates to the matching `knex.schema.alterTable(t => …)` builder method (`t.string` / `t.alter` / `t.dropColumn` / `t.renameColumn` / `t.index` / `t.dropIndex` / `t.foreign` / `t.dropForeign` / `t.check` / `t.dropChecks`). Constraint defaults match the connector-agnostic `foreignKeyName(...)` / `indexName(...)` helpers exported from `@next-model/core`. `renameIndex` / `addCheckConstraint` / `removeCheckConstraint` require Knex ≥ 2.5 and throw a clear `PersistenceError` on older versions.

### Native UPSERT
- Implements the new optional `Connector.upsert(spec)` capability so `Model.upsert` / `Model.upsertAll` route through a single atomic `INSERT … ON CONFLICT … DO UPDATE` (pg / sqlite) or `ON DUPLICATE KEY UPDATE` (MySQL / MariaDB) statement instead of the SELECT + INSERT/UPDATE fallback. Honors `updateColumns` and `ignoreOnly` (`DO NOTHING` / `INSERT IGNORE`). Postgres uses `RETURNING *`; MySQL and SQLite issue a follow-up `SELECT` keyed by `conflictTarget`. SQLite chunks at 200 rows/statement (under `SQLITE_LIMIT_COMPOUND_SELECT`) inside one transaction; pg/mysql ship the whole batch in a single statement.

### Test matrix

- The connector spec is now driver-agnostic and runs against sqlite3 (default), Postgres 17, and MySQL 8. CI spins up real Postgres + MySQL service containers and runs the same suite under `KNEX_TEST_CLIENT=pg` / `KNEX_TEST_CLIENT=mysql2`. Local runs default to sqlite3 in-memory.
- Fixed `batchInsert` on MySQL: the driver only returns the first inserted id for a bulk `INSERT`, so the connector now expands `[firstId]` to `[firstId, firstId+1, …]` (safe under InnoDB's contiguous lock mode for a single statement) and re-fetches all rows. Previously only the first row of a multi-row batchInsert was returned.

### Filter operators
- Added `$like`, `$async`, and `$raw` on top of existing boolean/set/range/comparison operators.
- Consolidated `$gt`/`$gte`/`$lt`/`$lte` under a single `compareFilter` helper.
- All filter validation errors are now `FilterError` instances (no more string throws).

### Connector interface
- Implemented `aggregate(scope, kind, key)` driving `sum`/`min`/`max`/`avg` through a single query.
- Implemented `transaction(fn)` with nesting (inner calls join the outer Knex transaction via an `activeTransaction` instance field).
- Implemented `execute(query, bindings)` with driver-aware result normalization (sqlite3, postgres/pg, mysql array-of-arrays).
- Implemented `createTable(name, blueprint)`, `dropTable(name)`, and `hasTable(name)` by translating the core `TableBuilder` DSL into Knex schema-builder calls (runs on `activeTransaction.schema` when inside a transaction). Column kinds supported: `string`, `text`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `date`, `datetime`/`timestamp`, `json`.
- `updateAll` and `batchInsert` fall back to a re-fetch path when the driver doesn't support `.returning()` (sqlite3, mysql). `batchInsert` short-circuits the re-fetch when the primary key is `KeyType.manual` (caller-supplied).
- `count` coerces the driver's string/number result to a `number`.
- Persistence errors now throw `PersistenceError`.

### Tests
- Full test suite rewritten against vitest + sqlite3 `:memory:` covering all connector methods and filter operators.

## v0.?.?

Added CI for more databases
* `oracledb`

## v0.3.3

Updated next-model dependency to `v0.4.1`

## v0.3.2

Updated next-model dependency to `v0.4.0`

## v0.3.1

Updated next-model dependency to `v0.3.0`

## v0.3.0

Added Node 4 Support (minimum required node version: 4.3.2)

## v0.2.0

Added new query types for **Equation** and **Raw** Queries
* `$eq`
* `$lt`
* `$lte`
* `$gt`
* `$gte`
* `$raw`

## v0.1.0

Used next-model from npm instead of Github repo

## v0.0.4

Updated NextModel package to `v0.0.4`.
Added missing entries to documentation.

## v0.0.3

Added CI to prove that the connector is working with
* MySQL
* Postgres
* sqlite3

## v0.0.2

Added more complex query types:
* `$and`
* `$or`
* `$not`
* `$null`
* `$notNull`
* `$in`
* `$notIn`
* `$between`
* `$notBetween`

The queries for `and`, `or` and `not` are able to nest.

## v0.0.1

First release compatible with NextModel **0.0.1**.

Implements all connector functions.

Includes tests for sqlite3.
