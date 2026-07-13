---
name: next-model-supabase-connector
description: Use `@next-model/supabase-connector` to back a `@next-model/core` Model with Supabase via `@supabase/supabase-js` (PostgREST). One connector for both server (service_role) and browser (anon) — only the client/key differs. Triggers include "Supabase connector", "Model on Supabase", "PostgREST ORM". DDL/transactions/raw SQL are unsupported (manage schema with Supabase migrations).
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

`@next-model/supabase-connector` is the Supabase driver for `@next-model/core`. It runs the Model query DSL against a Supabase project over [`@supabase/supabase-js`](https://github.com/supabase/supabase-js), i.e. PostgREST — the same REST layer both Supabase server SDKs and browser SDKs use. There is no separate "server connector" and "browser connector": you construct the same `SupabaseConnector` either way, and only the client/key you hand it differs (`service_role` on the server, bypassing row-level security; `anon` in the browser, subject to RLS policies).

## When to use

- A Supabase-backed Postgres project where you want Model semantics (filters, scopes, hooks, validations, associations) instead of hand-written PostgREST calls.
- Code that needs to run identically on the server and in the browser — swap the key, not the code.
- Projects already using Supabase Auth / Storage / Realtime that want the same client wired into `@next-model/core`.

## When not to use

- You need DDL, raw SQL, or multi-statement transactions from the connector itself — PostgREST doesn't support any of the three, and `createTable`/`dropTable`/`alterTable`/`hasTable`/`ensureSchema`/`execute`/`transaction` all throw `UnsupportedOperationError` here. Manage schema with Supabase migrations (`supabase migration new` / `supabase db push`); for transactional multi-statement work, write a Postgres RPC (`supabase.rpc(...)`) or reach for `@next-model/postgres-connector` (direct TCP, full DDL + `BEGIN/COMMIT` transactions) if you control the connection directly.
- You need strictly atomic increments at scale — `deltaUpdate` here is SELECT-then-UPDATE, not atomic; use a Postgres RPC.
- You need server-side aggregate pushdown for very large tables — `aggregate` (sum/min/max/avg) is computed client-side because Supabase disables PostgREST's aggregate functions by default; `count` is still native.

## Install

```sh
pnpm add @next-model/supabase-connector @supabase/supabase-js
# or: npm install @next-model/supabase-connector @supabase/supabase-js
```

## Setup

Two equivalent construction forms — bring your own client, or hand over `{ url, key }` and let the connector build one:

```ts
import { SupabaseConnector } from '@next-model/supabase-connector';
import { createClient } from '@supabase/supabase-js';

// 1. Bring your own client
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const c1 = new SupabaseConnector(client);

// 2. Let the connector build one from { url, key }
const c2 = new SupabaseConnector({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!,
});
```

Pass a `DatabaseSchema` from `defineSchema(...)` as the optional second argument for type-level Model prop inference; the schema is not used to run DDL (see below).

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { SupabaseConnector } from '@next-model/supabase-connector';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

// Server (service_role) or browser (anon) — only the client/key differs.
const connector = new SupabaseConnector(
  { url: process.env.SUPABASE_URL!, key: process.env.SUPABASE_KEY! },
  { schema },
);

class User extends Model({ connector, tableName: 'users' }) {}
const ada = await User.create({ name: 'Ada' }); // table is managed via Supabase migrations, not ensureSchema()
```

## Capability matrix

| Capability | Behaviour |
|---|---|
| `query` / `select` / `count` | Native PostgREST `select` / `range` / `order` / `count: 'exact'`. |
| Filter operators (`$eq`/`$gt`/`$gte`/`$lt`/`$lte`/`$in`/`$notIn`/`$null`/`$notNull`/`$like`/`$ilike`/`$between`, `$and`/`$or`/`$not`) | Native PostgREST filter operators. |
| `orderBy` / `limitBy` / `.skip()` | Native `.order()` / `.limit()` / `.range()`. |
| `batchInsert` | Native `insert(...).select()`. |
| `updateAll` / `deleteAll` | Native `update(...)` / `delete(...)`, `.select()` to return affected rows. |
| `upsert` | Native PostgREST `upsert(..., { onConflict, ignoreDuplicates })`. See gotchas below for the mixed-batch caveat. |
| `aggregate` (sum/min/max/avg) | **Emulated client-side** — fetches matching values, reduces in JS. `count` is native. |
| `deltaUpdate` (increment) | **Emulated** — SELECT then per-row UPDATE. Not atomic. |
| `createTable` / `dropTable` / `alterTable` / `hasTable` / `ensureSchema` | **Unsupported** — throws `UnsupportedOperationError`. Use Supabase migrations. |
| `execute` (raw SQL) / `transaction` | **Unsupported** — throws `UnsupportedOperationError`. PostgREST is one request per call. |

## Mock client for tests

`@next-model/supabase-connector/mock-client` (a dedicated sub-export, **not** the main entry) ships `MockSupabaseClient`, an in-memory PostgREST-compatible mock backed by `better-sqlite3`. It keeps the dev-only `better-sqlite3` dependency out of production installs:

```ts
import { SupabaseConnector } from '@next-model/supabase-connector';
import { MockSupabaseClient } from '@next-model/supabase-connector/mock-client';

const client = new MockSupabaseClient();
client.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');

const connector = new SupabaseConnector(client);
// ... same Model wiring as above, no live Supabase project required
client.close();
```

See `demos/node/server/supabase` in the repo for a full runnable example.

## Gotchas

- **No DDL / no raw SQL / no transactions.** All five schema-mutation methods plus `execute` and `transaction` throw `UnsupportedOperationError`. This is a PostgREST limitation, not a connector oversight — reach for a Postgres RPC or `@next-model/postgres-connector` when you need them.
- **`aggregate` transfers full result sets.** Because Supabase disables PostgREST's native aggregate functions by default, `sum`/`min`/`max`/`avg` fetch every matching row's column value and reduce client-side. Fine for moderate result sets; avoid on tables where the filtered aggregate scope is huge. `count` stays native and cheap.
- **`deltaUpdate` is not atomic.** It's a SELECT followed by a per-row UPDATE — concurrent increments against the same rows can race. Use a Postgres RPC (`supabase.rpc(...)`) if you need atomic increments.
- **Mixed-shape `upsert` batches can hit `PGRST102`.** A narrow `updateColumns` combined with brand-new rows in the same call can produce a batch whose objects have different key sets, which PostgREST rejects. The default case (default `updateColumns`, homogeneously-shaped rows) is unaffected; split heterogeneous batches into separate calls if you hit this.

## See also

- [`next-model-core`](../next-model-core/SKILL.md) — Model DSL, schema, hooks, validations.
- [`next-model-postgres-connector`](../next-model-postgres-connector/SKILL.md) — direct TCP Postgres with full DDL + transaction support.
- [`next-model-migrations`](../next-model-migrations/SKILL.md) — schema mutation runner; use it against Supabase via the Supabase CLI/migrations path, not this connector's DDL methods (which are unsupported).
