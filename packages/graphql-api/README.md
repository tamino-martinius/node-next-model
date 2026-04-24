# @next-model/graphql-api

Turn any `@next-model/core` `Model` into a GraphQL resource — typeDefs + resolvers for six default operations (`list`, `get`, `count`, `create`, `update`, `delete`) with per-operation authorization and per-row response mapping.

Runtime-agnostic: you get back `{ typeDefs, resolvers }` and plug them into whatever GraphQL server you already use (graphql-http, Apollo, Yoga, …).

```sh
pnpm add @next-model/graphql-api graphql @graphql-tools/schema
# or: npm install @next-model/graphql-api graphql @graphql-tools/schema
```

## Getting started

```ts
import { makeExecutableSchema } from '@graphql-tools/schema';
import { Model, SqliteConnector } from '@next-model/core';
import { buildModelResource, composeSchema } from '@next-model/graphql-api';

const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number; active: boolean }) => props,
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

Every resource contributes:

- `type User`, `input UserCreateInput`, `input UserUpdateInput`, `input UserFilterInput`, `input UserOrderInput`, `type UserList { items, meta }`.
- `Query.users`, `Query.user`, `Query.userCount`, `Mutation.createUser`, `Mutation.updateUser`, `Mutation.deleteUser`.

### Query arguments

| Argument             | Effect                                                                              |
|----------------------|-------------------------------------------------------------------------------------|
| `filter: UserFilterInput`  | Each field optional, compiled to `Model.filterBy({...})`.                    |
| `order: [UserOrderInput!]` | `{ key, dir: ASC|DESC }` entries composed left-to-right.                     |
| `limit`, `skip`            | Basic windowing.                                                             |
| `page`, `perPage`          | Offset pagination — `meta` populates `{ page, perPage, total, totalPages }`.  |
| `after`, `before`          | Cursor pagination — `meta` populates `{ nextCursor, prevCursor, hasMore }`.   |

## Per-operation authorization

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

Set an operation to `false` to omit it from the schema entirely (the field won't appear in the generated typeDefs).

## Response mapping

```ts
buildModelResource({
  Model: User,
  name: 'User',
  fields: {...},
  serialize: (row, ctx) => {
    const attrs = row.attributes() as Record<string, unknown>;
    const { passwordHash, ...safe } = attrs;
    return safe;
  },
});
```

`serialize` runs once per row for `list` / `get` / `create` / `update`.

## Error mapping

| Error                                 | GraphQL extension `code` |
|---------------------------------------|-------------------------|
| `NotFoundError`                       | `NOT_FOUND`             |
| `ValidationError`                     | `VALIDATION_ERROR`      |
| `UnauthorizedError` (auth failure)    | `UNAUTHORIZED`          |
| Any other `NextModelError`            | `PERSISTENCE_ERROR`     |
| Anything else                         | _(no code set)_         |
