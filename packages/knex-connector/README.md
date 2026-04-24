# @next-model/knex-connector

SQL connector for [`@next-model/core`](../core), backed by [Knex 3](https://knexjs.org/).

Tested in CI against:

- **sqlite3** — in-memory, every push.
- **PostgreSQL 17** — service container, every push.
- **MySQL 8** — service container, every push.

Should also work against any other Knex client (MariaDB, Oracle, MSSQL, Redshift) but those are not part of the CI matrix.

## Installation

```sh
pnpm add @next-model/knex-connector knex
# or: npm install @next-model/knex-connector knex
pnpm add -D sqlite3        # or pg / mysql2 / tedious / oracledb …
# or: npm install -D sqlite3        # or pg / mysql2 / tedious / oracledb …
```

`knex` is a runtime dependency; the actual driver (`pg`, `mysql2`, `sqlite3`, …) you choose is yours to install per the database you target.

## Constructing the connector

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

## Wiring a Model

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

## Feature → connector specifics

### Schema DSL → SQL DDL

`connector.createTable(name, t => …)` accepts the [core schema DSL](../core/README.md). The connector translates each column kind to the matching knex schema-builder method:

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

`{ default: 'currentTimestamp' }` becomes `defaultTo(knex.fn.now())`. Every other `default:` value is passed through to `defaultTo()` verbatim.

### Filter operators → WHERE clauses

| Filter | SQL produced |
|--------|--------------|
| `{ name: 'Ada' }` | `name = ?` |
| `{ $or: [a, b] }` | `(... ) OR (...)` (recursive) |
| `{ $not: f }`     | `NOT (...)` |
| `{ $in: { col: [...] } }`  | `col IN (?, ?, …)` |
| `{ $notIn: { col: [...] } }` | `col NOT IN (?, ?, …)` |
| `{ $null: 'col' }` / `{ $notNull: 'col' }` | `col IS NULL` / `col IS NOT NULL` |
| `{ $between: { col: { from, to } } }` | `col BETWEEN ? AND ?` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `col > ?` etc. |
| `{ $like: { col: 'pat%' } }` | `col LIKE ?` (case sensitivity follows the driver — Postgres is case-sensitive, MySQL/SQLite default to insensitive). |
| `{ $async: Promise<Filter> }` | the inner filter is `await`-ed and re-applied recursively. |
| `{ $raw: { $query, $bindings } }` | `whereRaw($query, $bindings)`. `?` placeholders are translated to driver-specific positional markers (Postgres `$1`, MySQL `?`). |

`FilterError` is thrown for malformed special filters (multiple keys in `$gt`, empty `$in`, …).

### Aggregates

`connector.aggregate(scope, kind, key)` issues a single `SELECT kind(key) AS kind_result` query. The result is coerced via `Number()`, so Postgres' `AVG → numeric (string)` is normalised to a JS number.

### `execute(query, bindings)`

Runs raw SQL via `knex.raw` (joining the active transaction if any). The result is normalised so callers always see a flat `Dict<any>[]`:

| Driver          | Source                  |
|-----------------|-------------------------|
| sqlite3         | `result` itself         |
| pg / postgres   | `result.rows`           |
| mysql / mysql2  | `result[0]` (knex returns `[rows, fields]`) |

### Transactions

`connector.transaction(fn)` opens a real `knex.transaction` and pins it to `activeTransaction` so every nested call (including schema operations and `execute`) participates. Re-entrant calls *join* the outer transaction rather than nesting savepoints — the inner callback runs inside the outer one and a thrown error rolls the entire outer back. Errors thrown inside `fn` propagate after the rollback.

### `batchInsert`

The connector picks a strategy per driver because not every driver supports `RETURNING *`:

- **sqlite3** — inserts items one-by-one, then re-fetches each by primary key.
- **pg** — `INSERT … RETURNING *` returns the full inserted rows in one round-trip.
- **mysql / mysql2** — bulk `INSERT` returns only the first auto-increment id; the connector expands it to consecutive ids (safe under InnoDB's contiguous lock for a single statement) and re-fetches all rows in one `whereIn(id)` query.
- **`KeyType.manual`** — short-circuits the re-fetch and echoes the items back as-is.

### `updateAll` / `deleteAll`

Both build the WHERE clause directly from `scope.filter` and ignore `scope.limit` / `scope.skip`, which sqlite rejects (`limit has no effect on a delete/update`). The current row set is captured by an explicit `query()` call before the mutation so the methods can return the affected rows even when the driver lacks `RETURNING`.

## Test matrix

The package's spec is driver-agnostic and selects its backend via env vars:

```sh
KNEX_TEST_CLIENT=sqlite3 pnpm test               # default
KNEX_TEST_CLIENT=pg DATABASE_URL=postgres://… pnpm test
KNEX_TEST_CLIENT=mysql2 DATABASE_URL=mysql://… pnpm test
```

CI runs all three.

## Changelog

See [`HISTORY.md`](./HISTORY.md).
