---
name: next-model-redis-connector
description: Use `@next-model/redis-connector` to back a `@next-model/core` Model with Redis (via node-redis), storing one HASH per row and one ZSET of ids per table. Triggers include "Redis connector", "key-value model", and "cache-as-storage" — pick this when you want Model semantics on top of Redis.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

`@next-model/redis-connector` is the Redis driver for `@next-model/core`. It maps each table to a `ZSET` of row ids (score = numeric id, used for ordered iteration and existence) and each row to a `HASH` of column → JSON-encoded value. To evaluate the Model query DSL — filters, ordering, limit/skip, aggregates — the connector loads the table's id set, fetches every matching row's hash, and runs the same `filterList` core uses on `MemoryConnector`. That keeps every operator (`$and`/`$or`/`$not`/`$in`/`$between`/`$like`/`$async`/`$raw`/...) consistent with other connectors at the cost of being client-side rather than server-side.

## When to use

- Redis is already your system of record for the data and you want Model semantics (filters, scopes, hooks, validations) on top of it.
- Fixture-style tables, queues, small projection caches, or ephemeral state where strong relational semantics are not required.
- You want a single Model DSL that also works against Postgres / SQLite / Memory without rewriting query code.

## When not to use

- Relational queries over millions of rows with indexed predicates — the connector materialises every row client-side; reach for `@next-model/postgres-connector` or `@next-model/knex-connector`.
- Foreign keys, check constraints, or any DB-enforced referential integrity — Redis is schemaless and these are unsupported.
- Workloads that need real ACID isolation between concurrent writers; the snapshot-based `transaction(fn)` is not `MULTI/EXEC`.

## Install

```sh
pnpm add @next-model/redis-connector redis
# or: npm install @next-model/redis-connector redis
```

`redis` (node-redis v4+) is a required peer — bring whichever client version your app already uses.

## Setup

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

The underlying client is exposed as `connector.client`. Pass a `DatabaseSchema` from `defineSchema(...)` as the optional second argument for type-level Model prop inference; Redis enforces no DB schema at runtime.

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { RedisConnector } from '@next-model/redis-connector';

const schema = defineSchema({
  notes: {
    columns: {
      id:    { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      body:  { type: 'string' },
    },
  },
});

const connector = new RedisConnector({ client: { url: process.env.REDIS_URL } }, { schema });
await connector.connect();

class Note extends Model({
  connector,
  tableName: 'notes',
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

Values inside the row hash are JSON-encoded so booleans, numbers, `Date` (round-tripped via `{ __date__: ISO }`), `null`, arrays, and nested objects all survive a round-trip. `batchInsert` assigns ids from `INCR {prefix}{table}:nextid` (`KeyType.number`), `crypto.randomUUID()` (`KeyType.uuid`), or the caller-supplied value (`KeyType.manual`), then `HSET`s the row and `ZADD`s its id. `updateAll` / `deleteAll` resolve the scope, then iterate with per-row `HSET` (update) or `DEL` + `ZREM` (delete) and return the affected rows.

## Schema mutations

`createTable` writes the JSON-serialised `defineTable(...)` output to `{prefix}{table}:meta`. Columns are advisory (Redis is schemaless) but `defineTable` validates the blueprint at create time. `dropTable` `SCAN`s for keys matching `{prefix}{table}:*` and `DEL`s them.

For column-level migrations:

- `removeColumn` rewrites every row hash, dropping the field.
- `renameColumn` rewrites every row hash, copying the value to the new field name and removing the old one.
- Other DDL ops (add/alter column types, indexes, constraints) are no-ops or throw `UnsupportedOperationError` — Redis has nothing meaningful to do for them.

## Limitations

- No foreign keys and no check constraints — Redis cannot enforce them.
- Index operations (`createIndex` / `dropIndex` / etc.) are no-ops; queries always scan the full id set.
- Filters, ordering, limit/skip, and aggregates (`SUM`/`MIN`/`MAX`/`AVG`) are evaluated client-side after loading every matching row — fine for thousands of rows, painful for millions.
- `transaction(fn)` is a snapshot-based rollback (matching the in-memory / sqlite suite), not `MULTI/EXEC`. Reads inside `fn` see writes inside `fn` immediately, and another connection writing to the same prefix during the block will be silently overwritten on rollback. Pick `@next-model/postgres-connector` (or another SQL connector) for real ACID isolation.
- Eventual-consistency caveats: writes are pipelined per row, not atomic across the table. A crash mid-`batchInsert` can leave a row hash without its id in the ZSET (or vice versa) until the next compatible write.

## See also

- [`next-model-core`](../next-model-core/SKILL.md) — Model DSL, schema, hooks, validations.
- [`next-model-valkey-connector`](../next-model-valkey-connector/SKILL.md) — same shape, Valkey client.
- [`next-model-migrations`](../next-model-migrations/SKILL.md) — schema mutation runner; mind the no-op/unsupported set above.
