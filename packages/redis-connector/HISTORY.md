# History

## vNext

### Changed

- Upgraded the bundled `redis` (node-redis) client **4 → 6**. The client is pinned to `RESP: 2`, so every command's return type is identical to before; SCAN now uses string cursors internally (node-redis v6 removed numeric-cursor coercion). Typical usage is unaffected. Callers who pass their own pre-built client via `config.redis` should supply a node-redis v6 client; opt into RESP3 with `config.client.RESP`.
- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.6 → 4.1.9, `@types/node` 25.9.0 → 25.9.3.

### Security

- Patched test-toolchain advisories via root `pnpm.overrides`: `ws` → `>=8.21.0` (GHSA-96hv-2xvq-fx4p) and `vite` → `>=8.0.16` (GHSA-fx2h-pf6j-xcff / GHSA-v6wh-96g9-6wx3), reached transitively through `vitest` / `happy-dom` (test-time only).

## v1.1.8

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

### Notes

- `redis` is kept at `^4.7.1`. node-redis v5 is available but has breaking API changes (client options, command return shapes, connection lifecycle) that require connector rework + retesting against a real Redis server. Tracked for a separate release. `pnpm audit` reports no vulnerabilities in 4.7.1.

## v1.1.2

### Changed

- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`).

## v1.0.0

- Implements `Connector.alterTable(spec)`. Column renames / removals rewrite the underlying hashes via `HDEL` / `HSET`. `addColumn` / `addIndex` / `removeIndex` / `renameIndex` / `changeColumn` are no-ops since Redis stores arbitrary fields and doesn't enforce indexes; foreign keys + check constraints throw `UnsupportedOperationError`. Inherited verbatim by `@next-model/valkey-connector`.
- Implements the now-required `Connector.upsert(spec)` method. Redis has no native conflict resolution against arbitrary `conflictTarget` columns, so the implementation composes the connector's own primitives — load existing rows by conflict tuple, `hSet` the `updateColumns` for matches, and `batchInsert` the rest. **Non-atomic** by Redis design — concurrent writes to the same conflict tuple may race; wrap calls in `Model.transaction(...)` for the snapshot/rollback safety net. `@next-model/valkey-connector` inherits the implementation.
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
