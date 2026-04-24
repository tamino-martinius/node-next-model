# NextModel

A typed, promise-based ORM for TypeScript. Define models with a factory, chain immutable scopes, plug in any storage via the `Connector` interface, and run schema migrations against the same connector.

This repository is a pnpm workspace; each published package lives under `packages/`.

| Package | Purpose |
|---------|---------|
| [`@next-model/core`](./packages/core) | Model factory, chainable query DSL, validators, callbacks, soft deletes, associations, in-memory connector. |
| [`@next-model/knex-connector`](./packages/knex-connector) | SQL connector backed by Knex 3 (sqlite3 / Postgres / MySQL / MariaDB / Oracle / MSSQL). |
| [`@next-model/postgres-connector`](./packages/postgres-connector) | Native PostgreSQL connector using `node-postgres` directly — no Knex. |
| [`@next-model/sqlite-connector`](./packages/sqlite-connector) | Native SQLite connector using `better-sqlite3` directly — no Knex. |
| [`@next-model/mysql-connector`](./packages/mysql-connector) | Native MySQL connector using `mysql2` directly — no Knex. |
| [`@next-model/mariadb-connector`](./packages/mariadb-connector) | Native MariaDB connector. Extends `mysql-connector` and uses `RETURNING *`. |
| [`@next-model/redis-connector`](./packages/redis-connector) | Redis connector — HASH per row + ZSET of ids per table. |
| [`@next-model/valkey-connector`](./packages/valkey-connector) | Valkey connector. Extends `redis-connector` (Valkey is wire-compatible with Redis). |
| [`@next-model/mongodb-connector`](./packages/mongodb-connector) | Native MongoDB connector using the official `mongodb` driver. |
| [`@next-model/aurora-data-api-connector`](./packages/aurora-data-api-connector) | Connector for AWS Aurora Serverless v1 (RDS Data API). |
| [`@next-model/local-storage-connector`](./packages/local-storage-connector) | Browser `localStorage` connector. Inherits from `MemoryConnector`. |
| [`@next-model/migrations`](./packages/migrations) | Connector-agnostic schema migration runner with optional dependency graph. |
| [`@next-model/express-rest-api`](./packages/express-rest-api) | Express 5 REST adapter — eight default CRUD actions with per-action auth + response-mapping hooks. |
| [`@next-model/graphql-api`](./packages/graphql-api) | GraphQL schema generator — six default CRUD operations with per-operation auth + per-row response mapping. |
| [`@next-model/nextjs-api`](./packages/nextjs-api) | Next.js App Router adapter — `{ GET, POST, PATCH, DELETE }` route-handler exports with the same auth + mapping hook surface. |
| [`@next-model/migrations-generator`](./packages/migrations-generator) | CLI (`nm-generate-migration`) + library for scaffolding timestamped migration files. |
| [`@next-model/zod`](./packages/zod) | Bridge zod schemas into a Model's `init`, `validators`, and `createTable` columns — one schema, three consumers. |
| [`@next-model/typebox`](./packages/typebox) | TypeBox variant of `@next-model/zod`. |
| [`@next-model/arktype`](./packages/arktype) | arktype variant of `@next-model/zod`. |

## Demos

End-to-end runnable projects live under [`demos/`](./demos), grouped by runtime. `node/` is split into `server/` (needs Node / a DB / a native dep) and `client/` (also runs in a browser).

| Demo | Adapter / connector | Infra |
|---|---|---|
| [`node/client/memory`](./demos/node/client/memory) | `@next-model/core` (`MemoryConnector`) | none |
| [`node/client/local-storage`](./demos/node/client/local-storage) | `@next-model/local-storage-connector` | none |
| [`node/server/sqlite`](./demos/node/server/sqlite) | `@next-model/sqlite-connector` | none (in-memory db) |
| [`node/server/postgres`](./demos/node/server/postgres) | `@next-model/postgres-connector` | `docker compose up -d` (postgres:17) |
| [`node/server/mysql`](./demos/node/server/mysql) | `@next-model/mysql-connector` | `docker compose up -d` (mysql:8) |
| [`node/server/mariadb`](./demos/node/server/mariadb) | `@next-model/mariadb-connector` | `docker compose up -d` (mariadb:11) |
| [`node/server/redis`](./demos/node/server/redis) | `@next-model/redis-connector` | `docker compose up -d` (redis:7) |
| [`node/server/valkey`](./demos/node/server/valkey) | `@next-model/valkey-connector` | `docker compose up -d` (valkey:8) |
| [`node/server/mongodb`](./demos/node/server/mongodb) | `@next-model/mongodb-connector` | `docker compose up -d` (mongo:7) |
| [`node/server/knex`](./demos/node/server/knex) | `@next-model/knex-connector` | sqlite: none; `docker compose --profile pg|mysql up -d` |
| [`node/server/aurora-data-api`](./demos/node/server/aurora-data-api) | `@next-model/aurora-data-api-connector` via `MockDataApiClient` | none |
| [`node/server/express-rest-api`](./demos/node/server/express-rest-api) | Express 5 + `@next-model/express-rest-api` + `@next-model/sqlite-connector` | none |
| [`node/server/graphql-api`](./demos/node/server/graphql-api) | `graphql-http` + `@next-model/graphql-api` + `@next-model/sqlite-connector` | none |
| [`react/todo`](./demos/react/todo) | React 19 + Vite + `@next-model/local-storage-connector` | none (browser) |
| [`nextjs/todo`](./demos/nextjs/todo) | Next.js 15 App Router + `@next-model/sqlite-connector` — server components + server actions | none |
| [`nextjs/api`](./demos/nextjs/api) | Next.js 15 + `@next-model/nextjs-api` — REST route handlers | none |

The [`demos/README.md`](./demos/README.md) covers the running convention in detail.

## Quick start

```ts
import { Model, MemoryConnector } from '@next-model/core';

const connector = new MemoryConnector({ storage: {} });

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}

await User.create({ name: 'Ada', age: 36 });
await User.filterBy({ $gt: { age: 30 } }).count();   // 1
```

Swap the connector to switch backends — every Model feature (filters, transactions, aggregates, soft deletes, associations, schema DSL) goes through the same `Connector` interface.

## Supported runtime

- Node.js ≥ 22 (required by every package).
- Pure ESM (`type: "module"`, `exports` field). Built with TypeScript 6 / `module: NodeNext`.
- Browser support is limited to `@next-model/local-storage-connector`.

## Development

```sh
pnpm install
pnpm -r build
pnpm typecheck
pnpm -r coverage
```

CI matrix: Node 22 + 24 on every push, plus a real-database leg that boots Postgres 17 and MySQL 8 service containers and runs the knex-connector spec against each.

## Contributing

Open an issue or PR on [github.com/tamino-martinius/node-next-model](https://github.com/tamino-martinius/node-next-model). Each package keeps a rolling `vNext` section in its `HISTORY.md`; please append a one-line entry under the appropriate subheading when you ship a feature, fix or tooling change.

## License

MIT, copyright 2017–2026 Tamino Martinius.
