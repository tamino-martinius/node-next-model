# History

## vNext

## v1.2.0

### Changed

- Added support for **graphql-js 17**: widened the `graphql` peer range to `^16.9.0 || ^17.0.0` and now build/test against 17. Non-breaking for existing graphql 16 consumers (`@graphql-tools/schema` ^10 already spans both majors).
- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.6 → 4.1.9, `@types/node` 25.9.0 → 25.9.3.

### Security

- Patched test-toolchain advisories via root `pnpm.overrides`: `ws` → `>=8.21.0` (GHSA-96hv-2xvq-fx4p) and `vite` → `>=8.0.16` (GHSA-fx2h-pf6j-xcff / GHSA-v6wh-96g9-6wx3), reached transitively through `vitest` / `happy-dom` (test-time only).

## v1.1.8

### Changed

- Bumped dev deps: `graphql` 16.13.2 → 16.14.0, `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.0.0

- Initial release. `buildModelResource({ Model, name, fields, ... })` returns `{ typeDefs, resolvers }` for six default operations: `list`, `get`, `count`, `create`, `update`, `delete`.
- Generated types per resource: `type <Name>`, `type <Name>List`, `input <Name>CreateInput`, `input <Name>UpdateInput`, `input <Name>FilterInput`, `input <Name>OrderInput`, plus an `enum <Name>OrderColumn` pinned to the field set.
- `composeSchema(resources)` merges any number of resources into a single `{ typeDefs, resolvers }` bundle, emitting root `Query` / `Mutation` stubs so single-resource bundles still parse.
- Per-operation + global `authorize` callbacks; `false` returns surface as `GraphQLError` with `extensions.code = 'UNAUTHORIZED'`.
- Per-row `serialize` hook.
- Query args: `filter` (each field optional), `order` (ASC/DESC per key), `limit`, `skip`, `page`/`perPage` (offset pagination with `meta: { page, perPage, total, totalPages, hasNext, hasPrev }`), `after`/`before` (cursor pagination with `meta: { nextCursor, prevCursor, hasMore }`).
- Error mapping: `NotFoundError` → `NOT_FOUND`, `ValidationError` → `VALIDATION_ERROR`, `UnauthorizedError` → `UNAUTHORIZED`, other `NextModelError` → `PERSISTENCE_ERROR`.
