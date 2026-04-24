# @next-model/local-storage-connector

Browser `localStorage` connector for [`@next-model/core`](../core).

`LocalStorageConnector` extends `MemoryConnector`, so every behaviour you get from the in-memory store (filter operators, ordering, aggregates, transactions with rollback, schema DSL, JS-expression `execute`) carries over verbatim. The only differences are persistence and id management.

## Installation

```sh
pnpm add @next-model/local-storage-connector
# or: npm install @next-model/local-storage-connector
```

No other peer dependencies.

## Constructing the connector

```ts
import { LocalStorageConnector } from '@next-model/local-storage-connector';

// Browser: picks up globalThis.localStorage automatically
const connector = new LocalStorageConnector();

// With an injected store (Node tests, sandboxed environments)
import { MemoryLocalStorage } from '@next-model/local-storage-connector/dist/__mocks__/MemoryLocalStorage.js';
const connector = new LocalStorageConnector({ localStorage: new MemoryLocalStorage() });

// Namespacing keys
const connector = new LocalStorageConnector({
  prefix: 'app:',
  suffix: ':v2',
});
```

When neither `localStorage` (option) nor `globalThis.localStorage` is available, the constructor throws — letting you fail fast in environments where the Web Storage API is not present.

## Wiring a Model

```ts
import { Model } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

const connector = new LocalStorageConnector();

class Note extends Model({
  tableName: 'notes',
  connector,
  init: (props: { title: string; body: string }) => props,
}) {}

await Note.create({ title: 'Hello', body: 'world' });
await Note.count();           // 1
```

## Feature → connector specifics

### Storage layout

Each table is stored under `${prefix}${tableName}${suffix}` as a JSON-serialised array. A sidecar key `${prefix}${tableName}${suffix}__nextId` tracks the next auto-increment id so deleted rows never have their id reused.

Reads load the table on first access of a request; writes serialise back after every mutation. There is no in-memory cache, so swapping `localStorage` between tabs (e.g. browser sync) is observed on the next call.

### Filter operators, aggregates, ordering

Inherited from `MemoryConnector`. All operators (`$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt/$gte/$lt/$lte`, `$like`, `$async`, `$raw`) and the same ordering / limit / skip semantics apply. `$like` uses the `MemoryConnector`'s pattern matcher, not SQL `LIKE`.

### `execute(query, bindings)`

Inherited from `MemoryConnector`: the `query` string is evaluated as a JavaScript expression over the in-memory rows. Use it only with code you control — there is no SQL parser or sanitiser between the string and the JS engine.

### Transactions

Inherited from `MemoryConnector`: `transaction(fn)` snapshots `storage` and `lastIds` (via `structuredClone`), runs `fn`, and either commits in place or rolls back to the snapshot on throw. The whole `localStorage` tree is *not* synchronised across tabs during the transaction, so concurrent writers from another tab can race a rollback.

### `batchInsert`

Each row is pushed to the in-memory table array, then the table is serialised back to `localStorage`. Auto-increment ids come from the per-table `__nextId` counter (incremented even after deletes).

### Schema DSL

`createTable(name, blueprint)` initialises an empty table array; `dropTable(name)` removes both the data array and the `__nextId` counter; `hasTable(name)` checks whether the data key exists. Column types declared in the blueprint are validated up-front via `defineTable` but not enforced at runtime — `localStorage` has no schema layer.

## Changelog

See [`HISTORY.md`](./HISTORY.md).
