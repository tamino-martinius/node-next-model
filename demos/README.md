# NextModel demos

Self-contained, runnable projects — grouped by runtime (`node` / `react` / `nextjs`). Each leaf directory is its own pnpm workspace member.

```
demos/
├── node/             # Node scripts — single `demo.ts` runs via `pnpm start`
│   ├── memory/
│   ├── sqlite/
│   ├── local-storage/
│   ├── postgres/
│   ├── mysql/
│   ├── mariadb/
│   ├── redis/
│   ├── valkey/
│   ├── mongodb/
│   ├── knex/
│   ├── aurora-data-api/
│   ├── express-rest-api/
│   └── graphql-api/
├── react/            # React / Vite apps
│   └── todo/
└── nextjs/           # Next.js App Router apps
    └── todo/
```

## Directory

| Demo | Adapter / connector | Infra |
|---|---|---|
| [`node/memory`](./node/memory) | `@next-model/core` (`MemoryConnector`) | none |
| [`node/sqlite`](./node/sqlite) | `@next-model/sqlite-connector` | none (in-memory db) |
| [`node/local-storage`](./node/local-storage) | `@next-model/local-storage-connector` | none (in-memory `localStorage` shim) |
| [`node/postgres`](./node/postgres) | `@next-model/postgres-connector` | `docker compose up -d` (postgres:17) |
| [`node/mysql`](./node/mysql) | `@next-model/mysql-connector` | `docker compose up -d` (mysql:8) |
| [`node/mariadb`](./node/mariadb) | `@next-model/mariadb-connector` | `docker compose up -d` (mariadb:11) |
| [`node/redis`](./node/redis) | `@next-model/redis-connector` | `docker compose up -d` (redis:7) |
| [`node/valkey`](./node/valkey) | `@next-model/valkey-connector` | `docker compose up -d` (valkey:8) |
| [`node/mongodb`](./node/mongodb) | `@next-model/mongodb-connector` | `docker compose up -d` (mongo:7) |
| [`node/knex`](./node/knex) | `@next-model/knex-connector` against sqlite (default), or pg / mysql via `KNEX_DEMO_CLIENT` | sqlite: none; `docker compose --profile pg\|mysql up -d` |
| [`node/aurora-data-api`](./node/aurora-data-api) | `@next-model/aurora-data-api-connector` via `MockDataApiClient` (in-memory sqlite) | none |
| [`node/express-rest-api`](./node/express-rest-api) | Express 5 + `@next-model/express-rest-api` + `@next-model/sqlite-connector` | none (in-memory sqlite) |
| [`node/graphql-api`](./node/graphql-api) | `graphql-http` + `@next-model/graphql-api` + `@next-model/sqlite-connector` | none (in-memory sqlite) |
| [`react/todo`](./react/todo) | React 19 + Vite + `@next-model/local-storage-connector` (multi-user via per-user prefix) | none (browser) |
| [`nextjs/todo`](./nextjs/todo) | Next.js 15 App Router + `@next-model/sqlite-connector` — server components + server actions, multi-user via cookie | none (sqlite file at `./.data/`) |

Service-backed demos expose two helper scripts:

```sh
pnpm db:up    # docker compose up -d (boots the service)
pnpm db:down  # docker compose down -v (stops + wipes the volume)
```

## Running a demo

```sh
cd demos/<bucket>/<name>
pnpm install        # workspace install — links to local connector packages
pnpm start
```

`pnpm start` runs `node --experimental-strip-types demo.ts` (for node-runtime demos) against your locally-built copy of the connector. To pick up changes made to the connector source, run `pnpm -r --filter @next-model/<that-connector> build` from the repo root first.

React demos use `pnpm dev` (Vite); Next.js demos use `pnpm dev` / `pnpm build` / `pnpm start`.

## Structure of each demo

- `demo.ts` (node demos) or `src/` (Vite / Next.js demos) — single entry point. Defines a `User` (and where it makes sense, a `Post`) Model, runs through CRUD, queries, transactions, prints results.
- `package.json` — workspace member, declares only the packages it actually uses.
- `README.md` — one-paragraph summary + the exact run invocation.
