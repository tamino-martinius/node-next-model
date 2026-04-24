# mongodb-node

End-to-end demo of `@next-model/mongodb-connector` against a real MongoDB 7.

## Run it

```sh
pnpm install
pnpm db:up           # docker compose up -d (mongo on :27017)
pnpm start
pnpm db:down
```

`MONGODB_URL` overrides the default (`mongodb://127.0.0.1:27017`).

## What it shows

- Connecting via `new MongoDbConnector({ url, database })` — the connector tracks created collections in `_nm_schemas`, auto-increments via `_nm_counters`.
- Filter operators map straight onto native MongoDB query language (`$gte`, `$in`, `$ne`, regex for `$like`).
- `$raw` is the escape hatch — pass a JSON-encoded mongo filter document to use `$elemMatch`, `$exists`, `$type`, …
- The demo wipes every collection in the demo database at the start so it's safe to re-execute.

> Note: a single-node MongoDB doesn't support multi-document transactions. The connector falls back to snapshot/restore semantics for `transaction(fn)`.
