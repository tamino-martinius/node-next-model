# History

## vNext

## v1.1.5

## v1.1.4

## v1.1.2

### Changed

- `definitionFromOp` defaults `nullable` to `false` (matches the `@next-model/core` builder default, which also flipped in this release). Callers building columns via the alter-table path who relied on the previous nullable-by-default behaviour must now pass `{ null: true }` explicitly.
- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`).

## v1.1.1

## v1.1.0

## v1.0.0

- Implements `Connector.reflectSchema()` for schema introspection. Reads `information_schema.tables` for the user's tables in `current_schema()`, `information_schema.columns` for column types / nullability / defaults / `VARCHAR(N)` limits / `NUMERIC(p,s)` precision and scale, `information_schema.table_constraints` joined to `information_schema.key_column_usage` for primary key + single-column unique constraints, and `pg_index` / `pg_class` / `pg_attribute` (skipping the auto-created PRIMARY KEY / UNIQUE constraint indexes) for explicit `CREATE INDEX` definitions. Postgres types map back to the connector's `ColumnKind`: `varchar` / `text` / `integer` / `bigint` / `boolean` / `timestamp` (with or without time zone) / `date` / `time` / `numeric(p,s)` / `real` / `double precision` / `json` / `jsonb`. `nextval(...)` defaults flag the column as `autoIncrement: true`; `now()` / `CURRENT_TIMESTAMP` round-trip back to `'currentTimestamp'`; quoted string defaults are unescaped, numeric defaults parsed back to `number`. Pairs with `generateSchemaSource` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.
- Implements `Connector.alterTable(spec)`. Every op translates to native PostgreSQL DDL: `addColumn` / `removeColumn` / `renameColumn` use `ALTER TABLE ... ADD/DROP/RENAME COLUMN`; `changeColumn` issues `ALTER COLUMN ... TYPE`, then `SET/DROP NOT NULL` and `SET/DROP DEFAULT` based on the supplied options; `addIndex` / `removeIndex` / `renameIndex` use `CREATE INDEX` / `DROP INDEX` / `ALTER INDEX RENAME TO`; `addForeignKey` / `removeForeignKey` and `addCheckConstraint` / `removeCheckConstraint` use `ADD CONSTRAINT` / `DROP CONSTRAINT` with the auto-generated default name from `@next-model/core` so callers don't need to remember it. Indexes created via `createTable` now use the same `idx_<table>_<columns>` default name so `removeIndex(['col'])` finds them.
- Implements the optional `Connector.queryWithJoins(spec)` capability. `mode: 'select'` compiles to `WHERE EXISTS (...)`, `'antiJoin'` to `WHERE NOT EXISTS (...)`, `'includes'` to one batched `WHERE child.fk IN (parent_pks) [AND filter]` per association — children grouped by parent key in JS and attached under `__includes[attachAs]` on each parent row. Same `$N` placeholder shape as the rest of the connector. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` natively.

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
