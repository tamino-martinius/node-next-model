# History

## vNext

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.6 → 4.1.9, `@types/node` 25.9.0 → 25.9.3.

### Security

- Patched test-toolchain advisories via root `pnpm.overrides`: `ws` → `>=8.21.0` (GHSA-96hv-2xvq-fx4p) and `vite` → `>=8.0.16` (GHSA-fx2h-pf6j-xcff / GHSA-v6wh-96g9-6wx3), reached transitively through `vitest` / `happy-dom` (test-time only).

## v1.1.8

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.0.0

- New `schema-from-db` subcommand. Loads a connector module (default export, named `connector` export, or a factory), calls `Connector.reflectSchema()`, and writes a typed-schema TS file with one `defineSchema(...)` per reflected table via `@next-model/core`'s `generateSchemaSource`. Errors out helpfully when the connector doesn't implement `reflectSchema`. Programmatic entry points are exported as `runSchemaFromDb`, `parseSchemaFromDbArgs`, and `runCliAsync`.
- Initial release. CLI (`nm-generate-migration`) + programmatic API (`generateMigration`, `writeMigration`) for scaffolding `@next-model/migrations` files.
- Timestamp-derived filenames with millisecond resolution (`yyyymmddhhmmssxxx`) so rapid generation doesn't collide.
- Optional `--create-table` body with typed column specs (`id:integer:primary:autoIncrement:not-null`), default `id` + timestamps, `--no-timestamps` opt-out.
- `--parent` for the dependency-graph runner, `--version` / `--core-spec` for overrides.
- Programmatic API refuses to overwrite existing files (`wx` flag).
