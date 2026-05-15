# History

## vNext

## v1.1.6

## v1.1.5

## v1.1.4

### Changed

- `execute(query, bindings)` and `$raw.$query` no longer accept JS-source strings — pass a function instead (`(storage, ...bindings) => any[]` for `execute`; `(item, ...bindings) => boolean` for `$raw`). Inherited from `MemoryConnector`. See the core HISTORY for the full rationale (CSP-safe bundles, tree-shaking, source-map fidelity).

## v1.1.2

### Added

- Single-arg constructor accepts `schema` inline: `new LocalStorageConnector({ localStorage, prefix, schema })` works in addition to the legacy `(options, { schema })` two-arg form. Mirrors the `MemoryConnector` widening so the constructor footprint is consistent across both connectors.

### Changed

- `@next-model/core` moved from `dependencies` to `peerDependencies` (`^1.1.1`). Consumers must install core alongside this connector — the install-time warning replaces the previous "core got hoisted from a transitive devDep" behaviour. The monorepo workspace continues to resolve the in-tree core via `devDependencies: { "@next-model/core": "workspace:*" }`.

## v1.1.1

### Added

- `connector.ensureSchema()` is inherited from `MemoryConnector` — when the connector carries a schema (`new LocalStorageConnector(opts, { schema })`), the call walks every declared table and initialises an empty array in `localStorage` for each one that doesn't already exist, returning `{ created, existing }`. Existing rows in other tables are untouched. Throws if no schema is attached.
- Sourcemap files (`dist/**/*.map`) are now published with the package so downstream bundlers resolve stack frames inside `@next-model/local-storage-connector` to the original TypeScript source. No runtime change.

## v1.1.0

## v1.0.0

Rolling changelog for the next major release. Items below are appended in the order they ship; this list will be finalized into a version heading when the release is cut.

- Implements `Connector.alterTable(spec)` by inheriting `MemoryConnector.alterTable` and persisting the affected table after the rows have been rewritten. Column rename / remove rewrite the in-memory rows then flush to `localStorage`; foreign keys + check constraints inherit the `UnsupportedOperationError` from `MemoryConnector`.

### Native UPSERT
- Implements the optional `Connector.upsert(spec)` by delegating to `MemoryConnector.upsert` and persisting the touched table through the localStorage write path (deferred under `transaction(...)`).

### Rewrite

- Full TypeScript rewrite. Package renamed to `@next-model/local-storage-connector`.
- Connector now subclasses `MemoryConnector`; all filter operators, ordering, aggregates, `execute` (JS eval), and `batchInsert` behave identically to the in-memory store.
- Persists each table lazily: reads a single JSON array from `localStorage` on first access and writes back after every mutation. Per-table `__nextId` key so deleted rows never have their id reused.

### Options

- Constructor accepts `{ localStorage?, prefix?, suffix? }`. When no `localStorage` is injected, falls back to `globalThis.localStorage` for browser use; throws if neither is available.
- `prefix`/`suffix` let apps namespace keys (e.g. `prefix: 'app:', suffix: ':v1'` → `app:users:v1`).

### Transactions

- `transaction(fn)` defers `localStorage` writes until commit; on rollback, the underlying storage and `localStorage` both stay untouched. Nested transactions join the outer transaction.

### Schema DSL

- Implemented `createTable(name, blueprint)`, `dropTable(name)`, and `hasTable(name)` on top of the inherited `MemoryConnector` behaviour, adding `localStorage` (de)hydration so tables survive a page reload and drops clear both the row collection and the `__nextId` counter from the backing `Storage`.

### Testing

- Ships `MemoryLocalStorage` mock implementing the minimal `Storage` surface so the vitest suite runs headlessly in Node.

## v0.4.3

Updated next-model dependency to `v0.4.1`

## v0.4.2

Updated next-model dependency to `v0.4.0`

## v0.4.1

Updated next-model dependency to `v0.3.0`

## v0.4.0

Stored nextId separately in LocalStorage.

This is changed to prevent id reuse after list got empty by deletions.

## v0.3.0

Improved browser compatibility.

## v0.2.0

Added `expect-change@0.0.1` which was missing in the previous release.

## v0.1.0

First release compatible with NextModel **0.2.0**.

Includes special queries for:
* $and
* $or
* $not
* $null
* $notNull
* $in
* $notIn
* $between
* $notBetween
* $eq
* $lt
* $lte
* $gt
* $gte
* $match
* $filter
