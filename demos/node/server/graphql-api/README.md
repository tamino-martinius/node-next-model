# graphql-api-node

End-to-end demo of `@next-model/graphql-api` served via `graphql-http` on Express 5, backed by `@next-model/sqlite-connector` (in-memory).

```sh
pnpm install
pnpm start
```

Shows:

- `buildModelResource` + `composeSchema` wiring into a real executable GraphQL schema (`@graphql-tools/schema`).
- Global `authorize` (missing `x-role` header → `UNAUTHORIZED`).
- Per-operation `authorize` — `deleteUser` is admin-only.
- Per-row `serialize` — members don't see the `active` field.
- Query filter + mutation + auth error paths.
