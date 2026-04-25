# History

## vNext

- Implements the optional `supportsJoins` capability: `queryWithJoins(spec)` translates the `JoinQuerySpec` shape from `@next-model/core` into knex builder calls. `'select'` joins compile to `WHERE EXISTS (SELECT 1 FROM child WHERE child.<col> = parent.<col> AND <filter>)`; `'antiJoin'` to `WHERE NOT EXISTS (...)`; `'includes'` to a single batched `WHERE child.fk IN (parent_pks)` per association whose results are grouped by parent key in JS and attached under `__includes[attachAs]` on each parent row. Result rows for `'select'` / `'antiJoin'` are de-duplicated naturally because the parent query stays unjoined; `'includes'` adds zero cartesian rows. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` for callers that would otherwise pay the `$async` + `$notIn` round-trip.

Rewritten to match the current `@next-model/core` connector interface.

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
