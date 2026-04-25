# History

## vNext

### Native UPSERT
- Implements the optional `Connector.upsert(spec)` method via `INSERT … ON CONFLICT (cols) DO UPDATE SET col = EXCLUDED.col RETURNING *`. Honors `updateColumns` (whitelist) and `ignoreOnly` (`DO NOTHING`); rows skipped by the conflict path are backfilled via a single follow-up `SELECT … WHERE conflictTarget IN (...)`. Returns rows in input order. `Model.upsert` / `Model.upsertAll` automatically route through this path.

### Initial release

- New `@next-model/postgres-connector` package: native PostgreSQL connector implementing `@next-model/core`'s `Connector` interface using `node-postgres` (`pg`) directly. No Knex dependency.
- SQL identifiers are quoted with `"…"` so camelCase columns (`createdAt`, `discardedAt`, …) round-trip without renaming.
- Filter operators (`$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt`/`$gte`/`$lt`/`$lte`, `$like`, `$raw`) compile to parameterized SQL fragments; `$async` is rejected at the connector boundary (Model resolves it before reaching here).
- `transaction(fn)` checks out a single pooled client and pins it via `activeClient`, so every nested call (including schema operations and `execute`) participates in the same transaction. Re-entrant transactions join the outer one.
- `batchInsert` issues a single multi-row `INSERT … RETURNING *`, returning the inserted rows in insert order.
- Schema DSL maps to PostgreSQL DDL (`SERIAL` for `autoIncrement`, `VARCHAR/TEXT/INTEGER/BIGINT/REAL/NUMERIC/BOOLEAN/DATE/TIMESTAMP/JSONB`); `currentTimestamp` defaults render as `CURRENT_TIMESTAMP`.
- Validated through the shared `runModelConformance` suite against a real PostgreSQL 17 service container in CI.
