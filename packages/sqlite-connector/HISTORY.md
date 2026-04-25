# History

## vNext

- Implements `Connector.alterTable(spec)`. Native ALTER TABLE for `addColumn` / `removeColumn` (SQLite ≥ 3.35) / `renameColumn` (SQLite ≥ 3.25), plus `CREATE INDEX` / `DROP INDEX` and `DROP+CREATE` for `renameIndex` (SQLite has no `ALTER INDEX`). `changeColumn`, `addForeignKey` / `removeForeignKey`, `addCheckConstraint` / `removeCheckConstraint` use the standard "create new table + copy + drop + rename" recreate dance internally — the connector tracks each table's `TableDefinition` plus its FK / CHECK metadata so the recreate is lossless. `foreign_keys` is toggled off for the duration of the recreate and restored afterwards so existing FK constraints don't fire spuriously on the rename step.

### Initial release

- New `@next-model/sqlite-connector` package: native SQLite connector implementing `@next-model/core`'s `Connector` interface using [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) directly. No Knex dependency.
- Synchronous driver wrapped in async-returning `Connector` methods so it slots into the same Model API as every other connector.
- Identifiers quoted with `"…"`; camelCase columns (`createdAt`, `discardedAt`, …) round-trip without renaming.
- `transaction(fn)` issues raw `BEGIN` / `COMMIT` / `ROLLBACK` against the underlying handle; nested calls join the outer transaction.
- `batchInsert` issues a single multi-row `INSERT … RETURNING *` (SQLite ≥ 3.35).
- Schema DSL maps column kinds to SQLite affinities (`INTEGER` for ints/bigints/booleans, `REAL` for floats, `NUMERIC` for decimals, `TEXT` for strings/dates/JSON). `autoIncrement` becomes `INTEGER PRIMARY KEY AUTOINCREMENT`.
- `Date` and `boolean` bindings are coerced (Date → ISO string, boolean → 0/1) at the parameter boundary so models can pass them directly.
- Validated through the shared `runModelConformance` suite (every Model feature) plus driver-specific tests for column kinds, identifier safety, the `$async`-at-connector guard, and Date / boolean coercion.
