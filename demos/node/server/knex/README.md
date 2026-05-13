# knex-node

End-to-end demo of `@next-model/knex-connector` against three different backends — pick one with `KNEX_DEMO_CLIENT`.

## Run it

### Default (sqlite, in-memory, no docker)

```sh
pnpm install
pnpm start                # equivalent to pnpm start:sqlite
```

### Postgres

```sh
pnpm db:up:pg             # docker compose --profile pg up -d
pnpm start:pg
pnpm db:down
```

### MySQL

```sh
pnpm db:up:mysql          # docker compose --profile mysql up -d
pnpm start:mysql
pnpm db:down
```

`DATABASE_URL` overrides the default URL for the chosen client.

## What it shows

The exact same `User` model + business logic running against three completely different SQL backends with no code change — that's the point of the Knex connector.

- Schema DSL → dialect-specific DDL (sqlite uses `INTEGER PRIMARY KEY AUTOINCREMENT`, pg uses `SERIAL`, mysql uses `INT AUTO_INCREMENT`).
- `createMany` returns full instances on every backend (sqlite per-row insert, pg `RETURNING *`, mysql `insertId` expansion).
- `BEGIN`/`COMMIT` transactions everywhere.
- Each run drops and recreates the `users` table for idempotency.
