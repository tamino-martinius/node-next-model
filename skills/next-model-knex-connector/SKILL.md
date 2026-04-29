---
name: next-model-knex-connector
description: SQL connector for `@next-model/core` backed by Knex 3, supporting sqlite3, Postgres, MySQL, MariaDB, Oracle, and MSSQL through any Knex client. Triggers include "Knex connector", "multi-dialect", "Knex pool", and "schema migrations through Knex" — reach for this when you want one connector that targets multiple SQL dialects through Knex rather than a native single-dialect connector.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# @next-model/knex-connector

`@next-model/knex-connector` is a SQL connector for [`@next-model/core`](../next-model/SKILL.md), backed by [Knex 3](https://knexjs.org/). It speaks the same `Connector` interface as the native single-dialect connectors but delegates query building, pooling, transactions, and DDL to a Knex instance — which means any Knex client works (sqlite3, Postgres, MySQL, MariaDB, Oracle, MSSQL, Redshift). CI exercises sqlite3, PostgreSQL 17, and MySQL 8 on every push; the rest "should also work" but are not part of the matrix. Prefer this connector when you need multi-dialect portability or already have a Knex investment; prefer the native connectors otherwise (smaller dep graph, tighter dialect-specific behaviour).

## When to use

- You want one connector that targets multiple SQL dialects (e.g. sqlite3 in dev/test, Postgres in prod) without swapping packages.
- You already have a Knex setup (config, pool tuning, migrations) and want NextModel to participate in the same instance.
- You need a dialect that does not have a native connector — MariaDB, Oracle, MSSQL, Redshift — but is supported by Knex.

## When not to use

- You are committed to a single dialect — use the corresponding native connector for fewer deps and more direct semantics:
  - `@next-model/postgres-connector` (see `next-model-postgres-connector`)
  - `@next-model/sqlite-connector` (see `next-model-sqlite-connector`)
  - `@next-model/mysql-connector` (see `next-model-mysql-connector`)
  - `@next-model/mariadb-connector` (see `next-model-mariadb-connector`)

## Install

```sh
pnpm add @next-model/knex-connector knex
# or: npm install @next-model/knex-connector knex
pnpm add -D sqlite3        # or pg / mysql2 / tedious / oracledb …
# or: npm install -D sqlite3        # or pg / mysql2 / tedious / oracledb …
```

`knex` is a runtime dependency; the actual driver (`pg`, `mysql2`, `sqlite3`, `tedious`, `oracledb`, …) you choose is yours to install per the database you target.

## Setup

The constructor takes the same options object as `knex({...})`:

```ts
import { KnexConnector } from '@next-model/knex-connector';

// sqlite (file or :memory:)
const sqlite = new KnexConnector({
  client: 'sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
});

// Postgres
const pg = new KnexConnector({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

// MySQL
const mysql = new KnexConnector({
  client: 'mysql2',
  connection: 'mysql://root:secret@127.0.0.1:3306/myapp',
  pool: { min: 1, max: 10 },
});
```

The underlying knex instance is exposed as `connector.knex` if you need to drop down to raw query-building or call `connector.knex.destroy()` on shutdown.

Optionally pass a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) as the second argument so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new KnexConnector({ client: 'pg', connection: '...' }, { schema });
```

Existing call sites without `{ schema }` keep working unchanged.

## Quick start

```ts
import { Model } from '@next-model/core';
import { KnexConnector } from '@next-model/knex-connector';

