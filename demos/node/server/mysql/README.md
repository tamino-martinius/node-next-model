# mysql-node

End-to-end demo of `@next-model/mysql-connector` against a real MySQL 8.

## Run it

```sh
pnpm install
pnpm db:up           # docker compose up -d (mysql on :3306)
pnpm start
pnpm db:down
```

`DATABASE_URL` overrides the default (`mysql://root:mysql@127.0.0.1:3306/nextmodel_demo`).

## What it shows

- Connecting via `new MysqlConnector(uri)`
- Schema DSL → MySQL DDL (`INT NOT NULL AUTO_INCREMENT PRIMARY KEY` for auto-increments, `utf8mb4` charset)
- `createMany` returns full instances even though MySQL has no `INSERT ... RETURNING` — the connector expands `insertId` to consecutive ids and re-fetches in one round-trip
- `hasMany` association
- Real MySQL `transaction(...)` (BEGIN / COMMIT)

The demo recreates its tables on every run, so it's safe to re-execute.
