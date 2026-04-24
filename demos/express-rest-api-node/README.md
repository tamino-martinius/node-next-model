# express-rest-api-node

End-to-end demo of `@next-model/express-rest-api` on top of `@next-model/sqlite-connector` (in-memory).

```sh
pnpm install
pnpm start
```

Drives a running Express 5 server through the eight default REST actions, showing:

- Global `authorize` (missing `x-role` header → 401).
- Per-action `authorize` (`delete` is admin-only).
- Per-row `serialize` (primary key renamed `id → uid`; `active` column hidden from non-admin callers).
- `envelope` wrapping every response as `{ action, data, meta }`.
- `filter` + `count` + `create`.

The demo boots, seeds three users, exercises the API, and exits — no infrastructure required.
