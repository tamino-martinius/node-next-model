# History

## vNext

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
