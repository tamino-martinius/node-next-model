# History

## vNext

## v1.1.1

### Added

- `connector.ensureSchema()` walks the attached `schema.tableDefinitions` and dispatches every missing table through `createTable`, returning `{ created, existing }` so callers can log what changed. Idempotent: existing tables are reported, not recreated. Throws if no schema is attached.
- Sourcemap files (`dist/**/*.map`) are now included in the published tarball. Downstream Vite / webpack / Rollup builds resolve stack frames inside `@next-model/sqlite-connector` to original TypeScript source without `ENOENT` warnings. No runtime change.

### Changed

- Boolean columns are coerced to `true` / `false` on read when a schema is attached. SQLite has no native boolean and `better-sqlite3` returns 0 / 1 INTEGER for every column declared `boolean`; the connector now mirrors the existing JSON-column behaviour and coerces 0 / 1 → `false` / `true` inside `hydrateRow` for columns the attached schema declares `{ type: 'boolean' }`. `null` and any non-0/1 value passes through unchanged. The write path was already accepting both `true`/`false` and `0`/`1` and is unchanged. **Behaviour change:** callers that compared boolean columns against `0` / `1` strictly (`row.col === 1`) need to switch to `=== true` / `=== false`. Code using `Boolean(row.col)` or loose equality (`== true`) is unaffected. The coercion only activates when a schema is attached at construction; callers using `new SqliteConnector(':memory:')` (no schema) still see raw 0 / 1 INTEGER reads.

## v1.1.0

## v1.0.0

- Implements `Connector.reflectSchema()` for schema introspection. Reads `sqlite_master` for the user's tables (skipping `sqlite_*` internals), `PRAGMA table_info(...)` for columns (mapping SQLite affinity types back to `ColumnKind`, recovering `VARCHAR(N)` limits and `NUMERIC(p,s)` precision/scale), and `PRAGMA index_list(...)` / `PRAGMA index_info(...)` for explicit indexes. The original `CREATE TABLE` SQL stored in `sqlite_master.sql` is parsed for `AUTOINCREMENT` so the reflected `TableDefinition[]` round-trips back into `createTable`. SQLite's lossy mappings still apply — booleans surface as `integer` and unbounded `t.string(...)` columns surface as `text` (no native BOOLEAN, and `TEXT` is indistinguishable from a stored `t.text`). Defaults are decoded back to typed values: `'currentTimestamp'` for `CURRENT_TIMESTAMP`, `null` for `NULL`, numeric / boolean / string literals as appropriate. Pairs with `generateSchemaSource` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.
- Implements `Connector.alterTable(spec)`. Native ALTER TABLE for `addColumn` / `removeColumn` (SQLite ≥ 3.35) / `renameColumn` (SQLite ≥ 3.25), plus `CREATE INDEX` / `DROP INDEX` and `DROP+CREATE` for `renameIndex` (SQLite has no `ALTER INDEX`). `changeColumn`, `addForeignKey` / `removeForeignKey`, `addCheckConstraint` / `removeCheckConstraint` use the standard "create new table + copy + drop + rename" recreate dance internally — the connector tracks each table's `TableDefinition` plus its FK / CHECK metadata so the recreate is lossless. `foreign_keys` is toggled off for the duration of the recreate and restored afterwards so existing FK constraints don't fire spuriously on the rename step.
- Implements the optional `Connector.queryWithJoins(spec)` capability. `mode: 'select'` joins compile to `WHERE EXISTS (SELECT 1 FROM child WHERE child.<col> = parent.<col> [AND <child filter>])`; `'antiJoin'` to `WHERE NOT EXISTS (...)`; `'includes'` to one batched `WHERE child.fk IN (parent_pks)` per association whose results group by parent key in JS and attach under `__includes[attachAs]` on each parent row. The parent SELECT stays unjoined, so LIMIT / SKIP / ORDER BY apply naturally and there's no parent-row duplication. Powers `Model.whereMissing` / `Model.joins` / `Model.includes({...}, { strategy: 'join' | 'auto' })` / cross-association `filterBy` directly on the native driver.
- Implements the optional `Connector.queryScoped(spec)` capability. Each `parentScope` compiles to a `WHERE childCol IN (SELECT parentCol FROM parent [WHERE …] [ORDER BY …] [LIMIT N])` clause; multiple scopes AND together inside one statement. Routes `projection: 'rows'` to `SELECT *`, `'pk'` to the target's primary-key column, `'column'` to the named column, and `'aggregate'` to `COUNT(*)` / `SUM(col)` / `AVG(col)` / `MIN(col)` / `MAX(col)`. When `pendingJoins` are present, defers to `queryWithJoins` so promise-like query builders compose cleanly with cross-association filters.

### Native UPSERT
- Implements the optional `Connector.upsert(spec)` method via `INSERT … ON CONFLICT (cols) DO UPDATE SET col = excluded.col RETURNING *` (sqlite 3.35+). Honors `updateColumns` (whitelist) and `ignoreOnly` (`DO NOTHING`); rows skipped by the conflict path are backfilled via a single follow-up `SELECT … WHERE conflictTarget IN (...)`. Returns rows in input order. `Model.upsert` / `Model.upsertAll` automatically route through this path.

### Initial release

- New `@next-model/sqlite-connector` package: native SQLite connector implementing `@next-model/core`'s `Connector` interface using [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) directly. No Knex dependency.
- Synchronous driver wrapped in async-returning `Connector` methods so it slots into the same Model API as every other connector.
- Identifiers quoted with `"…"`; camelCase columns (`createdAt`, `discardedAt`, …) round-trip without renaming.
- `transaction(fn)` issues raw `BEGIN` / `COMMIT` / `ROLLBACK` against the underlying handle; nested calls join the outer transaction.
- `batchInsert` issues a single multi-row `INSERT … RETURNING *` (SQLite ≥ 3.35).
- Schema DSL maps column kinds to SQLite affinities (`INTEGER` for ints/bigints/booleans, `REAL` for floats, `NUMERIC` for decimals, `TEXT` for strings/dates/JSON). `autoIncrement` becomes `INTEGER PRIMARY KEY AUTOINCREMENT`.
- `Date` and `boolean` bindings are coerced (Date → ISO string, boolean → 0/1) at the parameter boundary so models can pass them directly.
- Validated through the shared `runModelConformance` suite (every Model feature) plus driver-specific tests for column kinds, identifier safety, the `$async`-at-connector guard, and Date / boolean coercion.
