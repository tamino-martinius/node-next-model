---
name: next-model-local-storage-connector
description: Use `@next-model/local-storage-connector` to back a `@next-model/core` Model with the browser's `localStorage` (or any `Storage`-shaped object). Inherits from `MemoryConnector`, so all in-memory query semantics carry over verbatim — only persistence and id management differ. Triggers include "browser persistence", "offline-first", "client-side ORM", and "localStorage adapter".
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

`@next-model/local-storage-connector` is the browser `localStorage` driver for `@next-model/core`. It extends `MemoryConnector`, so every behaviour you get from the in-memory store — filter operators, ordering, aggregates, transactions with rollback, schema DSL, JS-expression `execute` — carries over verbatim. The only differences are that each table is JSON-serialised to a `localStorage` key (with a sidecar `__nextId` counter for auto-increment ids), and `globalThis.localStorage` is picked up automatically. You can inject a custom `Storage`-shaped object for tests or sandboxed environments.

## When to use

- Browser apps that want offline-first or simple persistence with full Model semantics (filters, scopes, hooks, validations) on top of `localStorage`.
- Prototypes, demos, or client-side-only tools where a server-side database would be overkill.
- Reusing a single Model DSL across browser and server tiers (e.g. share with `@next-model/postgres-connector` or `@next-model/sqlite-connector` on the server).

## When not to use

- Server-side / Node workloads — reach for a SQL connector (`@next-model/postgres-connector`, `@next-model/mysql-connector`, `@next-model/sqlite-connector`), `@next-model/mongodb-connector`, or `@next-model/redis-connector`.
- Large datasets — `localStorage` is bounded to roughly 5 MB per origin and every read/write serialises the entire table, so this connector degrades quickly past a few thousand rows.
- Workloads needing cross-tab transactional isolation — the snapshot-based `transaction(fn)` is not synchronised across tabs.

## Install

```sh
pnpm add @next-model/local-storage-connector
# or: npm install @next-model/local-storage-connector
```

No other peer dependencies.

## Setup

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

Pass a `DatabaseSchema` from `defineSchema(...)` as the optional second arg so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new LocalStorageConnector({ prefix: 'app:' }, { schema });
```

Existing call sites without `{ schema }` keep working unchanged.

## Quick start

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

Each table is stored under `${prefix}${tableName}${suffix}` as a JSON-serialised array. A sidecar key `${prefix}${tableName}${suffix}__nextId` tracks the next auto-increment id so deleted rows never have their id reused. Reads load the table on first access of a request; writes serialise back after every mutation. There is no in-memory cache, so swapping `localStorage` between tabs (e.g. browser sync) is observed on the next call.

## Schema mutations

Same caveats as `MemoryConnector`:

- `createTable(name, blueprint)` initialises an empty table array; `dropTable(name)` removes both the data array and the `__nextId` counter; `hasTable(name)` checks whether the data key exists.
- Column add/remove/rename rewrite every row in the table.
- Index operations (`createIndex` / `dropIndex` / etc.) are no-ops — there is no index layer to maintain.
- Foreign keys and check constraints throw `UnsupportedOperationError` — `localStorage` cannot enforce them.
- Column types declared in the blueprint are validated up-front via `defineTable` but not enforced at runtime.

## Gotchas

- **JSON serialization** — values must round-trip through `JSON.stringify` / `JSON.parse`. Plain objects, arrays, numbers, booleans, strings, and `null` are fine; `Date`, `Map`, `Set`, `BigInt`, functions, and class instances are not preserved unless you encode them yourself.
- **Storage quota** — most browsers cap `localStorage` at ~5 MB per origin. Hitting the quota throws a `QuotaExceededError` synchronously inside the failing write; design for small datasets and surface the error in the UI.
- **SSR-safety** — guard with `typeof window !== 'undefined'` (or only construct the connector inside browser-only code paths) when running under Next.js / Remix / SvelteKit. The constructor throws if no `localStorage` is reachable.
- **Cross-tab races** — `transaction(fn)` snapshots the in-memory tree, not `localStorage`. A second tab writing to the same prefix mid-transaction can be silently overwritten on rollback.
- **`execute(query, bindings)`** — inherited from `MemoryConnector`: the `query` string is evaluated as a JavaScript expression over the in-memory rows. Use it only with code you control.

## See also

- [`next-model-core`](../next-model-core/SKILL.md) — Model DSL, schema, hooks, validations, and the `MemoryConnector` whose semantics this connector inherits.
- [`next-model-react`](../next-model-react/SKILL.md) — React hooks for binding Models to components, the natural pairing for a browser-side `localStorage` connector.
