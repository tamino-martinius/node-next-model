# History

## vNext

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

- Implements `Connector.alterTable(spec)`. PostgreSQL-style DDL routed through the Data API: `ALTER TABLE ADD/DROP/RENAME COLUMN`, `ALTER COLUMN ... TYPE` for `changeColumn`, `CREATE INDEX` / `DROP INDEX` / `ALTER INDEX RENAME TO` for index ops, and `ADD/DROP CONSTRAINT` for foreign keys + check constraints. Identifier validation runs on every name passed through to keep injection guarantees.

### Rewrite

- Full TypeScript rewrite on top of the modern `@next-model/core` `Connector` interface. Matches `KnexConnector` parity.
- Constructor accepts either an Aurora Data API config (`{ secretArn, resourceArn, database, debug? }`, delegated to `data-api-client`) or an injected `client` for testing/custom transports.

### Filter operators

- Boolean composition: `$and`, `$or`, `$not`.
- Set membership: `$in`, `$notIn`.
- Null checks: `$null`, `$notNull`.
- Range: `$between`, `$notBetween`.
- Comparisons: `$gt`, `$gte`, `$lt`, `$lte`.
- Pattern: `$like`.
- Lazy filter resolution: `$async`.
- Raw SQL + bindings: `$raw`.
- All filter validation raises `FilterError`.

### Connector surface

- `query`, `count`, `select`, `updateAll`, `deleteAll`, `batchInsert`, `aggregate(scope, kind, key)`, `execute(query, bindings)`, `transaction(fn)`.
- Positional `?` bindings in `execute` are translated to Aurora Data API `:paramN` placeholders.
- Nested `transaction(fn)` joins the outer transaction; outer rollback discards inner writes.
- `batchInsert` pre-fetches inserted rows by generated primary key so callers receive fully materialized rows.
- Implemented `createTable(name, blueprint)`, `dropTable(name)`, and `hasTable(name)` by emitting portable `CREATE TABLE IF NOT EXISTS` / `DROP TABLE IF EXISTS` SQL from the core `TableBuilder` DSL. `hasTable` probes with `SELECT 1 FROM <table> LIMIT 0` and catches the failure so the check works identically on Postgres/Aurora and the sqlite-backed mock.

### Testing

- Ships `MockDataApiClient` backed by sqlite3 via knex so test SQL actually executes end-to-end.
- Vitest suite covering all filter operators, aggregate kinds, transactions (commit/rollback/nested), `execute`, `batchInsert`, and error paths.

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
