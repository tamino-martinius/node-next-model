# @next-model/mysql-connector

Native MySQL connector for [`@next-model/core`](../core), built directly on [`mysql2`](https://github.com/sidorares/node-mysql2). No Knex, no extra query-builder layer.

## When to pick this over `@next-model/knex-connector`

- You target MySQL only and don't need the multi-driver flexibility Knex provides.
- You want a smaller dep footprint (`mysql2` only) and direct access to its `Pool` features.
- You prefer the connector to use MySQL-native conventions (backtick quoting, `AUTO_INCREMENT`, `JSON` type) without a dialect-translation layer.

If you need Postgres / SQLite / MariaDB / MSSQL too, keep `@next-model/knex-connector`.

## Installation

```sh
pnpm add @next-model/mysql-connector mysql2
# or: npm install @next-model/mysql-connector mysql2
```

## Constructing the connector

```ts
import { MysqlConnector } from '@next-model/mysql-connector';

// Connection string
const c1 = new MysqlConnector('mysql://app:secret@host:3306/myapp');

// mysql2 pool config
const c2 = new MysqlConnector({
  host: 'localhost',
  user: 'app',
  password: 'secret',
  database: 'myapp_production',
  connectionLimit: 20,
});

// Programmatic shutdown
await c1.destroy();
```

The pool is exposed as `connector.pool` if you need raw access.

## Wiring a Model

```ts
import { Model } from '@next-model/core';
import { MysqlConnector } from '@next-model/mysql-connector';

const connector = new MysqlConnector(process.env.DATABASE_URL!);

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}
```

## Feature → connector specifics

### Identifiers

All identifiers are quoted with backticks (`` `col` ``). camelCase column names (`createdAt`, `discardedAt`, …) round-trip without renaming. Identifiers are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before quoting; anything else throws `PersistenceError` to keep injection vectors closed.

### Filter operators

| Filter | SQL produced |
|--------|--------------|
| `{ name: 'Ada' }` | `` `name` = ? `` |
| `{ $or: [a, b] }` | `(…) OR (…)` |
| `{ $not: f }`     | `NOT (…)` |
| `{ $in: { col: [...] } }`  | `` `col` IN (?, ?, …) `` |
| `{ $notIn: { col: [...] } }` | `` `col` NOT IN (…) `` |
| `{ $null: 'col' }` | `` `col` IS NULL `` |
| `{ $notNull: 'col' }` | `` `col` IS NOT NULL `` |
| `{ $between: { col: { from, to } } }` | `` `col` BETWEEN ? AND ? `` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `` `col` > ? `` etc. |
| `{ $like: { col: 'pat%' } }` | `` `col` LIKE ? `` (MySQL is case-insensitive for `utf8mb4_*_ci` collations). |
| `{ $raw: { $query: 'col = ?', $bindings: [v] } }` | The raw fragment is wrapped in `(...)`; bindings are appended to the parameter array. |
| `{ $async: Promise<Filter> }` | Resolved by Model before reaching the connector — passing one directly raises `FilterError`. |

### `execute(query, bindings)`

Wrapper around `pool.query(sql, params)` (joining the active connection if any). Bindings can be a single value or an array. `boolean` values are coerced to `0`/`1` at the parameter boundary.

### Transactions

`connector.transaction(fn)` checks out a single pooled connection and pins it as `activeConnection`, then runs `BEGIN` / `COMMIT` (or `ROLLBACK` on throw). Every nested connector call sees the same connection. Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

### `batchInsert`

MySQL doesn't support `RETURNING` on INSERT, so the connector:

1. Issues one bulk `INSERT INTO … VALUES (…), (…)`.
2. Captures `insertId` (which is the **first** auto-increment id under InnoDB's contiguous lock — safe for a single statement).
3. Expands `[firstId]` to `[firstId, firstId+1, …]` and re-fetches every row in a single `WHERE id IN (…)`.

When the caller passes the primary key explicitly (e.g. `KeyType.manual` migrations), the connector skips the id-expansion step and re-fetches by the supplied keys.

### `updateAll` / `deleteAll`

MySQL also has no `RETURNING` on `UPDATE` / `DELETE`. The connector captures the matching rows up-front with a `SELECT`, then issues the mutation against the same WHERE clause. `LIMIT` / `OFFSET` from the scope are dropped.

### Schema DSL → SQL DDL

| Core DSL                         | MySQL                                    |
|----------------------------------|------------------------------------------|
| `t.integer('id', { autoIncrement: true })` | `` `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY `` |
| `t.string('name', { limit: 64 })` | `` `name` VARCHAR(64) ``                 |
| `t.text('body')`                 | `` `body` TEXT ``                        |
| `t.bigint('counter')`            | `` `counter` BIGINT ``                   |
| `t.float('rate')`                | `` `rate` FLOAT ``                       |
| `t.decimal('price', { precision: 12, scale: 4 })` | `` `price` DECIMAL(12, 4) ``      |
| `t.boolean('active')`            | `` `active` TINYINT(1) ``                |
| `t.date('day')`                  | `` `day` DATE ``                         |
| `t.datetime / t.timestamp(...)`  | `` `…` DATETIME ``                       |
| `t.json('payload')`              | `` `payload` JSON ``                     |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. New tables are created with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`. `t.index(...)` issues a follow-up `CREATE [UNIQUE] INDEX`. `dropTable` uses `DROP TABLE IF EXISTS`.

### Schema reflection (`reflectSchema`)

Returns a `TableDefinition[]` for every base table in the current `DATABASE()`. Reads `information_schema.TABLES` / `information_schema.COLUMNS` for column types / defaults / nullability / `VARCHAR(N)` limits / `DECIMAL(p,s)` precision and scale, and `information_schema.STATISTICS` for primary key + index definitions. `tinyint(1)` round-trips as `boolean`; `EXTRA = 'auto_increment'` flags `autoIncrement: true`; `CURRENT_TIMESTAMP` defaults map back to `'currentTimestamp'`. The result feeds straight into `generateSchemaSource(...)` from `@next-model/core` for end-to-end `nm-generate-migration schema-from-db` reflection.

## Testing matrix

CI runs the shared `runModelConformance` suite (every Model feature) against a real MySQL 8 service container.

Locally:

```sh
DATABASE_URL=mysql://root:mysql@127.0.0.1:3306/test pnpm --filter @next-model/mysql-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
