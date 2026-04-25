# History

## vNext

- Implements the optional `Connector.queryWithJoins(spec)` capability. `mode: 'select'` compiles to `WHERE EXISTS (...)`, `'antiJoin'` to `WHERE NOT EXISTS (...)`, `'includes'` to one batched `WHERE child.fk IN (parent_pks) [AND filter]` per association — grouped in JS, attached as `__includes[attachAs]`. The exists-clause helper is `protected` so `MariaDbConnector` (which extends this class) inherits the JOIN path automatically. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` natively.

### Initial release

- New `@next-model/mysql-connector` package: native MySQL connector implementing `@next-model/core`'s `Connector` interface using `mysql2/promise` directly. No Knex dependency.
- Identifiers quoted with backticks (`` `…` ``); camelCase columns round-trip without renaming.
- `transaction(fn)` checks out a single pooled connection and pins it as `activeConnection`, so every nested call (including schema operations) participates in the same MySQL transaction. Re-entrant transactions join the outer one.
- `batchInsert` issues a single multi-row `INSERT` and expands the driver's first-inserted-id to consecutive ids (safe under InnoDB's contiguous lock for a single statement), then re-fetches all rows in one `WHERE id IN (...)` query. When the caller supplies the primary key explicitly, the connector skips the id-expansion step and re-fetches by the supplied keys.
- `updateAll` / `deleteAll` capture the matching rows up-front via a `SELECT` (MySQL has no `RETURNING`), then issue the mutation against the same WHERE clause without `LIMIT`/`OFFSET`.
- Schema DSL maps `autoIncrement` → `INT NOT NULL AUTO_INCREMENT PRIMARY KEY`; column kinds map to native MySQL types (`VARCHAR/TEXT/INT/BIGINT/FLOAT/DECIMAL/TINYINT(1)/DATE/DATETIME/JSON`). Tables are created with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`.
- Index DDL auto-generates a name (`idx_<table>_<col1>_<col2>`) when none is provided.
- Validated through the shared `runModelConformance` suite against a real MySQL 8 service container in CI.
