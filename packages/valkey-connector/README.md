# @next-model/valkey-connector

[`@next-model/core`](../core) connector for [Valkey](https://valkey.io/), the open-source fork of Redis. Implemented as a thin extension of [`@next-model/redis-connector`](../redis-connector).

## Why a separate package?

Valkey is **wire-compatible** with the Redis protocol — the same `node-redis` client, the same commands, the same HASH-per-row + ZSET-of-ids storage layout. So at the time of writing, `ValkeyConnector` is functionally identical to `RedisConnector`.

It exists as its own publishable name for two reasons:

1. **Discoverability.** Apps that target Valkey can install the package whose name matches their database.
2. **Forward compatibility.** Valkey ≥ 8.x is shipping features that aren't in upstream Redis (JSON, vector, improved clustering). Future Valkey-only overrides will land here without bloating `redis-connector`.

If you're targeting Redis itself, use `@next-model/redis-connector` directly.

## Installation

```sh
pnpm add @next-model/valkey-connector redis
# or: npm install @next-model/valkey-connector redis
```

## Constructing the connector

```ts
import { ValkeyConnector } from '@next-model/valkey-connector';

const connector = new ValkeyConnector({
  client: { url: 'valkey://valkey-host:6379' },
});
await connector.connect();
```

Pass an optional `extras: { schema }` second arg to attach a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level — purely for Model inference, since Valkey enforces no DB schema at runtime.

```ts
const connector = new ValkeyConnector({ client: { url: '...' } }, { schema });
```

The constructor signature, runtime API, and storage layout are otherwise identical to `RedisConnector`'s — see [its README](../redis-connector/README.md) for the full surface (filter operators, transactions, schema DDL, …).

## Testing matrix

CI runs the shared `runModelConformance` suite against a real `valkey/valkey:8` service container.

Locally, point at any Valkey-compatible server (Valkey, Redis, KeyDB, Dragonfly, …):

```sh
VALKEY_URL=redis://127.0.0.1:6379 pnpm --filter @next-model/valkey-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
