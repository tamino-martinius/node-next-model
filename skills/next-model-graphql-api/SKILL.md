---
name: next-model-graphql-api
description: GraphQL schema generator for `@next-model/graphql-api` — turns any next-model `Model` into typeDefs + resolvers with 6 default CRUD operations (list/get/count/create/update/delete), per-operation auth hooks, and per-row response mapping. Use when triggers like "expose model over GraphQL", "GraphQL CRUD", or "graphql-http" appear, or when wiring a Model into Apollo/Yoga/graphql-http.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-graphql-api

`@next-model/graphql-api` is a runtime-agnostic GraphQL schema generator for `@next-model/core`. Given a `Model`, it produces `{ typeDefs, resolvers }` that expose six default CRUD operations (`list`, `get`, `count`, `create`, `update`, `delete`) with per-operation authorization callbacks and per-row response-mapping hooks. You plug the result into whatever GraphQL server you already run — graphql-http, Apollo Server, GraphQL Yoga, or any executor that accepts a schema.

## When to use

- You want CRUD GraphQL queries and mutations over a `next-model` `Model` without hand-writing typeDefs and resolvers.
- You already run (or plan to run) a GraphQL endpoint via `graphql-http`, Apollo Server, GraphQL Yoga, or similar.
- You need per-operation auth gates and/or per-row response shaping (e.g. strip `passwordHash`).
- You want filtering, ordering, and offset or cursor pagination derived from the Model's existing query API.

## When not to use

- You need REST endpoints — use `@next-model/express-rest-api` (Express) or `@next-model/nextjs-api` (Next.js route handlers) instead.
- You need bespoke GraphQL types beyond CRUD — write your own schema; this package targets the common CRUD case.

## Install

```sh
pnpm add @next-model/graphql-api graphql @graphql-tools/schema
# or: npm install @next-model/graphql-api graphql @graphql-tools/schema
```

Peer deps: `graphql ^16.9.0`, `@graphql-tools/schema ^10.0.0`, `@next-model/core` (workspace).

## Setup

```ts
import { makeExecutableSchema } from '@graphql-tools/schema';
import { defineSchema, Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';
import { buildModelResource, composeSchema } from '@next-model/graphql-api';

const dbSchema = defineSchema({
  users: {
    columns: {
      id:     { type: 'integer', primary: true, autoIncrement: true },
      name:   { type: 'string' },
      age:    { type: 'integer' },
      active: { type: 'boolean' },
    },
  },
});

const connector = new SqliteConnector(':memory:', { schema: dbSchema });

class User extends Model({
  connector,
  tableName: 'users',
}) {}

const userResource = buildModelResource({
  Model: User,
  name: 'User',
  fields: {
    id: { type: 'Int!' },
    name: { type: 'String!' },
    age: { type: 'Int!' },
    active: { type: 'Boolean!' },
  },
});

const { typeDefs, resolvers } = composeSchema([userResource]);
const schema = makeExecutableSchema({ typeDefs, resolvers });
```

Hand `schema` to `graphql-http`, Apollo, Yoga, or any GraphQL runtime.

## Default operations

Every resource contributes the following types and root fields. Names are derived from the resource `name` (e.g. `User`, `users`).

| Field                     | Kind     | Purpose                                 |
|---------------------------|----------|-----------------------------------------|
| `Query.users`             | Query    | List rows with filter/order/pagination. |
| `Query.user`              | Query    | Fetch a single row by id.               |
| `Query.userCount`         | Query    | Count rows matching a filter.           |
| `Mutation.createUser`     | Mutation | Create a row from `UserCreateInput`.    |
| `Mutation.updateUser`     | Mutation | Update a row by id with `UserUpdateInput`. |
| `Mutation.deleteUser`     | Mutation | Delete a row by id.                     |

Generated types: `type User`, `input UserCreateInput`, `input UserUpdateInput`, `input UserFilterInput`, `input UserOrderInput`, and `type UserList { items, meta }`.

Set an operation to `false` in `operations` to omit it from the schema entirely (the field won't appear in the generated typeDefs).

## Auth hooks

Authorization callbacks run per-operation. A global `authorize` applies to every operation and can be overridden per-operation.

```ts
buildModelResource({
  Model: User,
  name: 'User',
  fields: {...},
  authorize: (ctx) => !!ctx.context.user,                          // global
  operations: {
    delete: { authorize: (ctx) => ctx.context.user?.role === 'admin' },
    create: { authorize: adminOnly },
  },
});
```

`authorize` returning `false` (or throwing) surfaces as a `GraphQLError` with `extensions.code = 'UNAUTHORIZED'`.

## Response mapping

`serialize` runs once per row for `list` / `get` / `create` / `update`. Use it to redact fields, rename keys, or compute derived attributes.

```ts
buildModelResource({
  Model: User,
  name: 'User',
  fields: {...},
  serialize: (row, ctx) => {
    const attrs = row.attributes as Record<string, unknown>;
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
});
```

## Filtering / pagination / ordering

GraphQL arguments map straight onto the Model query API:

| Argument                   | Effect                                                                          |
|----------------------------|---------------------------------------------------------------------------------|
| `filter: UserFilterInput`  | Each field optional, compiled to `Model.filterBy({...})`.                       |
| `order: [UserOrderInput!]` | `{ key, dir: ASC|DESC }` entries composed left-to-right via `orderBy`.          |
| `limit`, `skip`            | Basic windowing (`limitBy` / `skipBy`).                                         |
| `page`, `perPage`          | Offset pagination — `meta` populates `{ page, perPage, total, totalPages }`.    |
| `after`, `before`          | Cursor pagination — `meta` populates `{ nextCursor, prevCursor, hasMore }`.     |

The list response shape is `{ items: [User!]!, meta: ListMeta }` so a single query covers offset and cursor flows.

## Errors

Errors thrown by the Model layer are mapped to `GraphQLError` with an `extensions.code`:

| Error                                 | GraphQL extension `code` |
|---------------------------------------|--------------------------|
| `NotFoundError`                       | `NOT_FOUND`              |
| `ValidationError`                     | `VALIDATION_ERROR`       |
| `UnauthorizedError` (auth failure)    | `UNAUTHORIZED`           |
| Any other `NextModelError`            | `PERSISTENCE_ERROR`      |
| Anything else                         | _(no code set)_          |

The original error message is preserved on the `GraphQLError`; the `path` reflects the failing field (e.g. `["createUser"]`).

## See also

- `next-model-core` — the Model definition layer this package wraps.
- `next-model-express-rest-api` — REST adapter for Express servers.
- `next-model-nextjs-api` — REST adapter for Next.js route handlers.
