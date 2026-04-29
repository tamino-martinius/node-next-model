---
name: next-model-sqlite-connector
description: Native SQLite connector for next-model, built directly on `better-sqlite3` with no Knex layer. Use when the user mentions `@next-model/sqlite-connector`, the "SQLite connector", `better-sqlite3`, a `:memory:` database, WAL mode / `better-sqlite3` pragma options, or schema reflection (`PRAGMA table_info` / `PRAGMA index_list`) for migration generation.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-sqlite-connector

`@next-model/sqlite-connector` is the native SQLite `Connector` for [`@next-model/core`](../next-model/SKILL.md), built directly on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) — no Knex, no extra query-builder layer. It implements schema reflection via `PRAGMA table_info` + `PRAGMA index_list` (consumed by `nm-generate-migration schema-from-db`), and falls back to the SQLite "create new table → copy → drop → rename" recreate dance for `alterTable` operations the dialect cannot do natively (column type changes, foreign-key adds/removes, check-constraint adds/removes). All other ops use plain `ALTER TABLE`.

## When to use

- Local Node apps that target SQLite only and don't want to ship Knex.
- Embedded data files (`./data/app.sqlite`).
- Tests / CI: an in-memory database (`new SqliteConnector()` or `new SqliteConnector(':memory:')`) gives every Model feature with zero service container.
- Quick prototyping where you want the synchronous, near-zero-overhead `better-sqlite3` driver under the hood.

## When not to use

- Browsers — `better-sqlite3` is a native Node addon. Use [`next-model-local-storage-connector`](../next-model-local-storage-connector/SKILL.md) or the built-in `MemoryConnector` from [`next-model-core`](../next-model-core/SKILL.md) instead.
- You need MySQL / Postgres / MariaDB / MSSQL too — pick [`next-model-knex-connector`](../next-model-knex-connector/SKILL.md), or the matching native connector per dialect.

## Install

```sh
pnpm add @next-model/sqlite-connector better-sqlite3
# or: npm install @next-model/sqlite-connector better-sqlite3
```

`better-sqlite3` is a peer-style runtime dep — you must install it alongside the connector. Node ≥ 22.

## Setup

```ts
import { SqliteConnector } from '@next-model/sqlite-connector';

// In-memory (default)
const c1 = new SqliteConnector();
const c2 = new SqliteConnector(':memory:');

// File-backed
const c3 = new SqliteConnector('./data/app.sqlite');

// With better-sqlite3 options
const c4 = new SqliteConnector({
  filename: './data/app.sqlite',
  options: { fileMustExist: true, readonly: false },
});

// Programmatic shutdown (tests, scripts)
c1.destroy();
```

The constructor signature is `new SqliteConnector(config?, extras?)`:

- `config` — either a filename string (`':memory:'` or a path) or an object `{ filename?, options? }`. Defaults to `':memory:'`.
- `config.filename` — `':memory:'` or a filesystem path. Omit / undefined falls back to `':memory:'`.
- `config.options` — passed verbatim to `new Database(filename, options)` from `better-sqlite3`. Use this for `readonly`, `fileMustExist`, `timeout`, `verbose`, custom `nativeBinding`, etc. WAL mode and other PRAGMAs go through `connector.db.pragma('journal_mode = WAL')` after construction.
- `extras.schema` — a `DatabaseSchema` from `defineSchema(...)`; purely a type-level decoration so `Model({ connector, tableName: 'users' })` infers per-table props.

The raw `better-sqlite3` handle is exposed as `connector.db` for pragma tweaks or escape hatches.

```ts
import { defineSchema } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string' },
    },
  },
});

const connector = new SqliteConnector(':memory:', { schema });
```

## Quick start

```ts
import { Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

const connector = new SqliteConnector('./data/app.sqlite');

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}
```

## Schema mutations

`connector.alterTable(spec)` dispatches per op:

