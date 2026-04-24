# @next-model/redis-connector

[`@next-model/core`](../core) connector backed by Redis (via [node-redis](https://github.com/redis/node-redis)).

> **Heads-up.** Redis is a key-value store, not a relational database. This connector loads a table's id set and fetches every row to evaluate filters / aggregates client-side. It's a great fit for fixture-style tables, queues, and small projection caches; **not** the right choice as the primary store for million-row queries that need indexed predicates.

## Installation

```sh
pnpm add @next-model/redis-connector redis
# or: npm install @next-model/redis-connector redis
```

## Constructing the connector

```ts
import { RedisConnector } from '@next-model/redis-connector';

// node-redis options (url / socket / etc.)
const c1 = new RedisConnector({ client: { url: 'redis://localhost:6379' } });

// Bring your own client (caller controls connect/disconnect)
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
const c2 = new RedisConnector({ redis, prefix: 'myapp:' });

// Programmatic shutdown
await c1.connect();    // owns its client → safe to call repeatedly
await c1.destroy();    // .quit() the client we created; injected clients are left alone
```

The underlying client is exposed as `connector.client`.

## Wiring a Model

```ts
import { Model } from '@next-model/core';
import { RedisConnector } from '@next-model/redis-connector';

const connector = new RedisConnector({ client: { url: process.env.REDIS_URL } });
await connector.connect();

class Note extends Model({
  tableName: 'notes',
  connector,
  init: (props: { title: string; body: string }) => props,
}) {}

await Note.create({ title: 'Hello', body: 'world' });
await Note.count(); // 1
```

## Storage layout

All keys are prefixed with the configured `prefix` (default `nm:`):

| Key | Purpose |
|-----|---------|
| `{prefix}{table}:meta` | JSON-serialised table definition. Acts as the existence flag for `hasTable`. |
| `{prefix}{table}:nextid` | `INCR` counter for auto-increment numeric ids. |
| `{prefix}{table}:ids` | `ZSET` of all row ids (score = numeric id) for ordered iteration. |
| `{prefix}{table}:row:{id}` | `HASH` of column → JSON-encoded value. |

Values inside the row hash are JSON-encoded so booleans, numbers, `Date` (round-tripped via `{ __date__: ISO }`), `null`, arrays, and nested objects all survive a round-trip.

## Feature → connector specifics

### Filter operators

The connector loads the entire id set for the table, fetches every row, then evaluates the filter via core's `filterList`. Every operator from the core DSL (`$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt`/`$gte`/`$lt`/`$lte`, `$like`, `$async`, `$raw`) works the same way it does on `MemoryConnector`.

### Ordering / limit / skip

Applied client-side after filtering. Default order matches insert order (ZSET score = id).

### Aggregates

`SUM`/`MIN`/`MAX`/`AVG` are computed client-side over the filtered rows.

### `batchInsert`

Each row gets:

1. An id assigned from `INCR {prefix}{table}:nextid` (for `KeyType.number`), `crypto.randomUUID()` (for `KeyType.uuid`), or the caller-supplied value (for `KeyType.manual`).
2. An `HSET` writing every column.
3. A `ZADD` to `{prefix}{table}:ids` so the row participates in the table scan.

### `updateAll` / `deleteAll`

Resolve the scope (filter + load), then iterate the matching rows and issue per-row `HSET` (update) or `DEL` + `ZREM` (delete). Returns the affected rows.

### `execute(query, bindings)`

Raw escape hatch — sends `[query, ...bindings]` via `client.sendCommand`. Use it for `SET`/`GET`/`PUBLISH`/`SUBSCRIBE`/etc.

### Transactions

`transaction(fn)` snapshots every table currently in the keyspace at the start of the block, runs `fn`, and on throw drops every table that exists at the end + restores from snapshot. Concretely:

- It is **not** `MULTI/EXEC`. Reads inside `fn` see writes inside `fn` immediately (which `MULTI/EXEC` doesn't allow).
- It is **not** isolated against concurrent clients — another connection writing to the same prefix during the block will be silently overwritten on rollback.

This matches the in-memory / sqlite snapshot semantics, which is what the conformance suite expects. Pick `@next-model/postgres-connector` (or another SQL connector) if you need real ACID isolation.

### Schema DDL

`createTable` writes the JSON-serialised `defineTable(...)` output to `{prefix}{table}:meta`. Columns are advisory (Redis is schemaless) but `defineTable` still validates the blueprint at create time.

`dropTable` `SCAN`s for keys matching `{prefix}{table}:*` and `DEL`s them.

## Testing matrix

CI runs the shared `runModelConformance` suite plus driver-specific tests against a real Redis 7 service container.

Locally:

```sh
REDIS_URL=redis://127.0.0.1:6379 pnpm --filter @next-model/redis-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
