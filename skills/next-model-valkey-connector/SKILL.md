---
name: next-model-valkey-connector
description: '`@next-model/valkey-connector` is the Valkey connector for next-model. It extends `RedisConnector` and is wire-compatible with Redis, so behavior is identical. Triggers include "Valkey connector", "Valkey", "Redis fork", or migrating a Redis-backed app to Valkey.'
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

## Overview

`@next-model/valkey-connector` extends [`RedisConnector`](../next-model-redis-connector) to target [Valkey](https://valkey.io/), the open-source fork of Redis. Because Valkey is wire-compatible with the Redis protocol — same `node-redis` client, same commands, same HASH-per-row + ZSET-of-ids storage layout — `ValkeyConnector` is functionally identical to `RedisConnector` at the time of writing. It exists as a separate publishable package for **discoverability** (apps targeting Valkey install a package whose name matches their database) and **forward compatibility** (Valkey ≥ 8.x is shipping features that aren't in upstream Redis: JSON, vector, improved clustering — Valkey-only overrides will land here without bloating `redis-connector`).

## When to use

- You are deploying against Valkey (the BSD-licensed Redis fork) and want a connector whose name matches your database.
- You are migrating a Redis-backed next-model app to Valkey and want the import/package surface to track that decision.
- You are license-conscious and prefer to depend on a Valkey-named package over a Redis-named one, even though both speak the same protocol today.
- If you are targeting Redis itself, use [`@next-model/redis-connector`](../next-model-redis-connector) directly instead.

## Install

```sh
pnpm add @next-model/valkey-connector redis
# or: npm install @next-model/valkey-connector redis
```

The `redis` (node-redis) client is a peer-style dep because Valkey speaks the Redis wire protocol — the same client works against both.

## Setup

```ts
import { ValkeyConnector } from '@next-model/valkey-connector';

const connector = new ValkeyConnector({
  client: { url: 'valkey://valkey-host:6379' },
});
await connector.connect();
```

Pass an optional `extras: { schema }` second arg to attach a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level — purely for Model inference, since Valkey enforces no DB schema at runtime:

```ts
const connector = new ValkeyConnector({ client: { url: '...' } }, { schema });
```

## Quick start

```ts
import { Model } from '@next-model/core';
import { ValkeyConnector } from '@next-model/valkey-connector';

const connector = new ValkeyConnector({
  client: { url: 'valkey://127.0.0.1:6379' },
});
await connector.connect();

const User = Model({ connector, tableName: 'users' });

await User.create({ id: '1', name: 'Ada' });
const ada = await User.find({ id: '1' });
```

## Differences from RedisConnector

At the time of writing, **none** beyond the package name and which database you point at. The constructor signature, runtime API, filter operators, transactions, schema DDL, and storage layout are identical to `RedisConnector`'s — see [`@next-model/redis-connector`](../next-model-redis-connector) for the full surface.

CI runs the shared `runModelConformance` suite against a real `valkey/valkey:8` service container. Locally, you can point the test suite at any Valkey-compatible server (Valkey, Redis, KeyDB, Dragonfly, …):

```sh
VALKEY_URL=redis://127.0.0.1:6379 pnpm --filter @next-model/valkey-connector test
```

Future Valkey-only features (JSON, vector, clustering) will land here as overrides; they are not present today.

## See also

- [`next-model-core`](../next-model) — Model factory, schemas, and shared types.
- [`next-model-redis-connector`](../next-model-redis-connector) — the parent connector; full API surface and storage layout.
