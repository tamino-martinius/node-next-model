---
name: next-model-express-rest-api
description: Use `@next-model/express-rest-api` to expose a `@next-model/core` Model as a conventional REST resource on Express 5. Triggers include "expose model over Express REST", "REST adapter", "8 default CRUD actions", "auth hooks per action", and "response mapping".
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

`@next-model/express-rest-api` is an Express 5 adapter that turns any `@next-model/core` `Model` into a conventional REST resource. A single `createRestRouter(Model, options)` call mounts 8 default CRUD actions (`index`, `count`, `first`, `last`, `create`, `show`, `update`, `delete`) on an Express router, with per-action `authorize` hooks for authorization and `serialize` / `envelope` hooks for response mapping. It replaces the legacy `@next-model/api-router` + `@next-model/api-server-express` packages.

## When to use

- You have a `@next-model/core` Model and want to expose it over HTTP as a REST resource on an Express 5 app.
- You need conventional CRUD endpoints (list / count / first / last / create / show / update / delete) with filtering, ordering, and pagination out of the box.
- You want per-action authorization callbacks and per-row / per-envelope response shaping without writing the route handlers yourself.

## When not to use

- You want a GraphQL API instead of REST. Use the `next-model-graphql-api` skill.
- You're on Next.js App Router (Route Handlers, edge/serverless). Use the `next-model-nextjs-api` skill.

## Install

```sh
pnpm add @next-model/express-rest-api
# or: npm install @next-model/express-rest-api
```

Peer dependency: `express` `^5.0.0` (and `@next-model/core`).

## Setup

Minimal example mounting the adapter on an Express app for a Model:

```ts
import express from 'express';
import { Model, SqliteConnector } from '@next-model/core';
import { createRestRouter } from '@next-model/express-rest-api';

const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number; active: boolean }) => props,
}) {}

const app = express();
app.set('query parser', 'extended'); // required for ?filter[name]=Ada
app.use(express.json());
app.use('/users', createRestRouter(User));

app.listen(3000);
```

## Default actions

| Method   | Path             | Action   | What it does                                                      |
|----------|------------------|----------|-------------------------------------------------------------------|
| `GET`    | `/`              | `index`  | List records, honouring filter/order/limit/skip/page/cursor params |
| `GET`    | `/count`         | `count`  | Return record count for the current filter                         |
| `GET`    | `/first`         | `first`  | Return the first matching record                                   |
| `GET`    | `/last`          | `last`   | Return the last matching record                                    |
| `POST`   | `/`              | `create` | Create a record from the JSON body                                 |
| `GET`    | `/:id`           | `show`   | Return a single record by id                                       |
| `PATCH`  | `/:id`           | `update` | Patch a record by id                                               |
| `DELETE` | `/:id`           | `delete` | Delete a record by id                                              |

Disable any action by passing `false`; disabled actions aren't registered, so the route returns Express's default `404`:

```ts
createRestRouter(User, { actions: { delete: false, create: false } });
```

## Auth hooks

Pass a top-level `authorize` for a global guard, plus per-action `authorize` callbacks under `actions`. `authorize` returning `false` or throwing produces `401 Unauthorized`.

```ts
createRestRouter(User, {
  authorize: (ctx) => Boolean((ctx.req as any).user),        // global
  actions: {
    delete: { authorize: (ctx) => ctx.record?.ownerId === ctx.req.user.id },
    create: { authorize: adminOnly },
  },
});
```

The hook receives a context with the Express `req` and, for record-scoped actions (`show`, `update`, `delete`), the loaded `record`.

## Response mapping

Two response-mapping hooks are available — `serialize` for per-row shaping and `envelope` for the full response shape:

```ts
createRestRouter(User, {
  // Per-row — strip sensitive fields, rename columns, …
  serialize: (row, ctx) => {
    const attrs = row.attributes as Record<string, unknown>;
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
  // Full envelope — swap to JSON:API, add HATEOAS, whatever
  envelope: ({ action, data, meta }, ctx) => ({ action, data, meta, at: Date.now() }),
});
```

## Filtering / pagination / ordering

The `index`, `count`, `first` and `last` actions translate query-string params into `filterBy` / `orderBy` / `limitBy` / `skipBy` on the Model:

| Param              | Meaning                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `filter`           | JSON (`?filter={"name":"Ada"}`) or bracket (`?filter[name]=Ada`)         |
| `order`            | comma-separated keys; prefix with `-` for `desc` (`?order=-age,name`)    |
| `limit` / `skip`   | basic windowing                                                          |
| `page` / `perPage` | offset pagination (envelope: `{ data, meta: { page, total, ... } }`)     |
| `after` / `before` | cursor pagination (envelope: `{ data, meta: { nextCursor, prevCursor } }`). Pass either key (even empty) to opt into cursor mode. |

Bracket-form filters require Express's `extended` query parser:

```ts
app.set('query parser', 'extended');
```

## Errors

Errors thrown from hooks or the underlying Model are mapped to HTTP status codes:

| Error thrown                                          | HTTP status |
|-------------------------------------------------------|------------:|
| `NotFoundError`                                       | 404         |
| `ValidationError`                                     | 422         |
| `UnauthorizedError` (also returned from auth failure) | 401         |
| `BadRequestError` (invalid query)                     | 400         |
| everything else                                       | 500         |

## See also

- `next-model-core` — the underlying `Model` factory and connector contract.
- `next-model-graphql-api` — GraphQL adapter for the same Models.
- `next-model-nextjs-api` — Next.js App Router adapter.
