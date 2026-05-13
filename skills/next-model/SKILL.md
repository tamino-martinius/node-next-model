---
name: next-model
description: Index and selection guide for the @next-model TypeScript ORM monorepo. Use when the user asks about next-model, NextModel, the @next-model/* packages, or wants to pick the right adapter (connector / API adapter / validator bridge) for a use case. Triggers on database/storage layer questions, "which connector should I use", REST/GraphQL/Next.js exposure of models, schema migrations, or schema-driven model definitions.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model

A typed, promise-based ORM for TypeScript. A `Model({...})` factory produces a class with chainable, immutable scopes, validators, callbacks, soft deletes, associations, transactions, and a uniform `Connector` interface that any storage backend can implement. Schema migrations run against the same connector.

This skill is the **index**. For deep package docs, switch to the per-package skill (each is named `next-model-<pkg>`). The naming below maps package → skill.

## Repository layout

`@next-model/*` is a pnpm workspace. Every published package lives in `packages/<name>`. Demos under `demos/` show end-to-end usage per runtime.

## When to use which package

### Pick exactly one connector for storage

| Use case | Package | Skill |
|---|---|---|
| Tests / dev / browser memory | `@next-model/core` (built-in `MemoryConnector`) | `next-model-core` |
| Browser persistence (`localStorage`) | `@next-model/local-storage-connector` | `next-model-local-storage-connector` |
| SQLite (Node, native, `better-sqlite3`) | `@next-model/sqlite-connector` | `next-model-sqlite-connector` |
| PostgreSQL (Node, native, `node-postgres`) | `@next-model/postgres-connector` | `next-model-postgres-connector` |
| MySQL (Node, native, `mysql2`) | `@next-model/mysql-connector` | `next-model-mysql-connector` |
| MariaDB (extends MySQL, uses `RETURNING *`) | `@next-model/mariadb-connector` | `next-model-mariadb-connector` |
| Multiple SQL dialects through one driver | `@next-model/knex-connector` | `next-model-knex-connector` |
| AWS Aurora Serverless v1 (RDS Data API) | `@next-model/aurora-data-api-connector` | `next-model-aurora-data-api-connector` |
| Redis (HASH per row + ZSET of ids) | `@next-model/redis-connector` | `next-model-redis-connector` |
| Valkey (wire-compatible Redis fork) | `@next-model/valkey-connector` | `next-model-valkey-connector` |
| MongoDB (official `mongodb` driver) | `@next-model/mongodb-connector` | `next-model-mongodb-connector` |

> Rule of thumb: prefer the **native** connector (`postgres`, `sqlite`, `mysql`, …) for a single dialect. Reach for `knex-connector` only if you actually need Knex or want to stay portable across multiple SQL dialects in one app.

### Layer migrations on top of a connector

| Need | Package | Skill |
|---|---|---|
| Run versioned migrations against any connector | `@next-model/migrations` | `next-model-migrations` |
| Scaffold timestamped migration files / CLI | `@next-model/migrations-generator` | `next-model-migrations-generator` |

### Expose models over HTTP

| Framework / transport | Package | Skill |
|---|---|---|
| Express 5 REST (8 default CRUD actions) | `@next-model/express-rest-api` | `next-model-express-rest-api` |
| GraphQL schema (6 default CRUD ops) | `@next-model/graphql-api` | `next-model-graphql-api` |
| Next.js App Router route handlers | `@next-model/nextjs-api` | `next-model-nextjs-api` |

### Validate / type model rows from a third-party schema

| Schema library | Package | Skill |
|---|---|---|
| zod | `@next-model/zod` | `next-model-zod` |
| TypeBox | `@next-model/typebox` | `next-model-typebox` |
| arktype | `@next-model/arktype` | `next-model-arktype` |

> All three bridges convert one schema into `toTypedColumns()` (for `defineSchema`), `init` coercion, **and** `validators` — single source of truth.

### Frontend hooks

| Use case | Package | Skill |
|---|---|---|
| React 19 hooks (`useNextModelQuery`, `useNextModelRecord`) for live model state | `@next-model/react` | `next-model-react` |

## Decision flow

1. **Pick a connector** based on storage backend.
2. If you need **schema migrations**, add `@next-model/migrations` (+ optional `@next-model/migrations-generator` CLI for scaffolding).
3. If you have an **existing schema library** (zod / TypeBox / arktype), add the matching bridge so one schema drives `init`, validators, and `createTable`.
4. If you're **exposing CRUD over HTTP**, add the API adapter for your framework.
5. On the **client**, add `@next-model/react` (and optionally `@next-model/local-storage-connector` for offline-first work).

## Minimum example

```ts
import { defineSchema, Model, MemoryConnector } from '@next-model/core';

const schema = defineSchema({
  users: {
    columns: {
      id:   { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age:  { type: 'integer' },
    },
  },
});

const connector = new MemoryConnector({ storage: {} }, { schema });

class User extends Model({
  connector,
  tableName: 'users',
}) {}

await User.create({ name: 'Ada', age: 36 });
await User.filterBy({ $gt: { age: 30 } }).count(); // 1
```

Swap `MemoryConnector` for any other connector — every `Model` feature (filters, transactions, aggregates, soft deletes, associations, schema DSL) goes through the same `Connector` interface.

## Cross-package conventions

- **ESM only.** Every package ships pure ESM (`type: "module"`, `exports`). Built with TypeScript 6 / `module: NodeNext`.
- **Node ≥ 22.** All Node-side packages require Node 22 or newer.
- **Browser support** is limited to `@next-model/local-storage-connector` (and `@next-model/core` itself; it has no Node-only deps).
- **Validators** belong on the Model definition, not in adapters. The schema bridges (`@next-model/zod` / `typebox` / `arktype`) wire them in for you.
- **Soft delete:** set `softDelete: true` on the Model and use `discard()` / `restore()` instead of `destroy()` to flip `discardedAt`.
- **Schema migrations** never recreate tables destructively: `alterTable(spec)` translates to native DDL on SQL connectors, falls back to "create + copy + rename" only on SQLite for ops the dialect can't do natively, and uses `$unset` / `$rename` on Mongo. Memory / localStorage / Redis / Valkey raise `UnsupportedOperationError` for foreign keys & check constraints.

## Where to look first

- Top-level [`README.md`](../../README.md) — package matrix, demos, schema mutation table.
- `packages/core/README.md` — the model factory, query DSL, validators, callbacks, associations, and connector interface (long and authoritative).
- `demos/` — runnable end-to-end examples per backend / runtime.

When the user mentions a specific package, **switch to its dedicated skill** for full API and gotchas.
