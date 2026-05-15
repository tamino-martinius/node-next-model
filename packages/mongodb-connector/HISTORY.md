# History

## vNext

## v1.1.2

### Changed

- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`).

## v1.1.1

## v1.1.0

## v1.0.0

- Implements `Connector.alterTable(spec)`. `removeColumn` / `renameColumn` map to `updateMany({}, { $unset })` / `$rename`; `addIndex` / `removeIndex` use `collection.createIndex` / `dropIndex`. `addColumn` / `changeColumn` are document-store no-ops (MongoDB has no schema); `renameIndex`, foreign keys, and check constraints throw `UnsupportedOperationError`.

### Native UPSERT
- Implements the optional `Connector.upsert(spec)` method via `bulkWrite` of `updateOne` ops with `upsert: true`. User-supplied columns in `updateColumns` go to `$set` (so updates apply); the rest of the row plus the auto-generated primary key go to `$setOnInsert` (so existing rows keep their PK and unchanged columns). `ignoreOnly: true` puts everything in `$setOnInsert` (DO NOTHING semantics on match). After the bulk write, one follow-up `find` keyed by `conflictTarget` returns rows in input order. `Model.upsert` / `Model.upsertAll` automatically route through this path.

### Initial release

- New `@next-model/mongodb-connector` package: implements `@next-model/core`'s `Connector` interface against MongoDB using the official [`mongodb`](https://github.com/mongodb/node-mongodb-native) driver.
- **Storage layout** — each table maps to a MongoDB collection of the same name. Two metadata collections:
  - `_nm_schemas` — tracks which tables have been created via `createTable` (existence flag for `hasTable`).
  - `_nm_counters` — holds per-table `findOneAndUpdate` sequence counters so `KeyType.number` keys auto-increment.
- **Filter compilation** maps the core DSL onto MongoDB's native query language: `$and`/`$or` carry over verbatim, `$not` becomes `$nor`, `$in`/`$notIn` become `$in`/`$nin`, `$null`/`$notNull` use `$eq`/`$ne` against `null`, `$between` becomes `{ $gte, $lte }`, comparison operators are 1:1, and `$like` is translated to an anchored regex (`%` → `.*`, `_` → `.`).
- `$raw` accepts a JSON-encoded MongoDB filter document — escape hatch for ops the core DSL doesn't cover (`$elemMatch`, `$exists`, `$type`, …).
- `select()` projects requested fields and always strips `_id` so callers see the same shape they inserted.
- `transaction(fn)` snapshots every tracked collection at the start of the block and restores them on throw — same semantics as the in-memory and Redis connectors. *Not* a multi-document MongoDB transaction (that requires a replica set); no isolation against concurrent clients.
- `execute(command, args)` is a thin wrapper around `db.command({ [command]: args })` — escape hatch for `runCommand`-style operations.
- Identifier safety: collection names are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before use.
- Validated through the shared `runModelConformance` suite + driver-specific tests against a real MongoDB 7 service container in CI.
