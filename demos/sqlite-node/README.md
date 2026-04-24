# sqlite-node

Plain Node demo of `@next-model/sqlite-connector` (built on `better-sqlite3`). Uses an in-memory database — no setup required.

```sh
pnpm install
pnpm start
```

What it shows:

- Connecting to an in-memory sqlite database via `new SqliteConnector(':memory:')`
- Schema DSL → SQLite DDL (auto-increment, defaults, boolean as `INTEGER`)
- `createMany` for bulk insert
- Filter chaining + aggregates
- Cursor pagination
- `connector.execute(...)` for raw SQL (sqlite-flavoured)

For a file-backed database pass the path: `new SqliteConnector('./data/app.sqlite')`.
