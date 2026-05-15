# History

## vNext

## v1.1.6

## v1.1.5

## v1.1.4

## v1.1.2

### Changed

- `definitionFromOp` defaults `nullable` to `false` (matches the `@next-model/core` builder default, which also flipped in this release). Callers relying on the previous nullable-by-default behaviour must now pass `{ null: true }` explicitly.
- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`).

## v1.1.1

## v1.1.0

## v1.0.0

- Implements `Connector.reflectSchema()` for schema introspection. Reads `information_schema.TABLES` (filtered to `TABLE_SCHEMA = DATABASE()` and `TABLE_TYPE = 'BASE TABLE'`), `information_schema.COLUMNS` for column types / nullability / defaults / `VARCHAR(N)` limits / `DECIMAL(p,s)` precision and scale + `EXTRA = 'auto_increment'`, and `information_schema.STATISTICS` for primary key + unique / non-unique indexes. MySQL types map back to the connector's `ColumnKind`: `varchar(N)` → `string` with limit, `text` / `longtext` → `text`, `int` / `mediumint` → `integer`, `bigint` → `bigint`, `tinyint(1)` → `boolean` (other widths → `integer`), `decimal(p,s)` → `decimal`, `float` / `double` → `float`, `datetime` / `timestamp` / `date` / `json` map verbatim. The auto-generated PRIMARY KEY index and single-column UNIQUE indexes are folded back into column-level flags so the resulting `TableDefinition[]` round-trips back into `createTable` cleanly. Inherited verbatim by `@next-model/mariadb-connector`. Pairs with `generateSchemaSource` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.
- Implements `Connector.alterTable(spec)`. Native MySQL DDL: `ADD/DROP/RENAME COLUMN`, `MODIFY COLUMN` for `changeColumn`, `CREATE INDEX` / `DROP INDEX ... ON tbl` / `ALTER TABLE ... RENAME INDEX` for index ops, `ADD CONSTRAINT ... FOREIGN KEY` / `DROP FOREIGN KEY` for FK ops, and `ADD CONSTRAINT ... CHECK` / `DROP CHECK` for check constraints (MySQL 8.0+; MariaDB 10.2+). Inherited verbatim by `@next-model/mariadb-connector`.
- Implements the optional `Connector.queryWithJoins(spec)` capability. `mode: 'select'` compiles to `WHERE EXISTS (...)`, `'antiJoin'` to `WHERE NOT EXISTS (...)`, `'includes'` to one batched `WHERE child.fk IN (parent_pks) [AND filter]` per association — grouped in JS, attached as `__includes[attachAs]`. The exists-clause helper is `protected` so `MariaDbConnector` (which extends this class) inherits the JOIN path automatically. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` natively.
- Implements the optional `Connector.queryScoped(spec)` capability for promise-like chainable query builders. Emits ONE SQL statement using nested `WHERE col IN (SELECT col FROM parent WHERE … [LIMIT N])` subqueries — one per `parentScope` — and routes projection to the right SELECT shape: `'rows'` → `SELECT *`, `{kind:'pk'}` → `SELECT pk`, `{kind:'column'}` → `SELECT col` (callers receive a flat array), `{kind:'aggregate'}` → `SELECT COUNT/SUM/AVG/MIN/MAX(col) AS __qs_value`. Falls back to `queryWithJoins` when `pendingJoins` are present; the `compileFilter` and `buildOrder` helpers are now `protected` so `MariaDbConnector` inherits this path automatically.

### Native UPSERT
- Implements the optional `Connector.upsert(spec)` method via `INSERT … ON DUPLICATE KEY UPDATE col = VALUES(col)` (or `INSERT IGNORE …` when `ignoreOnly` is set). MySQL conflicts on any unique key — the explicit `conflictTarget` is informational; the SQL ignores it. MySQL has no `RETURNING`, so the connector issues a single follow-up `SELECT … WHERE conflictTarget IN (...)` to return rows in input order. Honors `updateColumns` and `ignoreOnly`; `Model.upsert` / `Model.upsertAll` automatically route through this path.

### Initial release

- New `@next-model/mysql-connector` package: native MySQL connector implementing `@next-model/core`'s `Connector` interface using `mysql2/promise` directly. No Knex dependency.
- Identifiers quoted with backticks (`` `…` ``); camelCase columns round-trip without renaming.
- `transaction(fn)` checks out a single pooled connection and pins it as `activeConnection`, so every nested call (including schema operations) participates in the same MySQL transaction. Re-entrant transactions join the outer one.
- `batchInsert` issues a single multi-row `INSERT` and expands the driver's first-inserted-id to consecutive ids (safe under InnoDB's contiguous lock for a single statement), then re-fetches all rows in one `WHERE id IN (...)` query. When the caller supplies the primary key explicitly, the connector skips the id-expansion step and re-fetches by the supplied keys.
- `updateAll` / `deleteAll` capture the matching rows up-front via a `SELECT` (MySQL has no `RETURNING`), then issue the mutation against the same WHERE clause without `LIMIT`/`OFFSET`.
- Schema DSL maps `autoIncrement` → `INT NOT NULL AUTO_INCREMENT PRIMARY KEY`; column kinds map to native MySQL types (`VARCHAR/TEXT/INT/BIGINT/FLOAT/DECIMAL/TINYINT(1)/DATE/DATETIME/JSON`). Tables are created with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`.
- Index DDL auto-generates a name (`idx_<table>_<col1>_<col2>`) when none is provided.
- Validated through the shared `runModelConformance` suite against a real MySQL 8 service container in CI.
