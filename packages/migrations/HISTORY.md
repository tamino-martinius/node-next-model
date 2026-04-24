# History

## vNext

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

- New `SchemaCollector` wrapper + `SchemaSnapshot` shape. Wraps any `Connector`, forwards every data call, and mirrors `createTable` / `dropTable` DDL into an in-memory snapshot you can persist as JSON after `migrate()` / `rollback()`. `collector.writeSchema(path)` writes a pretty-printed snapshot (version-tagged, `generatedAt` timestamped); `readSchemaFile(path)` loads it back and rejects unknown future versions. Downstream tooling (GraphQL / REST / OpenAPI generators, form builders, admin UIs) can consume the file instead of re-declaring every model's field set by hand. Only DDL issued via the schema DSL is captured — raw SQL in `execute()` bypasses the collector by design.

### Initial release

- New `@next-model/migrations` package providing a connector-agnostic schema migration runner for next-model. Works with any `Connector` (Memory, Knex, DataApi, LocalStorage); migrations receive the connector and declare schema changes via the Rails-style `connector.createTable(name, (t) => { ... })` / `dropTable(name)` DSL. `connector.execute(sql, bindings)` remains available as an escape hatch for dialect-specific DDL.
- `Migrator` tracks applied migrations in a `schema_migrations` table (table name configurable; identifier-validated to prevent injection).
- API: `init()`, `drop()`, `appliedVersions()`, `appliedEntries()`, `pending(migrations)`, `status(migrations)`, `migrate(migrations)`, `up(migration)`, `down(migration)`, `rollback(migrations, steps?)`.
- Each `up`/`down` runs inside `connector.transaction` so a thrown migration is rolled back atomically and the tracking row is only written after the migration body succeeds.
- `status` reports both pending migrations and orphan entries (applied versions missing from the provided list); `rollback` throws `MigrationMissingError` if it cannot find a matching definition.
- Typed error taxonomy: `MigrationError` (base), `MigrationAlreadyAppliedError`, `MigrationNotAppliedError`, `MigrationMissingError`, `MigrationParentMissingError`, `MigrationCycleError`.
- Migrations are ordered by `version` string via `localeCompare`, so zero-padded or ISO-like timestamps sort naturally.
- Optional dependency graph: migrations may declare `parent?: string[]` to depend on one or more prior versions. When omitted, the previous version in the sorted list is used as the implicit parent; an empty array marks a root node. `Migrator` topologically orders migrations before applying, reports cycles via `MigrationCycleError`, and flags declared parents missing from the provided list via `MigrationParentMissingError`.
- `migrate(migrations, { parallel: true })` applies independent branches concurrently: each dependency wave is executed via `Promise.all`, so migrations that share no ancestor run side-by-side. Sequential mode remains the default; `rollback` always runs in reverse topological order.
- Zero runtime dependencies beyond `@next-model/core`. Connector packages are consumed only at test-time.
