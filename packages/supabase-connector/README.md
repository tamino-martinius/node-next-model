# @next-model/supabase-connector

[`@next-model/core`](../core) connector backed by [Supabase](https://supabase.com) via [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) (PostgREST).

> **Heads-up.** This connector talks to Supabase over PostgREST, the same REST layer both server and browser Supabase clients use. That means the connector works identically whether you construct it with a `service_role` key on the server or an `anon` key in the browser — only the client/key you pass in differs. It also means it inherits PostgREST's constraints: no DDL, no raw SQL, no multi-request transactions. See **Known limitations** below.

## Installation

```sh
pnpm add @next-model/supabase-connector @supabase/supabase-js
# or: npm install @next-model/supabase-connector @supabase/supabase-js
```

## Constructing the connector

Two equivalent construction forms:

```ts
import { SupabaseConnector } from '@next-model/supabase-connector';

// 1. Bring your own client (caller controls it, e.g. reuses an app-wide singleton)
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const c1 = new SupabaseConnector(client);

// 2. Hand the connector { url, key } and let it build the client
const c2 = new SupabaseConnector({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!,
});
```

Server code typically passes the `service_role` key (bypasses row-level security); browser code passes the `anon` key (subject to RLS policies). The connector doesn't care which — it's the same PostgREST wire protocol either way.

### Attaching a typed schema

Pass a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) as the optional second arg so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true, autoIncrement: true }, name: { type: 'string' } } },
});

const connector = new SupabaseConnector({ url, key }, { schema });
```

## Quick start

```ts
import { createClient } from '@supabase/supabase-js';
import { defineSchema, Model } from '@next-model/core';
import { SupabaseConnector } from '@next-model/supabase-connector';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true, autoIncrement: true }, name: { type: 'string' } } },
});

// Server (service_role) or browser (anon) — only the client/key differs.
const connector = new SupabaseConnector(
  { url: process.env.SUPABASE_URL!, key: process.env.SUPABASE_KEY! },
  { schema },
);
// or: new SupabaseConnector(createClient(url, key), { schema });

class User extends Model({ connector, tableName: 'users' }) {}
const ada = await User.create({ name: 'Ada' }); // tables are managed via Supabase migrations, not ensureSchema()
```

## Capability matrix

| Capability | Behaviour |
|---|---|
| `query` / `select` / `count` | Native PostgREST `select` / `range` / `order` / `count: 'exact'`. |
| Filter operators (`$eq`/`$gt`/`$gte`/`$lt`/`$lte`/`$in`/`$notIn`/`$null`/`$notNull`/`$like`/`$ilike`/`$between`, `$and`/`$or`/`$not`) | Native PostgREST filter operators (`.eq`, `.in`, `.or(...)`, etc.). |
| `orderBy` / `limitBy` / `.skip()` | Native `.order()` / `.limit()` / `.range()`. |
| `batchInsert` | Native `insert(...).select()`. |
| `updateAll` / `deleteAll` | Native `update(...)` / `delete(...)` scoped by the same filter translation, `.select()` to return affected rows. |
| `upsert` | Native PostgREST `upsert(..., { onConflict, ignoreDuplicates })`, pre/post-fetched to resolve `updateColumns` and return full rows. See **Known limitations**. |
| `aggregate` (sum/min/max/avg) | **Emulated client-side** — fetches the matching column values and reduces in JS. |
| `deltaUpdate` (increment) | **Emulated** — SELECT then per-row UPDATE. Not atomic. |
| `createTable` / `dropTable` / `alterTable` / `hasTable` / `ensureSchema` | **Unsupported** — throws `UnsupportedOperationError`. Manage schema with Supabase migrations. |
| `execute` (raw SQL) | **Unsupported** — throws `UnsupportedOperationError`. |
| `transaction` | **Unsupported** — throws `UnsupportedOperationError`. PostgREST is one request per call; there's no multi-statement transaction over REST. |

### Schema management (`ensureSchema` / DDL)

Supabase projects are Postgres databases managed through the Supabase CLI / dashboard migrations, not through PostgREST. Accordingly `createTable`, `dropTable`, `alterTable`, `hasTable`, and `ensureSchema` all throw `UnsupportedOperationError` on this connector — attach a schema for type inference (`{ schema }`) as usual, but create and evolve the actual tables via `supabase migration new ...` / `supabase db push`, or the Supabase SQL editor.

## `MockSupabaseClient` for tests

The package ships an in-memory PostgREST-compatible mock backed by [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), exported from the dedicated `/mock-client` sub-path (not the main entry — `better-sqlite3` is a dev-only dependency and never loads unless you import this path):

```ts
import { SupabaseConnector } from '@next-model/supabase-connector';
import { MockSupabaseClient } from '@next-model/supabase-connector/mock-client';

const client = new MockSupabaseClient();
client.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');

const connector = new SupabaseConnector(client);
// ... same Model wiring as above, no live Supabase project required
client.close();
```

Use it for unit tests and local demos; see [`demos/node/server/supabase`](../../demos/node/server/supabase) for a runnable example.

## Known limitations

- **DDL / raw `execute` / `transaction` throw `UnsupportedOperationError`** — PostgREST can't run schema changes, arbitrary SQL, or multi-request transactions. Manage schema with Supabase migrations; do transactional work with a Postgres RPC / server-side.
- **`aggregate` (sum/min/max/avg) is computed client-side** — the connector fetches the matching column values and reduces in JS (Supabase disables PostgREST aggregate functions by default). Correct on any project, but can transfer large result sets. `count` is native/cheap.
- **`deltaUpdate` (increment) is SELECT-then-UPDATE, not atomic** — concurrent increments can race; use a Postgres RPC for strict atomicity.
- **`upsert` with a narrow `updateColumns` mixed with brand-new rows in one batch** can send heterogeneous-key JSON that PostgREST rejects (`PGRST102`). The common case (default `updateColumns`, homogeneously-shaped rows) is unaffected. Split such calls or upsert homogeneous batches.

## Testing matrix

Local tests run entirely against `MockSupabaseClient` (no network, no live Supabase project needed):

```sh
pnpm --filter @next-model/supabase-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
