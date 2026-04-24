# @next-model/mariadb-connector

Native MariaDB connector for [`@next-model/core`](../core), built as a thin extension of [`@next-model/mysql-connector`](../mysql-connector).

## Why a separate package?

MariaDB is wire-compatible with MySQL, so [`mysql2`](https://github.com/sidorares/node-mysql2) connects to it without modification. The reason this connector exists is what MariaDB lets us do *server-side* that MySQL doesn't:

- **`INSERT … RETURNING *`** (MariaDB 10.5+) and **`DELETE … RETURNING *`** (MariaDB 10.0+). The MySQL connector has to issue an extra `SELECT` to capture affected rows and expand `insertId` to consecutive ids for `batchInsert`; this connector skips that dance for those two cases.
- `UPDATE` is the gap: MariaDB does **not** support `UPDATE … RETURNING`, so `updateAll` falls through to the inherited SELECT-then-UPDATE.
- **JSON validation** without a native `JSON` type — MariaDB's `JSON` is an alias for `LONGTEXT`, so we emit `LONGTEXT CHECK (JSON_VALID(...))`, which gives back the validation guarantee.

Everything else (identifier quoting, filter compilation, transactions, the rest of the schema DSL) is inherited from `@next-model/mysql-connector`.

## When to pick this over `@next-model/mysql-connector`

- You're targeting MariaDB ≥ 10.5 and want the cleaner / faster code path that `RETURNING` makes possible.
- You want native `JSON_VALID` enforcement on `t.json(...)` columns.

If you might switch between MySQL and MariaDB at runtime, the MySQL connector still works against MariaDB — you just lose the `RETURNING` shortcut.

## Installation

```sh
pnpm add @next-model/mariadb-connector mysql2
# or: npm install @next-model/mariadb-connector mysql2
```

## Constructing the connector

```ts
import { MariaDbConnector } from '@next-model/mariadb-connector';

const connector = new MariaDbConnector('mariadb://app:secret@host:3306/myapp');

await connector.destroy();
```

The constructor signature, pool config, and runtime API are identical to `MysqlConnector`'s — see [its README](../mysql-connector/README.md) for the full surface.

## What the override actually does

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

`batchInsert` previously needed:

1. `INSERT INTO … VALUES (…), (…)`
2. read `insertId` (= first auto-increment id)
3. compute `[firstId, firstId+1, …]`
4. `SELECT * … WHERE id IN (…)` to re-fetch

Now it's just step 1 with `RETURNING *`. Same pattern for `updateAll` / `deleteAll`.

## Testing matrix

CI runs the shared `runModelConformance` suite (every Model feature) plus `RETURNING`-specific assertions against a real MariaDB 11 service container.

Locally:

```sh
DATABASE_URL=mysql://root:mariadb@127.0.0.1:3306/test pnpm --filter @next-model/mariadb-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
