---
name: next-model-core
description: Core of `@next-model/core`, a typed promise-based ORM and Model factory for TypeScript. Trigger when the user wants to "define a model", build chainable queries with `filterBy`, set up a `MemoryConnector`, declare associations, write a schema DSL, attach validators, enable soft delete, or otherwise reach for an ORM API surface (`Model({...})`, `defineSchema`, `defineTable`, `unscoped`, `paginate`, `transaction`).
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# @next-model/core

`@next-model/core` is a typed, promise-based ORM for TypeScript. It exposes a `Model({...})` factory that returns a class you extend; instances support chainable scoped queries, validators, lifecycle callbacks, dirty tracking, timestamps, soft deletes, optimistic locking, counter caches, single table inheritance, polymorphic and through associations, eager loading, transactions, a schema DSL, and an in-memory `MemoryConnector` for tests / dev / browser. Production storage is plugged in through dedicated connector packages that implement the `Connector` interface; validator bridges live in their own packages too.

## When to use

- Defining a domain model layer (`class User extends Model({...})`) over any storage.
- Building chainable scopes (`filterBy`, `orderBy`, `limitBy`, `unscoped`, `defaultScope`).
- Declaring associations (`belongsTo`, `hasMany`, `hasOne`, `hasManyThrough`, polymorphic).
- Running tests / dev / browser code against the in-memory `MemoryConnector`.
- Authoring schemas with `defineSchema(...)` / `defineTable(...)` to share a single source of truth between Models, migrations, and generators.
- Writing validators, lifecycle callbacks, soft delete, timestamps, optimistic locking, counter caches, STI, enums.

## When not to use

- Production storage: reach for the dedicated connector skill (`next-model-knex-connector`, `next-model-postgres-connector`, `next-model-sqlite-connector`, `next-model-mysql-connector`, `next-model-mariadb-connector`, `next-model-redis-connector`, `next-model-valkey-connector`, `next-model-mongodb-connector`, `next-model-aurora-data-api-connector`, `next-model-local-storage-connector`).
- Schema migrations / reflection / generation: see `next-model-migrations`.
- Validator bridges (`zod`, `typebox`, `arktype`): see `next-model-zod`, `next-model-typebox`, `next-model-arktype`.
- Transport layers (REST / GraphQL / Next.js handlers): see `next-model-express-rest-api`, `next-model-graphql-api`, `next-model-nextjs-api`.
- React bindings: `next-model-react`.

## Install

```sh
pnpm add @next-model/core
# or: npm install @next-model/core
```

## Defining a model

Three idioms ship in the README.

### `init`-based (legacy)

```ts
import { Model, KeyType, SortDirection } from '@next-model/core';

class User extends Model({
  tableName: 'users',
  init: (props: { firstName: string; lastName: string; gender?: string }) => props,
}) {
  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
}

const user = await User.create({ firstName: 'John', lastName: 'Doe' });
user.id;     // auto-assigned number
user.name;   // 'John Doe'
```

### `defineSchema(...)` + connector

```ts
import { Model, defineSchema } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

const dbSchema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string' },
      name: { type: 'string' },
      age: { type: 'integer' },
      archivedAt: { type: 'timestamp', null: true },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      title: { type: 'string' },
    },
  },
});

const connector = new SqliteConnector(':memory:', { schema: dbSchema });

class User extends Model({ connector, tableName: 'users' }) {}
class Post extends Model({ connector, tableName: 'posts' }) {}
```

Column-kind → prop-type mapping: `string`/`text` → `string`; `integer`/`bigint`/`float`/`decimal` → `number`; `boolean` → `boolean`; `date`/`datetime`/`timestamp` → `Date`; `json` → `unknown`. `null: true` widens to `T | null`. Primary columns drive `keys` (string/text → `KeyType.uuid`, numeric → `KeyType.number`).

### `Model<Interface>({...})` (interface-generic props)

```ts
import { Model } from '@next-model/core';

interface UserProps {
  email: string;
  name: string;
  archivedAt: Date | null;
}

class User extends Model<UserProps>({
  tableName: 'users',
  // No init needed — defaults to identity. Props are typed via the generic.
}) {}
```

## Querying

Chainable, immutable, `PromiseLike` builders.

