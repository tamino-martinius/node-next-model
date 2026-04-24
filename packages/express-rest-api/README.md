# @next-model/express-rest-api

Turn any `@next-model/core` `Model` into a conventional REST resource on Express 5, with per-action authorization and response-mapping hooks.

Replaces the legacy `@next-model/api-router` + `@next-model/api-server-express` packages.

```sh
pnpm add @next-model/express-rest-api
```

## Getting started

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

You get the following routes out of the box:

| Method   | Path             | Action   |
|----------|------------------|----------|
| `GET`    | `/`              | `index`  |
| `GET`    | `/count`         | `count`  |
| `GET`    | `/first`         | `first`  |
| `GET`    | `/last`          | `last`   |
| `POST`   | `/`              | `create` |
| `GET`    | `/:id`           | `show`   |
| `PATCH`  | `/:id`           | `update` |
| `DELETE` | `/:id`           | `delete` |

## Query parameters

The `index`, `count`, `first` and `last` actions honour the same query surface:

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

## Per-action authorization

```ts
createRestRouter(User, {
  authorize: (ctx) => Boolean((ctx.req as any).user),        // global
  actions: {
    delete: { authorize: (ctx) => ctx.record?.ownerId === ctx.req.user.id },
    create: { authorize: adminOnly },
  },
});
```

`authorize` returns `false` or throws → `401 Unauthorized`.

## Response mapping

```ts
createRestRouter(User, {
  // Per-row — strip sensitive fields, rename columns, …
  serialize: (row, ctx) => {
    const attrs = row.attributes() as Record<string, unknown>;
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
  // Full envelope — swap to JSON:API, add HATEOAS, whatever
  envelope: ({ action, data, meta }, ctx) => ({ action, data, meta, at: Date.now() }),
});
```

## Disabling actions

```ts
createRestRouter(User, { actions: { delete: false, create: false } });
```

Disabled actions aren't registered, so the route returns Express's default `404`.

## Errors

| Error thrown                                 | HTTP status |
|----------------------------------------------|------------:|
| `NotFoundError`                              | 404         |
| `ValidationError`                            | 422         |
| `UnauthorizedError` (also returned from auth failure) | 401 |
| `BadRequestError` (invalid query)            | 400         |
| everything else                              | 500         |
