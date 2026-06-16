# History

## vNext

### Security

- Added a root `pnpm.overrides` entry `qs@>=6.11.1 <6.15.2` → `>=6.15.2` to patch a moderate remotely-triggerable DoS in `qs.stringify` (GHSA-q8mj-m7cp-5q26), reached transitively via `express` / `supertest` (test-time only). Resolves Dependabot alert #921.

## v1.1.8

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.0.0

- `buildOpenApiDocument({ title, version, servers?, resources })` produces a plain-object OpenAPI 3.1 description of the routes a `createRestRouter(...)` exposes — no `swagger-jsdoc` / `openapi3-ts` / `zod-to-openapi` dependency. The generator walks the user-supplied field map (explicit; can be fed by the `zod` / `typebox` / `arktype` bridges' `describeColumns()` output) and emits `<Name>`, `<Name>CreateInput`, `<Name>UpdateInput`, `<Name>FilterInput`, `<Name>List` schemas plus paths for every enabled action, with shared `Error` responses on 400/401/404/422. Pass `actions: [...]` per resource to restrict what ends up in the document. Plug into Express via `app.get('/openapi.json', (_req, res) => res.json(buildOpenApiDocument(...)))`.
- Initial release. Replaces `@next-model/api-router` + `@next-model/api-server-express`.
- `createRestRouter(Model, options)` produces an Express 5 `Router` with the eight default REST actions (`index`, `show`, `create`, `update`, `delete`, `count`, `first`, `last`).
- Per-action + global `authorize` callbacks with `UnauthorizedError` → `401` mapping.
- Per-row `serialize` and full-envelope `envelope` response mappers.
- Standard HTTP-status error mapping: `NotFoundError` → 404, `ValidationError` → 422, `UnauthorizedError` → 401, `BadRequestError` → 400.
- Query parameter parsing for `filter` (JSON or bracket), `order` (CSV with `-` prefix), `limit`/`skip`, `page`/`perPage`, `after`/`before` (cursor pagination via `Model.paginateCursor`).
