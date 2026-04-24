# postgres-node

End-to-end demo of `@next-model/postgres-connector` against a real PostgreSQL 17.

## Run it

```sh
pnpm install         # workspace install
pnpm db:up           # docker compose up -d (postgres on :5432)
pnpm start           # runs demo.ts against the live DB
pnpm db:down         # stop + wipe volume when done
```

`DATABASE_URL` overrides the default (`postgres://postgres:postgres@127.0.0.1:5432/nextmodel_demo`).

## What it shows

- Connecting via `new PostgresConnector({ connectionString })`
- Schema DSL → PostgreSQL DDL (`SERIAL` auto-increment, `JSONB` for `t.json(...)`)
- CRUD + `createMany`, `hasMany` association across tables
- Cursor pagination
- A real `connector.transaction(...)` (BEGIN / COMMIT) — every nested call participates
- `await connector.destroy()` for clean shutdown

The demo recreates its tables on every run, so it's safe to re-execute.
