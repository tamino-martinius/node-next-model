# History

## vNext

- Initial release. Replaces `@next-model/api-router` + `@next-model/api-server-express`.
- `createRestRouter(Model, options)` produces an Express 5 `Router` with the eight default REST actions (`index`, `show`, `create`, `update`, `delete`, `count`, `first`, `last`).
- Per-action + global `authorize` callbacks with `UnauthorizedError` → `401` mapping.
- Per-row `serialize` and full-envelope `envelope` response mappers.
- Standard HTTP-status error mapping: `NotFoundError` → 404, `ValidationError` → 422, `UnauthorizedError` → 401, `BadRequestError` → 400.
- Query parameter parsing for `filter` (JSON or bracket), `order` (CSV with `-` prefix), `limit`/`skip`, `page`/`perPage`, `after`/`before` (cursor pagination via `Model.paginateCursor`).
