# History

## vNext

- **Fast path for primary-key lookups**. When a scope's filter is exactly `{pk: value}` or `{$in: {pk: [...]}}`, the connector now uses direct `HGETALL` on the known row key(s) instead of `ZRANGE` + full-table scan. `query` and `count` pick up the optimization automatically, so `Model.find(id)`, `filterBy({id})`, and `filterBy({$in: {id: [...]}})` stay O(k) in the number of ids asked for regardless of how big the table is. Falls back to the existing scan path for any other filter shape. `@next-model/valkey-connector` inherits the fix (it extends `RedisConnector`). The primary key is read from the table `:meta` blob so non-`id` primary keys work too.

### Initial release

- New `@next-model/redis-connector` package: implements `@next-model/core`'s `Connector` interface against Redis using [node-redis](https://github.com/redis/node-redis).
- **Storage layout** (per table, all under a configurable `prefix`):
  - `{prefix}{table}:meta` — JSON-serialised table definition. Existence flag for `hasTable`.
  - `{prefix}{table}:nextid` — `INCR` counter for auto-increment ids.
  - `{prefix}{table}:ids` — `ZSET` of all row ids (score = numeric id) for ordered iteration.
  - `{prefix}{table}:row:{id}` — `HASH` of column → JSON-encoded value (so booleans, numbers, `Date`, and `null` round-trip cleanly).
- **Filtering** — Redis cannot natively express the full filter DSL, so the connector loads the table's id set, fetches each row, then applies the filter via core's `filterList`. Adequate for moderate-size tables; not suitable as the primary store for million-row queries.
- **Aggregates** — computed client-side over the filtered rows.
- **Transactions** — `transaction(fn)` snapshots every table touched at the start of the block and restores them on throw. This is *not* `MULTI/EXEC` and provides no isolation against concurrent clients; it matches the in-memory connector's snapshot/restore semantics.
- **Schema DDL** — table definitions are stored verbatim in `{prefix}{table}:meta`; column types are advisory (Redis is schemaless), but `defineTable` validates the blueprint at create time.
- Validated through the shared `runModelConformance` suite plus driver-specific tests (HASH round-trip, Date/boolean/JSON encoding, raw `execute`) against a real Redis 7 service container in CI.