const connector = new KnexConnector({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}
```

Every Model feature (filters, aggregates, transactions, soft deletes, associations, schema DSL) flows through the `Connector` interface — so the rest of your code is identical regardless of which driver you picked.

## Schema mutations

`connector.createTable(name, t => …)` accepts the [core schema DSL](../next-model/SKILL.md). The connector translates each column kind to the matching knex schema-builder method:

| Core DSL                         | Knex call                |
|----------------------------------|--------------------------|
| `t.integer('id', { autoIncrement: true })` | `table.increments('id')` |
| `t.string('name')`               | `table.string('name', limit ?? 255)` |
| `t.text('body')`                 | `table.text('body')`     |
| `t.bigint('count')`              | `table.bigInteger('count')` |
| `t.float('rate')`                | `table.float('rate')`    |
| `t.decimal('price', { precision, scale })` | `table.decimal('price', precision, scale)` |
| `t.boolean('active')`            | `table.boolean('active')` |
| `t.date('day')`                  | `table.date('day')`      |
| `t.datetime / t.timestamp(...)`  | `table.timestamp(name)`  |
| `t.json('payload')`              | `table.json('payload')`  |
| `t.timestamps()`                 | two `timestamp` columns + `now()` defaults |
| `t.index(cols, { unique })`      | `table.index` / `table.unique` |

`{ default: 'currentTimestamp' }` becomes `defaultTo(knex.fn.now())`. Every other `default:` value is passed through to `defaultTo()` verbatim. `dropTable` / `alterTable` map to the corresponding knex schema builder calls and emit full ALTER TABLE DDL through Knex.

## Transactions

`connector.transaction(fn)` opens a real `knex.transaction` and pins it to `activeTransaction` so every nested call (including schema operations and `execute`) participates. Re-entrant calls *join* the outer transaction rather than nesting savepoints — the inner callback runs inside the outer one and a thrown error rolls the entire outer back. Errors thrown inside `fn` propagate after the rollback.

## Gotchas

- **Peer-dep selection.** `knex` is a regular dependency, but the dialect driver (`pg`, `mysql2`, `sqlite3`, `tedious`, `oracledb`, …) is yours to install. Picking the wrong `client` string vs. the installed package is the most common boot-time error.
- **`batchInsert` strategy varies per driver** because not every driver supports `RETURNING *`:
  - **sqlite3** — inserts items one-by-one, then re-fetches each by primary key.
  - **pg** — `INSERT … RETURNING *` returns the full inserted rows in one round-trip.
  - **mysql / mysql2** — bulk `INSERT` returns only the first auto-increment id; the connector expands it to consecutive ids (safe under InnoDB's contiguous lock for a single statement) and re-fetches all rows in one `whereIn(id)` query.
  - **`KeyType.manual`** — short-circuits the re-fetch and echoes the items back as-is.
- **`execute(query, bindings)` result shape** is normalised to a flat `Dict<any>[]` per driver (sqlite3 → `result`, pg → `result.rows`, mysql/mysql2 → `result[0]`). MariaDB rides the mysql path; behaviour matches what knex returns for `[rows, fields]`.
- **`updateAll` / `deleteAll`** build the WHERE clause directly from `scope.filter` and ignore `scope.limit` / `scope.skip`, which sqlite rejects (`limit has no effect on a delete/update`). The current row set is captured by an explicit `query()` call before the mutation so the methods can return the affected rows even when the driver lacks `RETURNING`.
- **`$like` case sensitivity** follows the driver — Postgres is case-sensitive, MySQL/SQLite default to insensitive.
- **`$raw`** translates `?` placeholders to driver-specific positional markers (Postgres `$1`, MySQL `?`).
- **`reflectSchema`** dispatches by Knex client: `sqlite3` / `better-sqlite3` use `PRAGMA` queries against `sqlite_master`, `pg` / `postgres` query `information_schema` + `pg_index` / `pg_class`, and `mysql` / `mysql2` / `mariadb` query MySQL `information_schema`. Unknown clients throw `PersistenceError` — `reflectSchema` is optional, so leaving it unimplemented is safe.

## See also

- `next-model-core` — the `Connector` interface and schema DSL this connector implements.
- `next-model-postgres-connector` — native Postgres connector (prefer for single-dialect Postgres projects).
- `next-model-sqlite-connector` — native sqlite connector.
- `next-model-mysql-connector` — native MySQL connector.
- `next-model-mariadb-connector` — native MariaDB connector.
- `next-model-migrations` — migration runner that drives `createTable` / `alterTable` / `dropTable` through whichever connector you pick.
