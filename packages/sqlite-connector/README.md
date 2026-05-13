# @next-model/sqlite-connector

Native SQLite connector for [`@next-model/core`](../core), built directly on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3). No Knex, no extra query-builder layer.

## When to pick this over `@next-model/knex-connector`

- You target SQLite only and don't need the multi-driver flexibility Knex provides.
- You want the synchronous, near-zero-overhead `better-sqlite3` driver under the hood.
- You don't want to ship Knex (smaller dep footprint).

If you also need MySQL / Postgres / MariaDB / MSSQL too, keep `@next-model/knex-connector`.

## Installation

```sh
pnpm add @next-model/sqlite-connector better-sqlite3
# or: npm install @next-model/sqlite-connector better-sqlite3
```

## Constructing the connector

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

The underlying handle is exposed as `connector.db` if you need raw access.

### Attaching a typed schema

Pass a `DatabaseSchema` (from `defineSchema(...)`) as the optional second argument so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

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

The `extras: { schema }` arg is purely a type-level decoration — the runtime contract is unchanged, and existing constructor call sites without a schema keep working.

## Wiring a Model

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

## Feature → connector specifics

### Identifiers

All identifiers are quoted with `"…"`. Identifiers are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before quoting; anything else throws `PersistenceError` to keep injection vectors closed. camelCase columns (`createdAt`, `discardedAt`, …) round-trip without renaming.

### Filter operators

| Filter | SQL produced |
|--------|--------------|
| `{ name: 'Ada' }` | `"name" = ?` |
| `{ $or: [a, b] }` | `(…) OR (…)` |
| `{ $not: f }`     | `NOT (…)` |
| `{ $in: { col: [...] } }`  | `"col" IN (?, ?, …)` |
| `{ $notIn: { col: [...] } }` | `"col" NOT IN (…)` |
| `{ $null: 'col' }` | `"col" IS NULL` |
| `{ $notNull: 'col' }` | `"col" IS NOT NULL` |
| `{ $between: { col: { from, to } } }` | `"col" BETWEEN ? AND ?` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `"col" > ?` etc. |
| `{ $like: { col: 'pat%' } }` | `"col" LIKE ?` (SQLite is case-insensitive for ASCII by default). |
| `{ $raw: { $query: 'col = ?', $bindings: [v] } }` | The raw fragment is wrapped in `(...)`; bindings are appended in order. |
| `{ $async: Promise<Filter> }` | Resolved by Model before reaching the connector — passing one directly raises `FilterError`. |

### Parameter coercion

`Date` and `boolean` bindings are normalised at the boundary:

- `Date` → ISO 8601 string (`new Date().toISOString()`).
- `boolean` → `1` / `0`.

This lets you pass JS-native values directly through Model.

### `execute(query, bindings)`

Wraps `db.prepare(sql).all(...params)`. Bindings can be a single value or an array.

### Transactions

`connector.transaction(fn)` issues raw `BEGIN`, then either `COMMIT` (success) or `ROLLBACK` (throw). Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

### `batchInsert`

A single multi-row `INSERT … RETURNING *` (SQLite ≥ 3.35, included with the version `better-sqlite3` ships). Items contributing different sets of columns are unioned.

### `updateAll` / `deleteAll`

Both use `RETURNING *` so the affected rows are returned in one round-trip. `LIMIT` / `OFFSET` from the scope are deliberately ignored — SQLite refuses both on `DELETE`/`UPDATE` (without `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`).

### Schema DSL → SQL DDL

| Core DSL                         | SQLite                       |
|----------------------------------|------------------------------|
| `t.integer('id', { autoIncrement: true })` | `"id" INTEGER PRIMARY KEY AUTOINCREMENT` |
| `t.string('name', { limit: 64 })` | `"name" VARCHAR(64)`        |
| `t.string('name')`               | `"name" TEXT`                |
| `t.text('body')`                 | `"body" TEXT`                |
| `t.integer('n')` / `t.bigint('n')` | `"n" INTEGER`              |
| `t.float('rate')`                | `"rate" REAL`                |
| `t.decimal('p', { precision, scale })` | `"p" NUMERIC(p, s)`     |
| `t.boolean('flag')`              | `"flag" INTEGER` (0 / 1)     |
| `t.date / t.datetime / t.timestamp / t.json` | `TEXT` (SQLite has no native types — values are coerced to strings on insert and stored verbatim) |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. `t.index([col], { unique })` issues a follow-up `CREATE [UNIQUE] INDEX … ON tbl (col)` after the table create. `dropTable` uses `DROP TABLE IF EXISTS`.

## Testing matrix

The shared `runModelConformance` suite (every Model feature) runs against an in-memory database every commit — no service container required.

```sh
pnpm --filter @next-model/sqlite-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
