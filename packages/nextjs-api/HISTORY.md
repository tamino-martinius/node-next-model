# History

## vNext

## v1.1.0

## v1.0.0

- Initial release. `createCollectionHandlers(Model, options)` + `createMemberHandlers(Model, options)` produce Next.js App Router route-handler exports (`{ GET, POST }` / `{ GET, PATCH, DELETE }`) with the same hook surface as `@next-model/express-rest-api`.
- Supports Next 14 (sync `params`) and Next 15 (promise-wrapped `params`) from a single export.
- Per-action + global `authorize`, per-row `serialize`, full-envelope `envelope`, `NotFoundError`→404 / `ValidationError`→422 / `UnauthorizedError`→401 / `BadRequestError`→400 error mapping.
- Query parsing for `filter` (JSON), `order` (CSV, `-` prefix), `limit`, `skip`, `page`/`perPage`, cursor-mode `after`/`before`.
- No peer on Next.js itself — the handlers depend only on the web-standard `Request` / `Response` globals, so they also work from any Node 18+ runtime that provides those.
