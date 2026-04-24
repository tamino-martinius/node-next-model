# NextModel demos

Self-contained, runnable projects — grouped by runtime. `node/` is split into `server/` (needs Node / a DB / a native dep) and `client/` (also runs in a browser under the same workspace links). `react/` is Vite; `nextjs/` is App Router.

```
demos/
├── node/
│   ├── server/        # server-only: DB drivers, HTTP frameworks, native modules
│   │   ├── sqlite/, postgres/, mysql/, mariadb/, redis/, valkey/, mongodb/
│   │   ├── knex/, aurora-data-api/
│   │   ├── express-rest-api/, graphql-api/
│   └── client/        # safe in browser: pure-JS storage, no Node-only APIs
│       ├── memory/
│       └── local-storage/
├── react/
│   └── todo/
└── nextjs/
    ├── todo/          # server components + server actions
    └── api/           # REST route handlers via @next-model/nextjs-api
```

## Directory

| Demo | Adapter / connector | Infra |
|---|---|---|
| [`node/client/memory`](./node/client/memory) | `@next-model/core` (`MemoryConnector`) | none |
| [`node/client/local-storage`](./node/client/local-storage) | `@next-model/local-storage-connector` | none (in-memory `localStorage` shim) |
| [`node/server/sqlite`](./node/server/sqlite) | `@next-model/sqlite-connector` | none (in-memory db) |
| [`node/server/postgres`](./node/server/postgres) | `@next-model/postgres-connector` | `docker compose up -d` (postgres:17) |
| [`node/server/mysql`](./node/server/mysql) | `@next-model/mysql-connector` | `docker compose up -d` (mysql:8) |
| [`node/server/mariadb`](./node/server/mariadb) | `@next-model/mariadb-connector` | `docker compose up -d` (mariadb:11) |
| [`node/server/redis`](./node/server/redis) | `@next-model/redis-connector` | `docker compose up -d` (redis:7) |
| [`node/server/valkey`](./node/server/valkey) | `@next-model/valkey-connector` | `docker compose up -d` (valkey:8) |
| [`node/server/mongodb`](./node/server/mongodb) | `@next-model/mongodb-connector` | `docker compose up -d` (mongo:7) |
| [`node/server/knex`](./node/server/knex) | `@next-model/knex-connector` (sqlite default, env-switchable pg/mysql) | sqlite: none; `docker compose --profile pg\|mysql up -d` |
| [`node/server/aurora-data-api`](./node/server/aurora-data-api) | `@next-model/aurora-data-api-connector` via `MockDataApiClient` | none |
| [`node/server/express-rest-api`](./node/server/express-rest-api) | Express 5 + `@next-model/express-rest-api` + `@next-model/sqlite-connector` | none |
| [`node/server/graphql-api`](./node/server/graphql-api) | `graphql-http` + `@next-model/graphql-api` + `@next-model/sqlite-connector` | none |
| [`react/todo`](./react/todo) | React 19 + Vite + `@next-model/local-storage-connector` (multi-user via per-user prefix) | none (browser) |
| [`nextjs/todo`](./nextjs/todo) | Next.js 15 App Router + `@next-model/sqlite-connector` — server components + server actions | none (sqlite file at `./.data/`) |
| [`nextjs/api`](./nextjs/api) | Next.js 15 + `@next-model/nextjs-api` — REST route handlers (`app/api/users/route.ts` + `app/api/users/[id]/route.ts`) | none (sqlite file at `./.data/`) |

Service-backed demos expose two helper scripts:

```sh
pnpm db:up    # docker compose up -d
pnpm db:down  # docker compose down -v
```

## Running a demo

```sh
cd demos/<bucket>/<name>
pnpm install
pnpm start    # node demos: node --experimental-strip-types demo.ts
pnpm dev      # react / nextjs demos
```

Made changes to a connector source? Rebuild its package first:

```sh
pnpm -r --filter @next-model/<that-connector> build
```

## Structure of each demo

- node demos: one `demo.ts` that walks through CRUD / queries / transactions / paginate / paginateCursor against the target connector, plus a `README.md` with the exact invocation.
- react demos: Vite + a self-contained `src/`.
- nextjs demos: App Router, `app/…` + optional `lib/`.

Server-side demos can freely use native / server-only packages (`better-sqlite3`, `pg`, `mysql2`, `redis`, `mongodb`, `express`, `graphql-http`, …). Client-side demos stay on pure-JS modules so a hypothetical browser bundle would work unchanged.
