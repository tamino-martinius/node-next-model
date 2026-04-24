# History

## vNext

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

### Initial release

- New `@next-model/migrations` package providing a connector-agnostic schema migration runner for next-model. Works with any `Connector` (Memory, Knex, DataApi, LocalStorage); migrations receive the connector and may use `connector.execute(sql, bindings)` plus the standard CRUD surface.
- `Migrator` tracks applied migrations in a `schema_migrations` table (table name configurable; identifier-validated to prevent injection).
- API: `init()`, `drop()`, `appliedVersions()`, `appliedEntries()`, `pending(migrations)`, `status(migrations)`, `migrate(migrations)`, `up(migration)`, `down(migration)`, `rollback(migrations, steps?)`.
- Each `up`/`down` runs inside `connector.transaction` so a thrown migration is rolled back atomically and the tracking row is only written after the migration body succeeds.
- `status` reports both pending migrations and orphan entries (applied versions missing from the provided list); `rollback` throws `MigrationMissingError` if it cannot find a matching definition.
- Typed error taxonomy: `MigrationError` (base), `MigrationAlreadyAppliedError`, `MigrationNotAppliedError`, `MigrationMissingError`.
- Migrations are ordered by `version` string via `localeCompare`, so zero-padded or ISO-like timestamps sort naturally.
- Zero runtime dependencies beyond `@next-model/core`. Connector packages are consumed only at test-time.
