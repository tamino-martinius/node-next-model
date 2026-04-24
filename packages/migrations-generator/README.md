# @next-model/migrations-generator

Scaffolds `@next-model/migrations` files — CLI + programmatic API.

```sh
pnpm add -D @next-model/migrations-generator
```

## CLI

```sh
# Empty stub
pnpm exec nm-generate-migration "add FK on posts"

# Full createTable body with columns
pnpm exec nm-generate-migration "create users" \
  --create-table users \
  --column id:integer:primary:autoIncrement:not-null \
  --column name:string:not-null \
  --column age:integer

# Declare the migration's parent(s) — works with the dependency-graph runner
pnpm exec nm-generate-migration "grant perms" \
  --parent 20250101000000000 \
  --parent 20250505000000000
```

Resulting file lives in `./migrations/<timestamp>_<slug>.ts` (override with `--dir`). The filename timestamp is UTC, millisecond-resolution (`yyyymmddhhmmssxxx`) so files sort chronologically and don't collide when you generate several in a row.

### Column spec grammar

`name[:type[:flag...]]`

- type: `integer | bigint | float | string | text | boolean | date | datetime | json` (defaults to `string`; unknown kinds fall back to `string`)
- flags: `primary`, `autoIncrement`, `nullable` (explicit `null: true`), `not-null` (explicit `null: false`)

### Flag reference

| Flag                           | Effect                                                              |
|--------------------------------|---------------------------------------------------------------------|
| `--dir <path>`                 | Output directory (default: `./migrations`)                          |
| `--create-table <name>`        | Scaffold a `createTable` body for `<name>`                          |
| `--column <spec>`              | Column spec for `--create-table`, repeatable                        |
| `--no-timestamps`              | Omit default `createdAt` + `updatedAt` columns                      |
| `--parent <version>`           | Parent migration version (repeatable)                               |
| `--version <string>`           | Override the auto-generated version                                 |
| `--core-spec <module>`         | Import specifier for `Connector` (default: `@next-model/core`)      |
| `--require-existing-dir`       | Fail instead of creating the output directory                       |

## Programmatic API

```ts
import { generateMigration, writeMigration } from '@next-model/migrations-generator';

const { contents, fileName, version } = generateMigration({
  name: 'create users',
  createTable: { tableName: 'users' },
});

writeMigration({
  name: 'create users',
  directory: './db/migrations',
  createTable: { tableName: 'users' },
});
```

`writeMigration` refuses to overwrite an existing file (uses `{ flag: 'wx' }`), so re-runs are safe as long as clocks move forward.
