---
name: next-model-postgres-connector
description: Native PostgreSQL connector for `@next-model/core` built directly on `node-postgres` (`pg`) — no Knex layer. Trigger when working with `@next-model/postgres-connector`, "node-postgres / pg", PostgreSQL pools, `RETURNING *`, or asks like "Postgres connector", "PostgreSQL pool", "pg.Pool".
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-postgres-connector

`@next-model/postgres-connector` is the native PostgreSQL connector for `@next-model/core`, built directly on [`node-postgres`](https://node-postgres.com/) (`pg`). There's no Knex, no extra query-builder layer — `Connector` methods compile straight to parameterised SQL and run through a `pg.Pool`. It uses Postgres-native features without dialect translation: `SERIAL`, `JSONB`, `RETURNING *` on insert/update/delete, `to_regclass` for `hasTable`, and `reflectSchema` reads `information_schema` + `pg_index` so `nm-generate-migration schema-from-db` can rebuild a Core `defineSchema(...)` from a live database. Identifiers are double-quoted and validated against `^[A-Za-z_][A-Za-z0-9_]*$` so camelCase columns round-trip safely.

## When to use

- Single-dialect Postgres projects where you don't need Knex's multi-driver flexibility.
- You want the smallest dep footprint (`pg` only) and direct access to `pool` features.
- You want Postgres-native types (`SERIAL`, `JSONB`, `RETURNING`) without translation.

## When not to use

- Multi-dialect projects (MySQL / SQLite / MariaDB / MSSQL) — use `@next-model/knex-connector` instead.
- Aurora Serverless v1 / Data API targets — use the Aurora Data API connector instead.

## Install

```sh
pnpm add @next-model/postgres-connector pg
# or: npm install @next-model/postgres-connector pg
```

`pg` is a peer dependency you install yourself.

## Setup

`PostgresConnector` accepts either a connection string or a `pg.Pool` config object. The optional second argument carries a typed `DatabaseSchema` from `defineSchema(...)`.

```ts
import { PostgresConnector } from '@next-model/postgres-connector';

// Connection string
const c1 = new PostgresConnector('postgres://user:secret@host:5432/db');

// pg.Pool config
const c2 = new PostgresConnector({
  host: 'localhost',
  user: 'app',
  password: 'secret',
  database: 'app_production',
  max: 20,
  idleTimeoutMillis: 30_000,
});

// Programmatic shutdown (Lambda warm-shutdown, tests, …)
await c1.destroy();
```

The pool is exposed as `connector.pool` for raw access. Attach a typed schema with the optional second arg so `Model({ connector, tableName: 'users' })` infers per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new PostgresConnector(process.env.DATABASE_URL!, { schema });
```

Existing call sites without `{ schema }` keep working unchanged.

## Quick start

```ts
import { Model } from '@next-model/core';
import { PostgresConnector } from '@next-model/postgres-connector';

const connector = new PostgresConnector(process.env.DATABASE_URL!);

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}
```

## Schema mutations

The Core schema DSL translates to PostgreSQL DDL as follows:

| Core DSL                                            | PostgreSQL                |
|-----------------------------------------------------|---------------------------|
| `t.integer('id', { autoIncrement: true })`          | `"id" SERIAL`             |
| `t.string('name', { limit: 64 })`                   | `"name" VARCHAR(64)`      |
| `t.text('body')`                                    | `"body" TEXT`             |
| `t.bigint('count')`                                 | `"count" BIGINT`          |
| `t.float('rate')`                                   | `"rate" REAL`             |
| `t.decimal('price', { precision: 10, scale: 2 })`   | `"price" NUMERIC(10, 2)`  |
| `t.boolean('active')`                               | `"active" BOOLEAN`        |
| `t.date('day')`                                     | `"day" DATE`              |
| `t.datetime / t.timestamp(...)`                     | `"…" TIMESTAMP`           |
| `t.json('payload')`                                 | `"payload" JSONB`         |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. `t.index([col], { unique })` issues a follow-up `CREATE [UNIQUE] INDEX … ON tbl (col)` after the table create. `dropTable` uses `DROP TABLE IF EXISTS`. `hasTable` calls `to_regclass`. `batchInsert` is a single multi-row `INSERT … RETURNING *`; mismatched column sets are unioned with NULL/declared defaults and insert order is preserved. `updateAll` / `deleteAll` both use `RETURNING *`; `LIMIT`/`OFFSET` from the scope are deliberately ignored — Postgres accepts neither on `DELETE`/`UPDATE`.

## Transactions

`connector.transaction(fn)` checks out a single pooled client and pins it as `activeClient`, then runs `BEGIN` / `COMMIT` (or `ROLLBACK` on throw). Every nested connector call (schema operations, `execute`, query / mutate) sees the same client, so the whole tree is wrapped in one Postgres transaction. Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

`connector.execute(query, bindings)` is a thin wrapper around `pool.query(sql, params)` that joins the active transaction if any. Bindings can be a single `BaseType` or an array, and it returns `result.rows` directly.

## Schema reflection

`reflectSchema` returns a `TableDefinition[]` for every table in `current_schema()`. It reads `information_schema.tables` / `information_schema.columns` / `information_schema.table_constraints` for column metadata, primary keys, and UNIQUE constraints, and `pg_index` / `pg_class` for explicit `CREATE INDEX` entries (skipping the auto-created PK / UNIQUE constraint indexes). `nextval(...)` defaults map back to `autoIncrement: true`; `CURRENT_TIMESTAMP` / `now()` map to `'currentTimestamp'`. The result feeds straight into `generateSchemaSource(...)` from `@next-model/core` so `nm-generate-migration schema-from-db` can rebuild a Core schema from the live database end-to-end.

## Gotchas

- Identifiers are quoted with `"…"` and validated against `^[A-Za-z_][A-Za-z0-9_]*$`. Anything outside that pattern throws `PersistenceError` to keep injection vectors closed — name your columns accordingly (camelCase like `createdAt` is fine).
- `$like` is case-sensitive (PostgreSQL `LIKE`, not `ILIKE`). Use `$raw` if you need case-insensitive matching.
- `$raw` `?` placeholders are rewritten to `$N` so they merge with other parameters in the same WHERE clause; don't hand-write `$N` placeholders inside `$raw`.
- `$async` filters must be resolved by Model before reaching the connector — passing one directly raises `FilterError`. `FilterError` also covers malformed filters (multiple keys in `$gt`, empty `$in`, …).
- JSON columns map to `JSONB` (not `JSON`). Auto-incrementing integers map to `SERIAL` (not `IDENTITY`).
- `updateAll` / `deleteAll` ignore scope `LIMIT` / `OFFSET` because PostgreSQL doesn't accept them on `UPDATE` / `DELETE`.
- Transactions have no savepoints — re-entrant `transaction(...)` calls join the outer transaction, so an inner throw rolls back everything.
- Call `await connector.destroy()` to close the pool cleanly (Lambda warm-shutdown, tests, etc.).

## See also

- `next-model-core`
- `next-model-knex-connector`
- `next-model-migrations`
- `next-model-migrations-generator`