```ts
User.filterBy({ firstName: 'John' });
User.filterBy({ firstName: 'John', lastName: 'Doe' });             // AND
User.filterBy({ firstName: 'John' }).orFilterBy({ gender: 'male' });
User.filterBy({ $or: [{ firstName: 'John' }, { firstName: 'Jane' }] });
User.filterBy({ $not: { gender: 'male' } });

User.orderBy({ key: 'lastName' });
User.orderBy([{ key: 'lastName' }, { key: 'firstName', dir: SortDirection.Desc }]);
User.orderBy({ key: 'lastName' }).reverse();
User.reorder({ key: 'age' });

await User.limitBy(10).all();
await User.skipBy(20).limitBy(10).all();
await User.limitBy(5).unlimited().count();
```

- `unfiltered()` clears only the filter.
- `unscoped()` clears filter, limit, skip, order, the soft-delete scope, and the default scope.
- `defaultScope` sticks across the chain; remove only via `unscope('column', ...)` or `unscoped()`.

Operators: `$and`, `$or`, `$not`, `$in`, `$notIn`, `$null`, `$notNull`, `$between`, `$notBetween`, `$gt`, `$gte`, `$lt`, `$lte`, `$like`, `$async`, `$raw`.

```ts
filterBy({ $in: { status: ['open', 'pending'] } });
filterBy({ $null: 'archivedAt' });
filterBy({ $between: { age: { from: 18, to: 65 } } });
filterBy({ $like: { email: '%@example.com' } });
```

Subquery filter values — pass another query builder directly:

```ts
await Todo.filterBy({ userId: User.filterBy({ active: true }) });
const adminIds = User.filterBy({ role: 'admin' }).pluck('id');
await Todo.filterBy({ userId: { $in: adminIds } });
const itemTotal = OrderItem.filterBy({ orderId: 99 }).sum('amount');
await Order.filterBy({ total: { $gt: itemTotal } });
```

## Fetching

```ts
await User.all();
await User.first();
await User.last();
await User.find(42);
await User.findBy({ email: 'x@y.com' });
await User.findOrFail({ email: 'x@y.com' });
await User.findOrBuild({ email }, { firstName: 'J' });
await User.firstOrCreate({ email }, { firstName: 'J' });
await User.updateOrCreate({ email }, { firstName: 'J' });
await User.exists();
await User.exists({ active: true });
await User.ids();
await User.pluck('email');
await User.pluckUnique('country');
```

## Aggregates & grouping

```ts
await User.count();
await User.sum('credits');
await User.min('age');
await User.max('age');
await User.avg('age');

await User.countBy('country');          // Map<'US', 42 | 'DE', 18 | …>
await User.groupBy('country');          // Map<'US', User[] | …>
```

## Pagination

```ts
const page = await User.orderBy({ key: 'createdAt' }).paginate(1, 25);
// { items, total, page, perPage, totalPages, hasNext, hasPrev }
```

## Batch iteration

```ts
for await (const batch of User.inBatchesOf(500)) {
  await processBatch(batch);
}

for await (const user of User.findEach()) {
  await sendEmail(user);
}
```

## Validators

```ts
import {
  validatePresence,
  validateFormat,
  validateLength,
  validateInclusion,
  validateExclusion,
  validateNumericality,
  validateUniqueness,
  validateConfirmation,
} from '@next-model/core';

const User = Model({
  // ...
  validators: [
    validatePresence(['email', 'name']),
    validateFormat('email', { with: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ }),
    validateLength('name', { min: 3, max: 50 }),
    validateInclusion('role', ['admin', 'user', 'guest']),
    validateExclusion('username', ['admin', 'root']),
    validateNumericality('age', { integer: true, min: 0, max: 120 }),
    validateUniqueness('email', { caseSensitive: false }),
    validateConfirmation('password'),
  ],
});
```

Every factory accepts `{ message?, allowNull?, allowBlank?, if?, unless? }`. Each instance carries an `errors` collection populated by `isValid()`.

## Lifecycle callbacks

```ts
Model({
  callbacks: {
    beforeSave:   [ (record) => { /* ... */ } ],
    beforeCreate: [ /* ... */ ],
    beforeUpdate: [ /* ... */ ],
    afterCreate:  [ /* ... */ ],
    afterUpdate:  [ /* ... */ ],
    afterSave:    [ /* ... */ ],
    beforeDelete: [ /* ... */ ],
    afterDelete:  [ /* ... */ ],
  },
});

const unsubscribe = User.on('afterSave', (user) => {
  logger.info('user saved', user.savedChanges());
});
```