- **Native `ALTER TABLE`** (SQLite ≥ 3.35 for DROP COLUMN, ≥ 3.25 for RENAME COLUMN — both versions ship with current `better-sqlite3`):
  - `addColumn` → `ALTER TABLE … ADD COLUMN …`
  - `removeColumn` → `ALTER TABLE … DROP COLUMN …`
  - `renameColumn` → `ALTER TABLE … RENAME COLUMN … TO …`
  - `addIndex` / `removeIndex` / `renameIndex` → `CREATE [UNIQUE] INDEX` / `DROP INDEX`.
- **Recreate dance** (create new table, copy rows over, drop old, rename) for ops SQLite cannot do natively in place:
  - `changeColumn` (column type / nullability / default change)
  - `addForeignKey` / `removeForeignKey`
  - `addCheckConstraint` / `removeCheckConstraint`

The recreate path needs the table to have been created (or previously altered) through this connector — it relies on the connector's tracked definition. Bare existing tables that weren't created via `createTable` raise `UnsupportedOperationError` for the recreate ops.

## Schema reflection

```ts
const tables = await connector.reflectSchema();
```

Returns `TableDefinition[]` derived from `sqlite_master`, `PRAGMA table_info(...)`, `PRAGMA index_list(...)`, and `PRAGMA index_info(...)`. Auto-generated indexes for primary keys and `UNIQUE` constraints are filtered out (only `origin === 'c'` indexes — explicit `CREATE INDEX` — are reported). Column kind / `limit` / `precision` / `scale` / `autoIncrement` are inferred from the type token in the original DDL.

This is what `nm-generate-migration schema-from-db` consumes when scaffolding a migration from a live database — see [`next-model-migrations-generator`](../next-model-migrations-generator/SKILL.md).

## Transactions

```ts
await connector.transaction(async () => {
  await User.create({ name: 'Ada', age: 36 });
  await User.create({ name: 'Grace', age: 41 });
});
```

`connector.transaction(fn)` issues raw `BEGIN`, then `COMMIT` on success or `ROLLBACK` on throw. Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

## Gotchas

- **`better-sqlite3` is synchronous.** The connector still exposes the async `Connector` interface (it returns resolved promises), but every call blocks the event loop while the query runs. Don't use it for high-concurrency request handlers — use `postgres-connector` or `mysql-connector` for that.
- **Native compile.** `better-sqlite3` is a Node native addon. `pnpm install` runs `node-gyp` against your platform / Node ABI; deploy targets need a matching prebuilt or a working toolchain.
- **No `LIMIT` / `OFFSET` on `UPDATE` / `DELETE`.** SQLite refuses both without `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`, so the connector deliberately ignores `limit` / `offset` from the scope on `updateAll` / `deleteAll`.
- **Type coercion at the boundary.** `Date` bindings → ISO 8601 string (`new Date().toISOString()`); `boolean` bindings → `1` / `0`. `t.date` / `t.datetime` / `t.timestamp` / `t.json` columns are all stored as `TEXT` (SQLite has no native types).
- **Identifier validation.** All identifiers are quoted with `"…"` and validated against `^[A-Za-z_][A-Za-z0-9_]*$` — anything else throws `PersistenceError`.
- **`batchInsert`** uses a single multi-row `INSERT … RETURNING *`. Items contributing different sets of columns are unioned.

## See also

- [`next-model-core`](../next-model-core/SKILL.md) — the `Model({...})` factory and `Connector` interface.
- [`next-model-knex-connector`](../next-model-knex-connector/SKILL.md) — multi-dialect alternative when you need MySQL / Postgres / SQLite / MSSQL through one driver.
- [`next-model-migrations`](../next-model-migrations/SKILL.md) — versioned migrations that run against this connector.
- [`next-model-migrations-generator`](../next-model-migrations-generator/SKILL.md) — `nm-generate-migration` CLI; `schema-from-db` consumes `connector.reflectSchema()`.
