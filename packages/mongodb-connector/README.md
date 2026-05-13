# @next-model/mongodb-connector

Native MongoDB connector for [`@next-model/core`](../core), built directly on the official [`mongodb`](https://github.com/mongodb/node-mongodb-native) driver.

## Installation

```sh
pnpm add @next-model/mongodb-connector mongodb
# or: npm install @next-model/mongodb-connector mongodb
```

## Constructing the connector

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

### Attaching a typed schema

Pass a `DatabaseSchema` (from `@next-model/core`'s `defineSchema(...)`) as the optional second arg so `Model({ connector, tableName: 'users' })` can infer per-collection props at the type level — purely for Model inference, since MongoDB enforces no document schema at runtime.

```ts
import { defineSchema } from '@next-model/core';

const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true }, email: { type: 'string' } } },
});

const connector = new MongoDbConnector({ url: process.env.MONGODB_URL }, { schema });
```

Existing call sites without `{ schema }` keep working unchanged.

## Wiring a Model

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

## Storage layout

| Collection | Purpose |
|------------|---------|
| `<tableName>` | One document per row. The model's primary key field lives on the document next to the rest of its props. MongoDB's auto-generated `_id` is stripped from query results. |
| `_nm_schemas` | Tracks which tables have been created. Existence flag for `hasTable`. |
| `_nm_counters` | Per-table `findOneAndUpdate` sequence counters for `KeyType.number` auto-increment. |

## Feature → connector specifics

### Filter operators

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

### `execute(command, args)`

Thin wrapper around `db.command({ [command]: args })`. Use for `runCommand` operations (`createIndex`, `serverStatus`, `ping`, …). Returns the result wrapped in an array.

### Transactions

`connector.transaction(fn)` snapshots every tracked collection at block start and restores on throw — same semantics as the in-memory and Redis connectors. **Not** a multi-document MongoDB transaction (which requires a replica set); no isolation against concurrent clients.

### `batchInsert`

A single `insertMany`. Auto-increment numeric ids come from `findOneAndUpdate({ _id: tableName }, { $inc: { seq: 1 } }, { upsert: true })` against `_nm_counters`. UUIDs come from `crypto.randomUUID()`. Manual keys must be supplied by the caller.

### `updateAll` / `deleteAll`

Both use `updateMany` / `deleteMany` with the compiled filter. `updateAll` re-queries the matching rows after the write so the return value reflects the post-update state. `deleteAll` captures matching rows up-front (Mongo doesn't return deleted docs) and returns them.

### Schema DDL

`createTable` calls `db.createCollection(name)` and stamps a row in `_nm_schemas` (so `hasTable` works without listing every collection). Column types from the blueprint are stored verbatim in `_nm_schemas` for reference but are advisory — MongoDB is schemaless.

`dropTable` drops the collection and removes the corresponding rows from `_nm_schemas` and `_nm_counters`.

### Identifier safety

Collection names are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before use. Anything else throws `PersistenceError`.

## Testing matrix

CI runs the shared `runModelConformance` suite plus driver-specific tests against a real MongoDB 7 service container.

Locally:

```sh
MONGODB_URL=mongodb://127.0.0.1:27017 pnpm --filter @next-model/mongodb-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