Extra events: `afterInitialize`, `afterFind`, `beforeValidation` / `afterValidation`, `aroundSave` / `aroundCreate` / `aroundUpdate` / `aroundDelete`, plus `afterCommit` / `afterRollback` (and the per-op `afterCreateCommit`, `afterUpdateCommit`, `afterDeleteCommit`, `afterCreateRollback`, `afterUpdateRollback`, `afterDeleteRollback`).

## Timestamps

Enabled by default. `createdAt` is set on insert, `updatedAt` on every save. `touch()` updates `updatedAt` without any other changes. Opt out with `timestamps: false`.

## Soft delete

```ts
class Post extends Model({
  tableName: 'posts',
  init: (props: { title: string; discardedAt?: Date | null }) => ({ discardedAt: null, ...props }),
  softDelete: true,
}) {}

const post = await Post.create({ title: 'Hello' });
await post.discard();
post.isDiscarded();

await Post.count();                  // excludes discarded
await Post.withDiscarded().count();
await Post.onlyDiscarded().all();

await post.restore();
```

## Associations

```ts
class User extends Model({
  tableName: 'users',
  init: (props: { name: string }) => props,
  associations: {
    posts:   { hasMany:   () => Post,    foreignKey: 'userId' },
    profile: { hasOne:    () => Profile, foreignKey: 'userId' },
    company: { belongsTo: () => Company, foreignKey: 'companyId' },
    roles:   { hasManyThrough: () => Role, through: () => UserRole },
  },
}) {}
```

Instance accessors return chainable builders, not eager promises:

```ts
const user = await User.find(1);
await user.posts;                               // Promise<Post[]>
await user.posts.filterBy({ status: 'open' });
await user.posts.count();
await user.company;                             // Promise<Company | undefined>
```

Eager-load with `Model.includes('posts', 'profile', { strategy: 'auto' })`. Cross-association `filterBy({ posts: { status: 'published' } })` and `whereMissing('posts')` consume `Connector.queryWithJoins` when available, fall back to subqueries otherwise.

## Transactions

```ts
await User.transaction(async () => {
  const user = await User.create({ ... });
  await Profile.create({ userId: user.id, ... });
  // if anything throws, all inserts/updates within this block roll back
});
```

Transactions are nestable; `MemoryConnector` snapshots storage on entry and restores it on throw. `afterCommit` / `afterRollback` (and the per-op variants) drain at the outermost boundary.

## Schema DSL

`defineTable(name, builder)`, `defineSchema({ table: { columns: {...} } })`, `defineAlter(...)`, `KeyType` (`number` / `uuid`), and the column kinds: `string`, `text`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `date`, `datetime`, `timestamp`, `json`.

```ts
import { defineTable, generateSchemaSource } from '@next-model/core';

const usersTable = defineTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('email', { null: false });
});
const source = generateSchemaSource([usersTable]);
```

## MemoryConnector

In-memory storage for tests, local development, browser, and quick scripts. Exported from `@next-model/core` (the default connector when no `connector:` is passed). Surface includes the full `Connector` contract plus a `storage` accessor and `clone()` helper for snapshotting and isolating stores between tests. Atomic by virtue of single-threaded JS; transactions snapshot storage on entry and restore on throw.

## Errors

All errors extend `NextModelError`:

- `NextModelError` — base class.
- `NotFoundError` (a.k.a. `RecordNotFoundError`) — thrown by `find`, `findOrFail`, `save` when the update target vanished.
- `PersistenceError` — connector-level insert/update/delete failures, or actions on unsaved records.
- `ValidationError` — thrown by `save` when any validator fails; carries the structured `errors` payload.
- `FilterError` — malformed filter expressions.
- `StaleObjectError` — optimistic locking conflict (`lockVersion` mismatch).
- `UnsupportedOperationError` — connector or feature does not implement the requested op.
- `IrreversibleMigrationError` — a migration declared no `down`.

## See also

- Connectors: `next-model-knex-connector`, `next-model-postgres-connector`, `next-model-sqlite-connector`, `next-model-mysql-connector`, `next-model-mariadb-connector`, `next-model-redis-connector`, `next-model-valkey-connector`, `next-model-mongodb-connector`, `next-model-aurora-data-api-connector`, `next-model-local-storage-connector`.
- Migrations + schema reflection / generation: `next-model-migrations`.
- Transport layers: `next-model-express-rest-api`, `next-model-graphql-api`, `next-model-nextjs-api`.
- Validator bridges: `next-model-zod`, `next-model-typebox`, `next-model-arktype`.
- React bindings: `next-model-react`.
