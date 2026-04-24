# aurora-data-api-node

Plain Node demo of `@next-model/aurora-data-api-connector` against the in-tree `MockDataApiClient` — no AWS account or VPN tunnel required.

```sh
pnpm install
pnpm start
```

## What it shows

- The connector is **transport-agnostic**: it speaks to whatever `DataApiClient` you hand it. In production that's `data-api-client` talking to a real Aurora Serverless v1 RDS Data API; locally it's `MockDataApiClient` (exposed at `@next-model/aurora-data-api-connector/mock-client`) which executes the same SQL against an in-memory sqlite database.
- Same `Model({...})` declaration, same filters / aggregates / transactions as every other connector.
- A single-line swap moves the demo from local mock to real AWS:

  ```ts
  const connector = new DataApiConnector({
    secretArn: process.env.AURORA_SECRET_ARN,
    resourceArn: process.env.AURORA_CLUSTER_ARN,
    database: 'app_production',
  });
  ```

The demo recreates the `users` table on every run, so it's safe to re-execute.
