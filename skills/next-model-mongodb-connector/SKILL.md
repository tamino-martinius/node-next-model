---
name: next-model-mongodb-connector
description: Native MongoDB connector for `@next-model/core` built directly on the official `mongodb` Node driver, with one collection per model and core filter operators translated to native Mongo query language. Trigger when the user mentions "MongoDB connector", `@next-model/mongodb-connector`, "ObjectId primary key", "Mongo collection per model", or wiring a next-model Model against MongoDB.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

## Overview

`@next-model/mongodb-connector` is the Mongo connector for `@next-model/core`, built directly on the official [`mongodb`](https://github.com/mongodb/node-mongodb-native) Node driver. Each model maps to one collection (`<tableName>`) — one document per row, with the model's primary key field stored next to the rest of its props. Two bookkeeping collections are used internally: `_nm_schemas` (existence flag for `hasTable`) and `_nm_counters` (per-table sequence counters for numeric auto-increment ids). MongoDB's auto-generated `_id` is stripped from query results so the model's own primary key is what callers see.

## When to use

- Document store or schemaless workloads where rows have dynamic / nested shapes.
- Mongo-first apps that already speak the official `mongodb` driver and want native query semantics.
- Apps that need JSON-shaped props, embedded sub-documents, or array fields without a join table.

## When not to use

- Workloads that need relational integrity, foreign keys, or check constraints — those throw `UnsupportedOperationError` on this connector. Use `@next-model/postgres-connector` or `@next-model/knex-connector` instead.
- Cross-document ACID transactions across many writers — `connector.transaction(fn)` is a snapshot/restore wrapper, **not** a multi-document MongoDB transaction.

## Install

```sh
pnpm add @next-model/mongodb-connector mongodb
# or: npm install @next-model/mongodb-connector mongodb
```

`mongodb` is a peer dependency — install it alongside the connector.

## Setup

```ts
import { MongoDbConnector } from '@next-model/mongodb-connector';

// Connection URL + database name
const c1 = new MongoDbConnector({
  url: process.env.MONGODB_URL,
  database: 'app_production',
});

// node-mongodb client options
const c2 = new MongoDbConnector({
  url: 'mongodb://localhost:27017',
  database: 'myapp',
  options: { maxPoolSize: 10, retryWrites: true },
});

// Bring your own client
import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URL!);
await client.connect();
const c3 = new MongoDbConnector({ client, database: 'myapp' });

await c1.connect();
await c1.destroy();
```

The underlying client and database handle are exposed as `connector.client` and `connector.db`.

Pass a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) as the optional second arg so `Model({ connector, tableName: 'users' })` can infer per-collection props at the type level — purely for Model inference, since MongoDB enforces no document schema at runtime:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new MongoDbConnector({ url: process.env.MONGODB_URL }, { schema });
```

## Quick start

```ts
import { Model } from '@next-model/core';
import { MongoDbConnector } from '@next-model/mongodb-connector';

const connector = new MongoDbConnector({ url: process.env.MONGODB_URL });
await connector.connect();

class Note extends Model({
  tableName: 'notes',
  connector,
  init: (props: { title: string; body: string }) => props,
}) {}
```

## Filter operator translation

The core DSL maps to native MongoDB query language:

| Core filter | MongoDB |
|-------------|---------|
| `{ name: 'Ada' }` | `{ name: 'Ada' }` |
| `{ $or: [a, b] }` | `{ $or: [a, b] }` |
| `{ $not: f }` | `{ $nor: [f] }` |
| `{ $in: { col: [v] } }` | `{ col: { $in: [v] } }` |
| `{ $notIn: { col: [v] } }` | `{ col: { $nin: [v] } }` |
| `{ $null: 'col' }` | `{ col: { $eq: null } }` |
| `{ $notNull: 'col' }` | `{ col: { $ne: null } }` |
| `{ $between: { col: { from, to } } }` | `{ col: { $gte: from, $lte: to } }` |
| `{ $notBetween: { col: { from, to } } }` | `{ $or: [{ col: { $lt: from } }, { col: { $gt: to } }] }` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `{ col: { $gt: v } }` etc. |
| `{ $like: { col: 'pat%' } }` | `{ col: /^pat.*$/ }` (`_` → `.`, `%` → `.*`) |
| `{ $raw: { $query: '{...JSON...}' } }` | The `$query` string is JSON-parsed and used as the mongo filter document directly. Use this for `$exists`, `$elemMatch`, `$type`, `$regex`, etc. |
| `{ $async: Promise<Filter> }` | Resolved by Model before reaching the connector. |

## Schema mutations

- `createTable` calls `db.createCollection(name)` and stamps a row in `_nm_schemas`. Column types from the blueprint are stored verbatim there for reference but are advisory — MongoDB is schemaless.
- `dropTable` drops the collection and removes the corresponding rows from `_nm_schemas` and `_nm_counters`.
- `removeColumn` issues `$unset` across the collection; `renameColumn` issues `$rename`.
- `addIndex` / `removeIndex` map to the driver's `createIndex` / `dropIndex` on the collection.
- Foreign keys and check constraints throw `UnsupportedOperationError` — Mongo has no native equivalent. Enforce that at the application layer or pick a SQL connector.
- Collection names are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before use; anything else throws `PersistenceError`.

## Transactions

`connector.transaction(fn)` snapshots every tracked collection at block start and restores on throw — same semantics as the in-memory and Redis connectors. **Not** a multi-document MongoDB transaction (which requires a replica set); no isolation against concurrent clients. If you need true Mongo session-based multi-document transactions, drive `connector.client` directly with `client.startSession()` / `withTransaction`.

## Gotchas

- **`_id` vs `id`** — MongoDB's auto-generated `_id` is stripped from query results. The model's primary-key field (`id` by default, or whatever you declared) lives on the document next to the rest of its props.
- **`ObjectId` as a primary key** — declare the column as a string and pass `ObjectId` values (or their `.toString()`) explicitly; numeric auto-increment goes through `_nm_counters` (`findOneAndUpdate({ _id: tableName }, { $inc: { seq: 1 } }, { upsert: true })`) and UUIDs come from `crypto.randomUUID()`. Manual keys must be supplied by the caller.
- **`batchInsert`** is a single `insertMany` — partial failures behave per the driver's ordered/unordered semantics.
- **`updateAll` / `deleteAll`** use `updateMany` / `deleteMany`. `updateAll` re-queries matching rows after the write so the return value reflects post-update state. `deleteAll` captures matching rows up-front (Mongo doesn't return deleted docs) and returns them.
- **JSON nesting** — nested objects and arrays roundtrip natively (no JSON-string encoding). Filter against them with `$raw` + Mongo operators like `$elemMatch` / `$exists`.
- **`execute(command, args)`** is a thin wrapper around `db.command({ [command]: args })` for `runCommand` operations (`createIndex`, `serverStatus`, `ping`, …). The result is wrapped in an array.
- **Snapshot transactions are in-memory** — large collections inside `transaction(fn)` cost RAM proportional to row count.

## See also

- [`@next-model/core`](../next-model-core) — Model definition, filter DSL, schema types.
- [`@next-model/migrations`](../next-model-migrations) — schema DDL runner; uses this connector's `createTable` / `dropTable` / `addIndex` under the hood.
