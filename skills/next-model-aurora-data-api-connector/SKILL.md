---
name: next-model-aurora-data-api-connector
description: Use when wiring `@next-model/aurora-data-api-connector` to talk to AWS Aurora Serverless v1 over the RDS Data API. Triggers include "Aurora connector", "RDSDataClient", "Lambda + Aurora", and HTTP-based access to Aurora Postgres or MySQL clusters with no VPC tunnel.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-aurora-data-api-connector

`@next-model/aurora-data-api-connector` is a connector for [`@next-model/core`](../next-model-core) that targets AWS Aurora Serverless v1 (Postgres or MySQL) through the [RDS Data API](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html). It uses Knex 3 only as a query builder (`client: 'pg'`); it never opens a real TCP connection — SQL strings and named parameters are produced locally and shipped to the Data API by an injectable client adapter, which makes it ideal for cold-start-sensitive environments such as AWS Lambda. A `MockDataApiClient` sub-export (`@next-model/aurora-data-api-connector/mock-client`) lets you swap out the HTTP client in tests so you can drive the connector entirely in-memory.

## When to use

- Aurora Serverless v1 clusters (Postgres or MySQL flavour) where you want HTTP rather than a pooled TCP connection.
- AWS Lambda / API Gateway / Step Functions handlers — no VPC tunnel, no connection pool warm-up, IAM-scoped via `secretArn` + `resourceArn`.
- Edge / serverless deployments that already pay an `RDSDataClient` round trip and want simple, stateless query execution.
- Test suites that need to fake the wire — drop in `MockDataApiClient` and assert on the SQL produced.

## When not to use

- Aurora Serverless v2 or provisioned Aurora — those don't expose the Data API. Use `@next-model/postgres-connector` or `@next-model/mysql-connector` directly over TCP.
- Tight latency budgets — every Data API call is a signed HTTPS request with ~50ms+ overhead. If you need single-digit-ms queries, talk to Postgres/MySQL directly.
- Workloads that depend on streaming large result sets, server-side cursors, `LISTEN/NOTIFY`, or session-scoped state — Data API is request/response only.

## Install

```sh
pnpm add @next-model/aurora-data-api-connector
# or: npm install @next-model/aurora-data-api-connector
```

