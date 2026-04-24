# @next-model/aurora-data-api-connector

Connector for [`@next-model/core`](../core) that targets the [AWS RDS Data API](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html) — the HTTP-based query interface for Aurora Serverless v1 (PostgreSQL or MySQL flavour).

The connector uses [Knex 3](https://knexjs.org/) only as a query builder (`client: 'pg'`); it never opens a real DB connection. SQL strings + named parameters are produced locally and shipped to the Data API by an injectable client adapter, which keeps the package fully usable in cold-start-sensitive environments such as AWS Lambda.

## Installation

```sh
pnpm add @next-model/aurora-data-api-connector
# or: npm install @next-model/aurora-data-api-connector
```

The default client wraps [`data-api-client`](https://www.npmjs.com/package/data-api-client) — install it if you don't bring your own:

```sh
pnpm add data-api-client
# or: npm install data-api-client
```

## Constructing the connector

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

## Wiring a Model

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
```

## Feature → connector specifics

### Query compilation

Each scope is built with `knex({ client: 'pg' })` and converted to SQL + a parameter dict via `query.toSQL().toNative()`. The compiled SQL uses **named bindings** (`:p1, :p2, …`) — the format the Data API expects — and parameters are sent as a `{ name: value }` map.

### Filter operators

Same vocabulary as every other connector (`$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt/$gte/$lt/$lte`, `$like`, `$async`, `$raw`). All compile to PostgreSQL via knex' `pg` dialect and land at the Data API as parameterised SQL. `FilterError` is thrown for malformed special filters (multiple keys in `$gt`, empty `$in`, …).

### `execute(query, bindings)`

Bindings can be a positional array or a named dict; the connector forwards them as-is. Result records are returned as a flat `Dict<any>[]`.

### Transactions

`connector.transaction(fn)` wraps the callback in `beginTransaction` / `commitTransaction` (or `rollbackTransaction` on throw), pinning the transaction id to `activeTransactionId` so any nested calls participate. Re-entrant transactions join the outer one — there are no savepoints, so an inner throw rolls back the whole outer transaction.

### `batchInsert`

The Data API does not return inserted rows. The connector inserts items one at a time, capturing `insertId` per row, then re-fetches the inserted records by primary key. For `KeyType.manual` it skips the `insertId` step and re-fetches by the caller-supplied key. `PersistenceError` is raised if a re-fetch turns up empty.

### `updateAll` / `deleteAll`

Both build a SELECT for the affected rows first (so the methods can return them), then issue the mutation against the same WHERE clause without any `LIMIT` / `OFFSET` — Aurora Postgres rejects `DELETE … LIMIT`, so the scope's limit/skip are ignored at this layer.

### Schema DSL

`createTable`/`dropTable`/`hasTable` map the [core schema DSL](../core/README.md) onto Postgres DDL via knex' `pg` schema builder; the resulting DDL is executed through the Data API. `defineTable` is used to validate column definitions before generating SQL.

### Auto-increment

Set `{ autoIncrement: true }` on an integer column to get a Postgres `SERIAL` (knex `table.increments(name)`). Required when you use `KeyType.number` (the default) — otherwise insert SQL provides no value for the PK column.

## Aurora MySQL Data API

The compiled SQL targets PostgreSQL syntax. If you point the connector at a MySQL Aurora cluster you'll need to verify quoting/keywords match your queries — this path is not part of CI.

## Changelog

See [`HISTORY.md`](./HISTORY.md).
