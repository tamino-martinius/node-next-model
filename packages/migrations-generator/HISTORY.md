# History

## vNext

- Initial release. CLI (`nm-generate-migration`) + programmatic API (`generateMigration`, `writeMigration`) for scaffolding `@next-model/migrations` files.
- Timestamp-derived filenames with millisecond resolution (`yyyymmddhhmmssxxx`) so rapid generation doesn't collide.
- Optional `--create-table` body with typed column specs (`id:integer:primary:autoIncrement:not-null`), default `id` + timestamps, `--no-timestamps` opt-out.
- `--parent` for the dependency-graph runner, `--version` / `--core-spec` for overrides.
- Programmatic API refuses to overwrite existing files (`wx` flag).
