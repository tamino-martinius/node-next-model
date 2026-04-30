---
name: next-model-mariadb-connector
description: Native MariaDB connector for `@next-model/core`. `@next-model/mariadb-connector` extends the MySQL connector and uses MariaDB's `RETURNING *` for `INSERT`/`DELETE` to skip the SELECT-after-write dance. Use when the user mentions "MariaDB connector", targets MariaDB 11 / 10.5+, asks about the `RETURNING` clause, or wants `JSON_VALID` enforcement on JSON columns.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-mariadb-connector

`@next-model/mariadb-connector` is a thin extension of [`@next-model/mysql-connector`](../next-model-mysql-connector/SKILL.md). It inherits the entire MySQL surface (identifier quoting, filter compilation, transactions, schema DSL, `reflectSchema`) and only swaps the no-`RETURNING` insert / delete paths for native `INSERT … RETURNING *` and `DELETE … RETURNING *`. MariaDB has no `UPDATE … RETURNING`, so `updateAll` falls through to the inherited SELECT-then-UPDATE. JSON columns emit `LONGTEXT CHECK (JSON_VALID(...))` so the validation guarantee survives MariaDB's lack of a real `JSON` type.

## When to use

- Targeting **MariaDB ≥ 10.5** and you want the cleaner / faster code path that `RETURNING *` enables.
- You want native `JSON_VALID` enforcement on `t.json(...)` columns in the schema DSL.
- Production runs on MariaDB 11 (the version CI tests against).

## When not to use

- Storage is **MySQL** (or you want one connector that targets both at runtime) — use [`@next-model/mysql-connector`](../next-model-mysql-connector/SKILL.md). It still works against MariaDB; you just lose the `RETURNING` shortcut.
- Older MariaDB without `INSERT … RETURNING` (pre-10.5) — fall back to the MySQL connector.
- You need cross-dialect portability (Postgres + MariaDB + SQLite from one binary) — use `@next-model/knex-connector`.

## Install

```sh
pnpm add @next-model/mariadb-connector mysql2
# or: npm install @next-model/mariadb-connector mysql2
```

`mysql2` is the same peer driver the parent connector uses — MariaDB is wire-compatible, so no separate driver is needed.

## Setup

```ts
import { MariaDbConnector } from '@next-model/mariadb-connector';

const connector = new MariaDbConnector('mariadb://app:secret@host:3306/myapp');

await connector.destroy();
```

Pass an optional `extras: { schema }` second arg to attach a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

```ts
const connector = new MariaDbConnector(process.env.DATABASE_URL!, { schema });
```

The constructor signature, pool config, and runtime API are otherwise identical to `MysqlConnector`'s.

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { MariaDbConnector } from '@next-model/mariadb-connector';

const schema = defineSchema({
  users: {
    columns: {
      id:   { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age:  { type: 'integer' },
    },
  },
});

const connector = new MariaDbConnector('mariadb://root:mariadb@127.0.0.1:3306/myapp', { schema });

class User extends Model({
  connector,
  tableName: 'users',
}) {}

// One round-trip — INSERT ... RETURNING *.
const ada = await User.create({ name: 'Ada', age: 36 });

await User.filterBy({ $gt: { age: 30 } }).count(); // 1
await ada.destroy(); // DELETE ... RETURNING *, also one round-trip.
```

## What's different from MysqlConnector

The override surface is intentionally tiny:

```ts
import { MysqlConnector, quoteIdent } from '@next-model/mysql-connector';

class MariaDbConnector extends MysqlConnector {
  async batchInsert(table, _keys, items) {
    // INSERT … RETURNING * — one round-trip, no consecutive-id trick
  }
  async deleteAll(scope) {
    // DELETE … RETURNING * — no SELECT capture
  }
  // updateAll is inherited (MariaDB has no UPDATE ... RETURNING).
}
```

Concrete differences vs. `MysqlConnector`:

- **`batchInsert`** — single `INSERT … RETURNING *` instead of MySQL's four-step dance (`INSERT`, read `insertId`, expand to consecutive ids, `SELECT * WHERE id IN (…)`).
- **`deleteAll`** — single `DELETE … RETURNING *` instead of `SELECT` + `DELETE`.
- **`updateAll`** — *inherited unchanged* (MariaDB does not support `UPDATE … RETURNING`).
- **JSON columns** — emitted as `LONGTEXT CHECK (JSON_VALID(...))` so validation is enforced even though MariaDB's `JSON` is just a `LONGTEXT` alias.
- **`reflectSchema`** — inherited verbatim; MariaDB's `information_schema` (`TABLES`, `COLUMNS`, `STATISTICS`) is wire-compatible with MySQL's, so introspection feeds straight into `generateSchemaSource(...)` for `nm-generate-migration schema-from-db`.

Everything else (filters, transactions, soft deletes, the schema DSL) comes from the parent connector.

## See also

- [`next-model-core`](../next-model/SKILL.md) — the `Model` factory, query DSL, and `Connector` interface this extends.
- [`next-model-mysql-connector`](../next-model-mysql-connector/SKILL.md) — parent connector; inherits the entire surface, full option reference.
- [`next-model-knex-connector`](../next-model-knex-connector/SKILL.md) — reach for this only if you need multi-dialect portability through one driver.
- [`next-model-migrations`](../next-model-migrations/SKILL.md) — versioned migrations on top of any connector, including this one.
