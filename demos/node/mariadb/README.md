# mariadb-node

End-to-end demo of `@next-model/mariadb-connector` against a real MariaDB 11.

## Run it

```sh
pnpm install
pnpm db:up           # docker compose up -d (mariadb on :3306)
pnpm start
pnpm db:down
```

`DATABASE_URL` overrides the default (`mysql://root:mariadb@127.0.0.1:3306/nextmodel_demo`).

## What it shows (the parts that differ from the MySQL demo)

- `INSERT … RETURNING *` (MariaDB 10.5+) — `createMany` returns full rows in a single round-trip; no `insertId` expansion + re-fetch dance.
- `DELETE … RETURNING *` (MariaDB 10.0+) — `deleteAll` returns the deleted rows directly.
- **`updateAll` falls through** to the inherited SELECT-then-UPDATE — MariaDB does **not** support `UPDATE … RETURNING` yet.
- `t.json(...)` becomes `LONGTEXT CHECK (JSON_VALID(...))` (MariaDB's `JSON` is an alias for `LONGTEXT`); the CHECK constraint preserves the validation guarantee MySQL's native `JSON` type provides.

The demo recreates its tables on every run, so it's safe to re-execute.