The default client wraps [`data-api-client`](https://www.npmjs.com/package/data-api-client) — install it if you don't bring your own:

```sh
pnpm add data-api-client
# or: npm install data-api-client
```

## Setup

Construct the connector with the cluster ARN, secret ARN, and database name. The connector internally builds an `RDSDataClient`-backed transport via `data-api-client`:

```ts
import { DataApiConnector } from '@next-model/aurora-data-api-connector';

const connector = new DataApiConnector({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_CLUSTER_ARN,
  database: 'app_production',
  debug: false,
});
```

For tests or alternative transports, inject your own `DataApiClient` and skip the `data-api-client` dep entirely:

```ts
const connector = new DataApiConnector({
  client: {
    async query(sql, params) { /* return { records, insertId, numberOfRecordsUpdated } */ },
    async beginTransaction() { /* … */ },
    async commitTransaction(id) { /* … */ },
    async rollbackTransaction(id) { /* … */ },
  },
});
```

Set `dialect: 'postgres'` (default) or `dialect: 'mysql'` on the constructor options to pick which `information_schema` flavour `reflectSchema` targets.

## Quick start

```ts
import { Model } from '@next-model/core';
import { DataApiConnector } from '@next-model/aurora-data-api-connector';

const connector = new DataApiConnector({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_CLUSTER_ARN,
  database: 'app_production',
});

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}

const ada = await User.create({ name: 'Ada', age: 36 });
const adults = await User.where({ age: { $gte: 18 } }).all();
```

## Mock client

The package ships `MockDataApiClient` under the `/mock-client` sub-export. Use it in unit tests to drive the connector without hitting AWS:

```ts
import { DataApiConnector } from '@next-model/aurora-data-api-connector';
import { MockDataApiClient } from '@next-model/aurora-data-api-connector/mock-client';

const client = new MockDataApiClient();
const connector = new DataApiConnector({ client });

// stub a result for the next query
client.enqueue({ records: [{ id: 1, name: 'Ada' }] });

class User extends Model({ tableName: 'users', connector, init: (p: { name: string }) => p }) {}
const [ada] = await User.all();

// inspect the SQL the connector produced
expect(client.calls[0].sql).toContain('select * from "users"');
```

## Schema mutations

Because the Data API runs against a real Aurora Postgres / MySQL engine, the full DDL surface is available. The core schema DSL (`createTable`, `dropTable`, `hasTable`) maps onto the knex `pg` schema builder and the resulting DDL is executed through the Data API. For arbitrary mutations, fall back to `connector.execute`:

```ts
await connector.execute(`
  ALTER TABLE users
    ADD COLUMN email_verified_at timestamptz,
    ALTER COLUMN email SET NOT NULL,
    ADD CONSTRAINT users_email_unique UNIQUE (email);
`);

await connector.execute('CREATE INDEX users_email_idx ON users (email);');
await connector.execute('ALTER TABLE users RENAME COLUMN name TO full_name;');
```

Pair with `@next-model/migrations` for versioned migrations, or with `reflectSchema()` to round-trip into a typed schema source via `nm-generate-migration schema-from-db`.

## Transactions

`connector.transaction(fn)` wraps the callback in `beginTransaction` / `commitTransaction` (or `rollbackTransaction` on throw) and pins the transaction id to `activeTransactionId` so any nested calls participate:

```ts
await connector.transaction(async () => {
  const user = await User.create({ name: 'Ada', age: 36 });
  await Account.create({ userId: user.id, balance: 0 });
});
```

Re-entrant transactions join the outer one — there are no savepoints, so an inner throw rolls back the whole outer transaction. If you need raw control, the injected client exposes `beginTransaction`, `commitTransaction(id)`, and `rollbackTransaction(id)` directly.

## Gotchas

- **Field-typing quirks** — the Data API encodes scalars via tagged fields (`stringValue`, `longValue`, `doubleValue`, `booleanValue`, `isNull`). `data-api-client` flattens these for you, but a custom transport must do the same and preserve `null` distinctly from missing.
- **`BigInt` / `longValue`** — Postgres `bigint` columns come back as JS `number` if they fit in 53 bits and as `string` otherwise via the Data API. Cast explicitly if you need `BigInt` semantics.
- **Payload size limits** — the Data API caps each request and response at ~1MB and ~1000 records. The connector inserts in `batchInsert` one row at a time and re-fetches by primary key (the Data API doesn't return inserted rows), so wide bulk inserts are slow; chunk large writes yourself.
- **No `LIMIT` on mutations** — `updateAll` / `deleteAll` build a SELECT for the affected rows first, then issue the mutation against the same WHERE clause without `LIMIT`/`OFFSET` (Aurora Postgres rejects `DELETE … LIMIT`). Scope `.limit()` / `.skip()` are ignored at the mutation layer.
- **Auto-increment is required for `KeyType.number`** — set `{ autoIncrement: true }` on the integer PK column to get a Postgres `SERIAL`; otherwise insert SQL provides no value for the PK.
- **MySQL dialect quoting** — the compiled SQL targets PostgreSQL syntax. Pointing the connector at MySQL Aurora works, but quoting and reserved-word edge cases are not covered by CI; verify your queries.
- **Cold-start cost** — the first call after a deploy pays SDK init plus Data API warm-up; budget ~50–200ms before the first row arrives.

## See also

- [`next-model-core`](../next-model-core) — the model layer this connector plugs into.
- [`next-model-postgres-connector`](../next-model-postgres-connector) — direct TCP Postgres for Aurora Serverless v2 / provisioned Aurora.
- [`next-model-mysql-connector`](../next-model-mysql-connector) — direct TCP MySQL for non-Data-API deployments.
- [`next-model-migrations`](../next-model-migrations) — versioned migrations that work over any connector, including this one.
