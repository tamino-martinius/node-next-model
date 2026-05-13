# History

## vNext

## v1.0.0

- Inherits `Connector.reflectSchema()` from `MysqlConnector`. MariaDB exposes the same `information_schema` views (`TABLES`, `COLUMNS`, `STATISTICS`) with the same column shapes, so the parent's introspection path works without any MariaDB-specific override. Returns one `TableDefinition` per base table in the current `DATABASE()` with column kinds, primary key, indexes, and `auto_increment` flags mapped back through the same MySQL type mapping (`tinyint(1)` → `boolean`, etc.). Pairs with `generateSchemaSource` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.
- Inherits `Connector.queryWithJoins(spec)` from `MysqlConnector` — MariaDB's wire-compatible `mysql2` driver and identical SQL surface mean the EXISTS / NOT EXISTS / batched-IN paths work without any MariaDB-specific override. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` natively.
- Inherits `Connector.queryScoped(spec)` from `MysqlConnector` — same nested `WHERE col IN (SELECT …)` shape, identifier quoting, and projection routing. Powers promise-like chainable query builders (`User.where(...).pluck('email')`, `Order.where(...).sum('total')`, parent-scoped chains like `user.todos.where(...)`) on MariaDB without any MariaDB-specific override.

### Native UPSERT
- Overrides the parent's `upsert` to use MariaDB's `INSERT … ON DUPLICATE KEY UPDATE … RETURNING *` (10.5+). RETURNING only emits inserted rows, so updates / `IGNORE`-skipped rows are backfilled via a single follow-up `SELECT`. Returns rows in input order.

### Initial release

- New `@next-model/mariadb-connector` package: thin extension of `@next-model/mysql-connector` that takes advantage of MariaDB-specific features.
- Reuses the `mysql2/promise` driver (wire-compatible with MariaDB), the same connection pool, identifier quoting, filter compilation, and transaction handling as the MySQL connector.
- Overrides `batchInsert` to use `INSERT … RETURNING *` (MariaDB 10.5+) and `deleteAll` to use `DELETE … RETURNING *` (MariaDB 10.0+), so those methods skip the up-front `SELECT` capture and the consecutive auto-increment id-expansion trick the MySQL connector needs. `updateAll` is **not** overridden — MariaDB does not support `UPDATE … RETURNING`, so it falls through to the parent's SELECT-then-UPDATE implementation.
- Overrides `createTable` for the `json` column kind: MariaDB's `JSON` is an alias for `LONGTEXT`, so the connector emits `LONGTEXT CHECK (JSON_VALID(...))` to keep the validation guarantee MySQL's native `JSON` provides.
- Validated through the shared `runModelConformance` suite + RETURNING-specific tests against a real MariaDB 11 service container in CI.
