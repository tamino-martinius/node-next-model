# @next-model/nextjs-api

Next.js App Router adapter for next-model. Emits `{ GET, POST, PATCH, DELETE }` route-handler exports — the same hook surface as `@next-model/express-rest-api`, without Express.

```sh
pnpm add @next-model/nextjs-api
# or: npm install @next-model/nextjs-api
```

## Getting started

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

Works on Next.js 13.4+. The member handlers accept both the synchronous `params` bag (Next 14) and the promise-wrapped form (Next 15), so the same export covers both versions.

## Actions

**Collection handler** (`createCollectionHandlers`):

| HTTP           | Action    |
|----------------|-----------|
| `GET /`        | `index`   |
| `GET /count`   | `count`   |
| `GET /first`   | `first`   |
| `GET /last`    | `last`    |
| `POST /`       | `create`  |

The last segment of the URL selects the aggregate; everything else falls through to `index` for `GET` and `create` for `POST`.

**Member handler** (`createMemberHandlers`):

| HTTP           | Action   |
|----------------|----------|
| `GET /:id`     | `show`   |
| `PATCH /:id`   | `update` |
| `DELETE /:id`  | `delete` |

## Query parameters

Same shape as the Express adapter — `filter` (JSON), `order` (CSV, `-` prefix for desc), `limit`, `skip`, `page`, `perPage`, `after`, `before`. See [`@next-model/express-rest-api`](../express-rest-api/README.md) for the full table.

## Per-action authorization + response mapping

```ts
createCollectionHandlers(User, {
  authorize: ({ req }) => Boolean(req.headers.get('x-user-id')),       // global
  actions: {
    create: { authorize: ({ req }) => req.headers.get('x-role') === 'admin' },
  },
  serialize: (row, ctx) => {
    const attrs = row.attributes();
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
  envelope: ({ action, data, meta }) => ({ action, data, meta }),
});
```

Return `false` (or throw) from `authorize` → `401 Unauthorized`. Set an action to `false` to disable it (handler returns `404`).

## Errors

| Thrown                                | HTTP status |
|---------------------------------------|------------:|
| `NotFoundError`                       | 404         |
| `ValidationError`                     | 422         |
| `UnauthorizedError` (also auth deny)  | 401         |
| `BadRequestError` (invalid query)     | 400         |
| everything else                       | 500         |
