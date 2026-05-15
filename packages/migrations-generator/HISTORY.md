# History

## vNext

## v1.1.2

## v1.1.1

## v1.1.0

## v1.0.0

- New `schema-from-db` subcommand. Loads a connector module (default export, named `connector` export, or a factory), calls `Connector.reflectSchema()`, and writes a typed-schema TS file with one `defineSchema(...)` per reflected table via `@next-model/core`'s `generateSchemaSource`. Errors out helpfully when the connector doesn't implement `reflectSchema`. Programmatic entry points are exported as `runSchemaFromDb`, `parseSchemaFromDbArgs`, and `runCliAsync`.
- Initial release. CLI (`nm-generate-migration`) + programmatic API (`generateMigration`, `writeMigration`) for scaffolding `@next-model/migrations` files.
- Timestamp-derived filenames with millisecond resolution (`yyyymmddhhmmssxxx`) so rapid generation doesn't collide.
- Optional `--create-table` body with typed column specs (`id:integer:primary:autoIncrement:not-null`), default `id` + timestamps, `--no-timestamps` opt-out.
- `--parent` for the dependency-graph runner, `--version` / `--core-spec` for overrides.
- Programmatic API refuses to overwrite existing files (`wx` flag).
