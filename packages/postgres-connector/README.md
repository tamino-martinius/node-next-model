# @next-model/postgres-connector

Native PostgreSQL connector for [`@next-model/core`](../core), built directly on [`node-postgres`](https://node-postgres.com/). No Knex, no extra query-builder layer — `Connector` methods compile to parameterised SQL and run through a `pg.Pool`.

## When to pick this over `@next-model/knex-connector`

- You target Postgres only and don't need the multi-driver flexibility Knex provides.
- You want a smaller dep footprint (`pg` only) and direct access to `Pool` features.
- You prefer the connector to use Postgres-native features (`SERIAL`, `JSONB`, `RETURNING`) without any dialect translation layer.

If you need MySQL / SQLite / MariaDB / MSSQL too, keep `@next-model/knex-connector`.

## Installation

```sh
pnpm add @next-model/postgres-connector pg
# or: npm install @next-model/postgres-connector pg
```

## Constructing the connector

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

The pool is exposed as `connector.pool` if you need raw access.

## Wiring a Model

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

## Feature → connector specifics

### Identifiers

All identifiers are quoted with `"…"` (Postgres standard). camelCase column names (`createdAt`, `discardedAt`, …) round-trip without renaming. Identifiers are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before quoting; anything else throws `PersistenceError` to keep injection vectors closed.

### Filter operators

| Filter | SQL produced |
|--------|--------------|
| `{ name: 'Ada' }` | `"name" = $1` |
| `{ $or: [a, b] }` | `(…) OR (…)` |
| `{ $not: f }`     | `NOT (…)` |
| `{ $in: { col: [...] } }`  | `"col" IN ($1, $2, …)` |
| `{ $notIn: { col: [...] } }` | `"col" NOT IN (…)` |
| `{ $null: 'col' }` | `"col" IS NULL` |
| `{ $notNull: 'col' }` | `"col" IS NOT NULL` |
| `{ $between: { col: { from, to } } }` | `"col" BETWEEN $1 AND $2` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `"col" > $1` etc. |
| `{ $like: { col: 'pat%' } }` | `"col" LIKE $1` (PostgreSQL is case-sensitive). |
| `{ $raw: { $query: 'col = ?', $bindings: [v] } }` | The `?` placeholders are rewritten to `$N` to merge with any other parameters in the same WHERE clause. |
| `{ $async: Promise<Filter> }` | Resolved by Model before reaching the connector — passing one directly raises `FilterError`. |

`FilterError` covers all malformed filter cases (multiple keys in `$gt`, empty `$in`, …).

### `execute(query, bindings)`

Wrapper around `pool.query(sql, params)` (joining the active transaction if any). Bindings can be a single `BaseType` or an array. Returns `result.rows` directly.

### Transactions

`connector.transaction(fn)` checks out a single pooled client and pins it as `activeClient`, then runs `BEGIN` / `COMMIT` (or `ROLLBACK` on throw). Every nested connector call (schema operations, `execute`, query / mutate) sees the same client, so the whole tree is wrapped in one Postgres transaction. Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

### `batchInsert`

A single multi-row `INSERT … RETURNING *`. Items contributing different sets of columns are unioned and missing values default to NULL (or the column's declared default). Insert order is preserved in the response.

### `updateAll` / `deleteAll`

Both use `RETURNING *` so the affected rows are returned in one round-trip. `LIMIT` / `OFFSET` from the scope are deliberately ignored — Postgres accepts neither on `DELETE`/`UPDATE`.

### Schema DSL → SQL DDL

| Core DSL                         | PostgreSQL                |
|----------------------------------|---------------------------|
| `t.integer('id', { autoIncrement: true })` | `"id" SERIAL` |
| `t.string('name', { limit: 64 })` | `"name" VARCHAR(64)`     |
| `t.text('body')`                 | `"body" TEXT`            |
| `t.bigint('count')`              | `"count" BIGINT`         |
| `t.float('rate')`                | `"rate" REAL`            |
| `t.decimal('price', { precision: 10, scale: 2 })` | `"price" NUMERIC(10, 2)` |
| `t.boolean('active')`            | `"active" BOOLEAN`       |
| `t.date('day')`                  | `"day" DATE`             |
| `t.datetime / t.timestamp(...)`  | `"…" TIMESTAMP`          |
| `t.json('payload')`              | `"payload" JSONB`        |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. `t.index([col], { unique })` issues a follow-up `CREATE [UNIQUE] INDEX … ON tbl (col)` after the table create. `dropTable` uses `DROP TABLE IF EXISTS`. `hasTable` calls `to_regclass`.

### Schema reflection (`reflectSchema`)

Returns a `TableDefinition[]` for every table in `current_schema()`. Reads `information_schema.tables` / `information_schema.columns` / `information_schema.table_constraints` for column metadata + primary key + UNIQUE constraints, and `pg_index` / `pg_class` for explicit `CREATE INDEX` entries (skipping the auto-created PK / UNIQUE constraint indexes). `nextval(...)` defaults map back to `autoIncrement: true`; `CURRENT_TIMESTAMP` / `now()` to `'currentTimestamp'`. The result feeds straight into `generateSchemaSource(...)` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.

## Testing matrix

CI runs the shared `runModelConformance` suite (every Model feature) against a real PostgreSQL 17 service container.

Locally:

```sh
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres pnpm --filter @next-model/postgres-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
