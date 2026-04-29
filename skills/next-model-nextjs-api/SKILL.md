---
name: next-model-nextjs-api
description: "`@next-model/nextjs-api` — Next.js App Router adapter that turns a `@next-model/core` Model into a route handler module exporting `{ GET, POST, PATCH, DELETE }`. Same per-action auth + response-mapping hook surface as `@next-model/express-rest-api`, no Express. Trigger when the user wants to expose a model in Next.js, build an App Router CRUD route, set up `app/api/<resource>/route.ts` handlers, or deploy a model-backed REST endpoint to Vercel."
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# @next-model/nextjs-api

Next.js App Router adapter for `@next-model/core`. `createCollectionHandlers(Model, opts)` and `createMemberHandlers(Model, opts)` return the four route-handler exports (`GET` / `POST` / `PATCH` / `DELETE`) that the App Router expects from a `route.ts` file. The hook surface — `authorize`, per-action overrides, `serialize`, `envelope`, error mapping — is identical to `@next-model/express-rest-api`, so a project that already speaks the Express adapter can re-host on Vercel without rewriting handlers. Member handlers accept both the synchronous `params` bag (Next 14) and the promise-wrapped form (Next 15), so one export covers both versions. Works on Next.js 13.4+.

## When to use

- Next.js App Router projects that need a REST endpoint over a Model.
- Vercel deploys (or any serverless platform that runs the App Router).
- Pairing model-driven CRUD with React Server Components / `fetch` from a Next.js client.

## When not to use

- Pages Router / `pages/api/*` handlers — use `next-model-express-rest-api` (Next.js Pages handlers are Express-shaped).
- GraphQL transport — use `next-model-graphql-api`.
- Pure server-side queries inside a Server Component — talk to the Model directly; you don't need a route handler.

## Install

```sh
pnpm add @next-model/nextjs-api
# or: npm install @next-model/nextjs-api
```

Peer-deps on `@next-model/core`. Requires Next.js 13.4+ and Node runtime (`export const runtime = 'nodejs'`) when the connector needs Node APIs (e.g. `better-sqlite3`).

## Setup

A typical resource lives in two files — one for the collection (`/users`) and one for the member (`/users/:id`).

```ts
// app/api/users/route.ts
import { User } from '@/lib/models';
import { createCollectionHandlers } from '@next-model/nextjs-api';

export const { GET, POST } = createCollectionHandlers(User, {
  authorize: ({ req }) => Boolean(req.headers.get('authorization')),
});

export const runtime = 'nodejs'; // better-sqlite3 etc. need the Node runtime
```

```ts
// app/api/users/[id]/route.ts
import { User } from '@/lib/models';
import { createMemberHandlers } from '@next-model/nextjs-api';

export const { GET, PATCH, DELETE } = createMemberHandlers(User, {
  actions: {
    delete: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
  },
});
```

### Action map

Collection handler (`createCollectionHandlers`):

| HTTP           | Action    |
|----------------|-----------|
| `GET /`        | `index`   |
| `GET /count`   | `count`   |
| `GET /first`   | `first`   |
| `GET /last`    | `last`    |
| `POST /`       | `create`  |

The last segment of the URL selects the aggregate; everything else falls through to `index` for `GET` and `create` for `POST`.

Member handler (`createMemberHandlers`):

| HTTP           | Action   |
|----------------|----------|
| `GET /:id`     | `show`   |
| `PATCH /:id`   | `update` |
| `DELETE /:id`  | `delete` |

## Hooks

Per-action authorization and response mapping are layered on top of a global default. Same shape as `@next-model/express-rest-api`.

```ts
createCollectionHandlers(User, {
  authorize: ({ req }) => Boolean(req.headers.get('x-user-id')),       // global
  actions: {
    create: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
  },
  serialize: (row, ctx) => {
    const attrs = row.attributes;
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
  envelope: ({ action, data, meta }) => ({ action, data, meta }),
});
```

Return `false` (or throw) from `authorize` → `401 Unauthorized`. Set an action to `false` to disable it (handler returns `404`).

## Filtering / pagination / ordering

Same query-string contract as the Express adapter — every key maps to a chainable scope on the Model:

- `filter` — JSON-encoded `filterBy` object (e.g. `?filter={"status":"open"}`).
- `order` — CSV of column names; prefix with `-` for descending (e.g. `?order=-createdAt,name`).
- `limit`, `skip` — passed straight to `limitBy` / `skipBy`.
- `page`, `perPage` — drive `paginate(page, perPage)`.
- `after`, `before` — cursor pagination on the ordered query.

See [`@next-model/express-rest-api`](../express-rest-api/README.md) for the full table.

## Errors

Thrown errors are mapped to HTTP status codes:

| Thrown                                | HTTP status |
|---------------------------------------|------------:|
| `NotFoundError`                       | 404         |
| `ValidationError`                     | 422         |
| `UnauthorizedError` (also auth deny)  | 401         |
| `BadRequestError` (invalid query)     | 400         |
| everything else                       | 500         |

## See also

- `next-model-core` — the Model factory the handlers wrap.
- `next-model-express-rest-api` — same hook surface for Pages Router / Express / Fastify deploys.
- `next-model-graphql-api` — GraphQL transport with the same auth + serialize layering.
