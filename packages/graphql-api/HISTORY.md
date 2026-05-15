# History

## vNext

## v1.1.6

## v1.1.5

## v1.1.4

## v1.1.2

## v1.1.1

## v1.1.0

## v1.0.0

- Initial release. `buildModelResource({ Model, name, fields, ... })` returns `{ typeDefs, resolvers }` for six default operations: `list`, `get`, `count`, `create`, `update`, `delete`.
- Generated types per resource: `type <Name>`, `type <Name>List`, `input <Name>CreateInput`, `input <Name>UpdateInput`, `input <Name>FilterInput`, `input <Name>OrderInput`, plus an `enum <Name>OrderColumn` pinned to the field set.
- `composeSchema(resources)` merges any number of resources into a single `{ typeDefs, resolvers }` bundle, emitting root `Query` / `Mutation` stubs so single-resource bundles still parse.
- Per-operation + global `authorize` callbacks; `false` returns surface as `GraphQLError` with `extensions.code = 'UNAUTHORIZED'`.
- Per-row `serialize` hook.
- Query args: `filter` (each field optional), `order` (ASC/DESC per key), `limit`, `skip`, `page`/`perPage` (offset pagination with `meta: { page, perPage, total, totalPages, hasNext, hasPrev }`), `after`/`before` (cursor pagination with `meta: { nextCursor, prevCursor, hasMore }`).
- Error mapping: `NotFoundError` → `NOT_FOUND`, `ValidationError` → `VALIDATION_ERROR`, `UnauthorizedError` → `UNAUTHORIZED`, other `NextModelError` → `PERSISTENCE_ERROR`.
