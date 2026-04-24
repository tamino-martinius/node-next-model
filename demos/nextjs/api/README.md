# nextjs/api

Next.js 15 App Router demo of `@next-model/nextjs-api`. Two route-handler exports (`app/api/users/route.ts` + `app/api/users/[id]/route.ts`) expose a full REST resource with per-action auth and per-row serialize — no `createRestRouter`, no Express.

```sh
pnpm install
pnpm dev       # opens http://localhost:3000
pnpm build && pnpm start
```

The route handlers gate every request on an `x-role` header; `create`, `update`, `delete` require `x-role: admin`. Try:

```sh
curl -H 'x-role: member' http://localhost:3000/api/users
curl -X POST -H 'x-role: admin' -H 'content-type: application/json' \
  -d '{"name":"Grace","role":"admin","active":true}' \
  http://localhost:3000/api/users
curl -X DELETE http://localhost:3000/api/users/2                        # 401
curl -X DELETE -H 'x-role: admin' http://localhost:3000/api/users/2     # 204
```

SQLite file lives under `./.data/`. Delete it to start fresh.

## Troubleshooting

If `pnpm dev` fails with `NODE_MODULE_VERSION` errors from `better-sqlite3`, the native binding was compiled against a different Node version than the one you're running. From the repo root:

```sh
pnpm rebuild better-sqlite3
```

This re-runs `prebuild-install` / `node-gyp` against your current Node and fixes the ABI mismatch.
