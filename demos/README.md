# NextModel demos

Self-contained scripts that show NextModel against each connector. Every demo is a single `demo.ts` runnable via Node's built-in TypeScript stripping (`node --experimental-strip-types`); no `tsx`, `ts-node`, or build step needed.

| Demo | Connector | Infra |
|---|---|---|
| [`memory-node`](./memory-node) | `@next-model/core` (`MemoryConnector`) | none |
| [`sqlite-node`](./sqlite-node) | `@next-model/sqlite-connector` | none (in-memory db) |
| [`local-storage-node`](./local-storage-node) | `@next-model/local-storage-connector` | none (uses an in-memory `localStorage` shim) |
| [`postgres-node`](./postgres-node) | `@next-model/postgres-connector` | `docker compose up -d` (postgres:17) |
| [`mysql-node`](./mysql-node) | `@next-model/mysql-connector` | `docker compose up -d` (mysql:8) |
| [`mariadb-node`](./mariadb-node) | `@next-model/mariadb-connector` | `docker compose up -d` (mariadb:11) |
| [`redis-node`](./redis-node) | `@next-model/redis-connector` | `docker compose up -d` (redis:7) |
| [`valkey-node`](./valkey-node) | `@next-model/valkey-connector` | `docker compose up -d` (valkey/valkey:8) |
| [`mongodb-node`](./mongodb-node) | `@next-model/mongodb-connector` | `docker compose up -d` (mongo:7) |
| [`knex-node`](./knex-node) | `@next-model/knex-connector` against sqlite (default), or pg / mysql via the `KNEX_DEMO_CLIENT` env var | none for sqlite; `docker compose --profile pg \| mysql up -d` for the others |
| [`aurora-data-api-node`](./aurora-data-api-node) | `@next-model/aurora-data-api-connector` against the bundled `MockDataApiClient` (in-memory sqlite) | none |
| [`react-todo`](./react-todo) | React 19 + Vite UI on top of `@next-model/local-storage-connector` (multi-user via per-user prefix) | none (browser) |
| [`nextjs-todo`](./nextjs-todo) | Next.js 15 App Router; server components call `@next-model/sqlite-connector` directly, server actions handle every mutation. User → tasks foreign key, multi-user via cookie. | none (sqlite file at `./.data/`) |
| [`express-rest-api-node`](./express-rest-api-node) | Express 5 + `@next-model/express-rest-api` on top of `@next-model/sqlite-connector`; drives every default action through per-action auth + response mapping | none (in-memory sqlite) |
| [`graphql-api-node`](./graphql-api-node) | `graphql-http` + `@next-model/graphql-api` on top of `@next-model/sqlite-connector`; drives every default op through per-op auth + per-row serialize | none (in-memory sqlite) |

Service-backed demos all expose two helper scripts:

```sh
pnpm db:up    # docker compose up -d (boots the service)
pnpm db:down  # docker compose down -v (stops + wipes the volume)
```

## Running a demo

```sh
cd demos/<name>
pnpm install        # workspace install — links to the local connector packages
pnpm start
```

`pnpm start` runs `node --experimental-strip-types demo.ts` against your locally-built copy of the connector. To pick up changes you make to the connector source, run `pnpm -r --filter @next-model/<that-connector> build` from the repo root first.

## Structure of each demo

- `demo.ts` — single entry point. Defines a `User` (and where it makes sense, a `Post`) Model, runs through CRUD, queries, transactions, prints results.
- `package.json` — workspace member, declares only the connector packages it actually uses.
- `README.md` — one-paragraph summary + the exact `pnpm start` invocation.
