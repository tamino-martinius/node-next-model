---
name: next-model-mysql-connector
description: Native MySQL connector for `@next-model/core`, built directly on `mysql2` with no Knex layer. Use when the user mentions `@next-model/mysql-connector`, "mysql2", "MySQL 8", a "MySQL connector", configuring a "mysql pool", `lastInsertId` / `insertId`, or wiring NextModel models against a single MySQL database.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-mysql-connector

`@next-model/mysql-connector` is a native MySQL connector for `@next-model/core`, built directly on top of [`mysql2`](https://github.com/sidorares/node-mysql2). It uses MySQL-native conventions (backtick quoting, `AUTO_INCREMENT`, the `JSON` column type, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`) without a Knex / dialect-translation layer, exposes the underlying `mysql2` pool directly, and ships only `mysql2` as a runtime dep.

## When to use

- You target **MySQL only** (typically MySQL 8) and don't need multi-driver portability.
- You want a smaller dep footprint and direct access to `mysql2`'s `Pool` features.
- You prefer MySQL-native DDL/quoting over a translated dialect.

## When not to use

- **MariaDB:** use `@next-model/mariadb-connector` instead — it extends this connector and uses `RETURNING *` where MariaDB supports it (which removes the `INSERT` + re-`SELECT` round-trip described below).
- **Multi-dialect** (Postgres + MySQL + SQLite + … behind one driver): use `@next-model/knex-connector`.
- Any other backend: pick the matching native connector from the `next-model` index skill.

## Install

```sh
pnpm add @next-model/mysql-connector mysql2
# or: npm install @next-model/mysql-connector mysql2
```

`mysql2` is a peer/runtime dep — install it alongside.

## Setup

Construct a `MysqlConnector` with either a connection string or a `mysql2` pool config:

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

The pool is exposed as `connector.pool` for raw access.

### Attaching a typed schema

Pass a `DatabaseSchema` (from `defineSchema(...)`) as the optional second arg so `Model({ connector, tableName: 'users' })` infers per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new MysqlConnector(process.env.DATABASE_URL!, { schema });
```

Existing call sites without `{ schema }` keep working unchanged.

## Quick start

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

## Schema mutations

The connector translates the core schema DSL straight to native MySQL DDL — no `CREATE TABLE` + copy round-trip:

| Core DSL                         | MySQL                                    |
|----------------------------------|------------------------------------------|
| `t.integer('id', { autoIncrement: true })` | `` `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY `` |
| `t.string('name', { limit: 64 })` | `` `name` VARCHAR(64) ``                 |
| `t.text('body')`                 | `` `body` TEXT ``                        |
| `t.bigint('counter')`            | `` `counter` BIGINT ``                   |
| `t.float('rate')`                | `` `rate` FLOAT ``                       |
| `t.decimal('price', { precision: 12, scale: 4 })` | `` `price` DECIMAL(12, 4) ``    |
| `t.boolean('active')`            | `` `active` TINYINT(1) ``                |
| `t.date('day')`                  | `` `day` DATE ``                         |
| `t.datetime / t.timestamp(...)`  | `` `…` DATETIME ``                       |
| `t.json('payload')`              | `` `payload` JSON ``                     |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. New tables are created with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`. `t.index(...)` issues a follow-up `CREATE [UNIQUE] INDEX`. `dropTable` uses `DROP TABLE IF EXISTS`. `alterTable(...)` issues native `ALTER TABLE` statements.

`reflectSchema()` reads `information_schema.TABLES` / `COLUMNS` / `STATISTICS` for the current `DATABASE()` and returns a `TableDefinition[]` — `tinyint(1)` round-trips as `boolean`, `EXTRA = 'auto_increment'` flags `autoIncrement: true`, and `CURRENT_TIMESTAMP` defaults map back to `'currentTimestamp'`. The result feeds straight into `generateSchemaSource(...)` for end-to-end `nm-generate-migration schema-from-db` reflection.

## Transactions

```ts
await connector.transaction(async () => {
  await User.create({ name: 'Ada', age: 36 });
  await User.create({ name: 'Linus', age: 54 });
});
```

`connector.transaction(fn)` checks out a single pooled connection and pins it as `activeConnection`, then runs `BEGIN` / `COMMIT` (or `ROLLBACK` on throw). Every nested connector call sees the same connection. Re-entrant `transaction` calls join the outer transaction — there are **no savepoints**, so an inner throw rolls back the whole outer transaction.

## Gotchas

- **No `RETURNING` on `INSERT`.** `batchInsert` issues one bulk `INSERT INTO … VALUES (…), (…)`, captures `insertId` (the **first** auto-increment id under InnoDB's contiguous lock — safe for a single statement), expands `[firstId]` to `[firstId, firstId+1, …]`, and re-fetches every row with a single `WHERE id IN (…)`. If the caller passes the primary key explicitly (e.g. `KeyType.manual` migrations), the connector skips the id-expansion step and re-fetches by the supplied keys.
- **No `RETURNING` on `UPDATE` / `DELETE` either.** `updateAll` / `deleteAll` capture the matching rows up-front with a `SELECT`, then issue the mutation against the same WHERE clause. `LIMIT` / `OFFSET` from the scope are dropped at the mutation step.
- **Booleans are coerced to `0` / `1`** at the parameter boundary in `execute(query, bindings)`. The DSL `t.boolean(...)` lands as `TINYINT(1)` and `tinyint(1)` round-trips back to `boolean` via `reflectSchema`.
- **`DATETIME`, not `TIMESTAMP`.** Both `t.datetime(...)` and `t.timestamp(...)` map to `DATETIME` to avoid MySQL's `TIMESTAMP` 2038/timezone-conversion footguns.
- **JSON columns** map to the native `JSON` type (`t.json('payload')` → `` `payload` JSON ``).
- **Identifier quoting & validation.** All identifiers are quoted with backticks (`` `col` ``); camelCase column names round-trip without renaming. Identifiers are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before quoting — anything else throws `PersistenceError` to keep injection vectors closed.
- **`$like` is collation-driven.** With `utf8mb4_*_ci` collations (the default for `CHARSET=utf8mb4`) `$like` matches case-insensitively; switch the collation if you need binary semantics.
- **`$async` filters** must be resolved by Model before reaching the connector — passing one directly raises `FilterError`.
- **Re-entrant transactions don't get savepoints.** Plan rollback semantics around the outermost `transaction(fn)`.

## See also

- `next-model-core` — the `Model({...})` factory, query DSL, validators, callbacks, associations, and the `Connector` interface this package implements.
- `next-model-mariadb-connector` — extends this connector and uses `RETURNING *` on MariaDB; pick it instead when targeting MariaDB.
- `next-model-knex-connector` — multi-dialect connector via Knex; pick it instead when one app spans multiple SQL dialects.
- `next-model-migrations` — versioned migration runner that drives this connector's native `ALTER TABLE` / `CREATE INDEX` / `DROP TABLE` ops.
