# @next-model/core

A typed, promise-based ORM for TypeScript. Declare models with a factory, chain scoped queries, manage associations, and plug in any storage via the `Connector` interface.

## Contents

- [Installation](#installation)
- [Defining a model](#defining-a-model)
  - [Factory options](#factory-options)
  - [Keys (primary key type)](#keys-primary-key-type)
  - [Named scopes](#named-scopes)
- [Creating records](#creating-records)
- [Saving and updating](#saving-and-updating)
- [Deleting](#deleting)
- [Querying](#querying)
  - [filterBy / orFilterBy](#filterby--orfilterby)
  - [orderBy / reorder / reverse / unordered](#orderby--reorder--reverse--unordered)
  - [limitBy / skipBy / unlimited / unskipped](#limitby--skipby--unlimited--unskipped)
  - [unfiltered / unscoped](#unfiltered--unscoped)
  - [Filter operators](#filter-operators)
- [Fetching](#fetching)
- [Aggregates & grouping](#aggregates--grouping)
- [Pagination](#pagination)
- [Batch iteration](#batch-iteration)
- [Dirty tracking](#dirty-tracking)
- [Serialization](#serialization)
- [Validators](#validators)
- [Lifecycle callbacks](#lifecycle-callbacks)
- [Timestamps](#timestamps)
- [Soft deletes](#soft-deletes)
- [Single Table Inheritance](#single-table-inheritance)
- [Associations](#associations)
- [Transactions](#transactions)
- [Connectors](#connectors)
- [Errors](#errors)
- [Changelog](#changelog)

## Installation

```sh
pnpm add @next-model/core
# or: npm install @next-model/core
```

`@next-model/core` ships with an in-memory `MemoryConnector` for development and tests. Production adapters (Knex, Data API) live in sibling packages.

## Defining a model

Models are defined via the `Model({...})` factory, which returns a class you can extend.

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

`init` is the one required callback. It defines the shape of the props accepted by `create`/`build` and returns the row that actually gets persisted — so you can coerce, default, or derive fields before they hit the connector.

### Factory options

```ts
Model({
  tableName: 'users',
  init: (props: UserProps) => props,
  connector,                    // defaults to an in-memory connector
  keys: { id: KeyType.number }, // or { id: KeyType.uuid }, or composite
  filter: { active: true },     // default scope
  order: { key: 'createdAt' },  // default sort
  limit: 25,                    // default limit
  skip: 0,                      // default offset
  timestamps: true,             // createdAt / updatedAt columns (default)
  softDelete: true,             // enables discard/restore against discardedAt
  validators: [ /* ... */ ],
  callbacks: { /* ... */ },
  scopes: { /* ... */ },
});
```

### Keys (primary key type)

```ts
Model({ ..., keys: { id: KeyType.number } });  // auto-incrementing integers (default)
Model({ ..., keys: { id: KeyType.uuid } });    // UUIDs generated on insert
```

Composite keys are allowed — any key in the `keys` dict is populated on insert and treated as read-only on the instance.

### Named scopes

Scopes defined in the factory are installed as typed class methods:

```ts
class User extends Model({
  tableName: 'users',
  init: (props: { firstName: string; gender: string; age: number }) => props,
  scopes: {
    males: (self) => self.filterBy({ gender: 'male' }),
    olderThan: (self, age: number) => self.filterBy({ $gt: { age } }),
  },
}) {}

await User.males().olderThan(18).all();
```

Scopes are pure functions of `(self, ...args)`; they compose naturally with any other chainable method.

## Creating records

```ts
const draft = User.build({ firstName: 'Jane', lastName: 'Roe' });
draft.isNew;         // true
draft.isPersistent;  // false
await draft.save();

const saved = await User.create({ firstName: 'Jane', lastName: 'Roe' });

const batch = await User.createMany([
  { firstName: 'Ada', lastName: 'Lovelace' },
  { firstName: 'Alan', lastName: 'Turing' },
]);
```

Scoped creates apply the current filter as defaults:

```ts
await User.filterBy({ gender: 'male' }).buildScoped({ firstName: 'Joe' });
await User.filterBy({ gender: 'female' }).createScoped({ firstName: 'Sally' });
```

## Saving and updating

```ts
user.assign({ firstName: 'Changed' });
await user.save();

await user.update({ lastName: 'Updated' });       // assign + save

await user.increment('loginCount');               // +1
await user.decrement('credits', 5);               // -5
await user.touch();                               // bump updatedAt only

await user.reload();                              // refetch from connector

await User.filterBy({ active: false }).updateAll({ active: true });
```

### upsert / upsertAll

Insert-or-update against a unique-key set (defaults to the primary key).

```ts
await Post.upsert({ id: 1, title: 'Hello' });
await Tag.upsert({ slug: 'js', name: 'JS' }, { onConflict: 'slug' });
await Slot.upsert(
  { tenantId: 1, key: 'home', value: 'new' },
  { onConflict: ['tenantId', 'key'] },
);

// Bulk: one SELECT to find existing, one batched INSERT for new rows,
// one UPDATE per match. Returns instances in input order.
await Post.upsertAll(
  [
    { id: 1, title: 'A2' },
    { id: 99, title: 'New' },
    { id: 2, title: 'B2' },
  ],
  { onConflict: 'id' },
);
```

> **Atomicity caveat.** Implemented at the Model layer over SELECT + INSERT/UPDATE primitives, so the operation is **not** atomic at the database level. Wrap calls in `Model.transaction(...)` if you need stronger guarantees.

## Deleting

```ts
await user.delete();                                       // single row
await User.filterBy({ active: false }).deleteAll();        // bulk
```

See [Soft deletes](#soft-deletes) for non-destructive variants.

<<<<<<< HEAD
### Cascade (dependent)

Declarative cleanup of child rows on parent delete. Each entry names a
`hasMany` or `hasOne` child Model (or a `() =>` thunk for circular imports),
the foreign key, and one of four actions:

| Action       | Behaviour |
|--------------|-----------|
| `'destroy'`  | Loads each child and calls `.delete()` (per-row callbacks fire; recursive cascades work) |
| `'deleteAll'`| One bulk DELETE via the connector — child callbacks **do not** fire |
| `'nullify'`  | Bulk update children's foreign-key column to `null` |
| `'restrict'` | Throws `PersistenceError` if any matching child exists; the parent is left intact |

```ts
const User = Model({
  // ...
  cascade: {
    posts:   { hasMany: Post,        foreignKey: 'userId', dependent: 'destroy' },
    profile: { hasOne:  Profile,     foreignKey: 'userId', dependent: 'nullify' },
    orders:  { hasMany: () => Order, foreignKey: 'userId', dependent: 'restrict' },
    audits:  { hasMany: Audit,       foreignKey: 'userId', dependent: 'deleteAll' },
  },
});
```

Cascades run before the parent's own delete. Models without `cascade` are unaffected.
=======
### Counter caches

Auto-maintain a count of child rows on the parent. The Model registers
`afterCreate` / `afterDelete` / `afterUpdate` hooks (the latter handles
foreign-key reassignment: −1 from the old parent, +1 to the new).

```ts
const Comment = Model({
  // ...
  counterCaches: [
    { belongsTo: Post,         foreignKey: 'postId', column: 'commentsCount' },
    // Lazy thunk for circular refs:
    // { belongsTo: () => Post, foreignKey: 'postId', column: 'commentsCount' },
  ],
});

await Comment.create({ postId: 1 });            // → Post#1.commentsCount += 1
await comment.delete();                          // → Post#1.commentsCount -= 1
comment.postId = 2; await comment.save();        // → Post#1 -=1, Post#2 +=1
```

Null foreign keys and missing parents are silent no-ops. Builds on the existing `instance.increment(column, by)` helper — no connector changes required.
>>>>>>> 03002f5 (Model: counterCaches factory option (auto-maintained counter columns))

## Querying

Every chainable method returns a new subclass, so scopes are immutable and safe to share.

### filterBy / orFilterBy

```ts
User.filterBy({ firstName: 'John' });
User.filterBy({ firstName: 'John', lastName: 'Doe' });             // AND
User.filterBy({ firstName: 'John' }).orFilterBy({ gender: 'male' });
User.filterBy({ $or: [{ firstName: 'John' }, { firstName: 'Jane' }] });
User.filterBy({ $not: { gender: 'male' } });
```

### orderBy / reorder / reverse / unordered

```ts
User.orderBy({ key: 'lastName' });
User.orderBy([{ key: 'lastName' }, { key: 'firstName', dir: SortDirection.Desc }]);
User.orderBy({ key: 'lastName' }).reverse();     // flip directions
User.reorder({ key: 'age' });                    // replace existing order
User.orderBy({ key: 'age' }).unordered();
```

`reverse()` flips the current order; with no order set, it falls back to descending primary key — which makes `Model.last()` reliable without configuration.

### limitBy / skipBy / unlimited / unskipped

```ts
await User.limitBy(10).all();
await User.skipBy(20).limitBy(10).all();
await User.limitBy(5).unlimited().count();
```

### unfiltered / unscoped

- `unfiltered()` clears only the filter.
- `unscoped()` clears filter, limit, skip, order, **and** the soft-delete scope.

```ts
await User.filterBy({ active: true }).unscoped().count();  // ignore every default
```

### Filter operators

All comparison keys start with `$`:

| Operator | Example |
|----------|---------|
| `$and`, `$or`, `$not` | `filterBy({ $or: [ {a: 1}, {b: 2} ] })` |
| `$in`, `$notIn` | `filterBy({ $in: { status: ['open', 'pending'] } })` |
| `$null`, `$notNull` | `filterBy({ $null: 'archivedAt' })` |
| `$between`, `$notBetween` | `filterBy({ $between: { age: { from: 18, to: 65 } } })` |
| `$gt`, `$gte`, `$lt`, `$lte` | `filterBy({ $gt: { age: 17 } })` |
| `$like` | `filterBy({ $like: { email: '%@example.com' } })` |
| `$async` | `filterBy({ $async: somePromiseResolvingToAFilter })` |
| `$raw` | connector-specific raw SQL + bindings |

## Fetching

```ts
await User.all();
await User.first();
await User.last();                                     // reverse + first

await User.find(42);                                   // by primary key, throws NotFoundError
await User.findBy({ email: 'x@y.com' });               // first matching or undefined
await User.findOrFail({ email: 'x@y.com' });           // throws NotFoundError
await User.findOrBuild({ email }, { firstName: 'J' }); // returns unsaved draft if missing

await User.firstOrCreate({ email }, { firstName: 'J' });
await User.updateOrCreate({ email }, { firstName: 'J' });

await User.exists();                                   // any row in scope?
await User.exists({ active: true });                   // any row matching this filter?

await User.ids();                                      // [1, 2, 3, …]
await User.pluck('email');                             // ['a@x', 'b@x', …]
await User.pluckUnique('country');                     // dedup, preserves first-seen order
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

All aggregates honor the current scope (filter, soft delete, etc.).

## Pagination

```ts
const page = await User.orderBy({ key: 'createdAt' }).paginate(1, 25);
// {
//   items: User[],
//   total: number,
//   page, perPage, totalPages,
//   hasNext, hasPrev,
// }
```

Counts run against the unlimited/unskipped scope but respect the active filter.

## Batch iteration

Memory-safe async iteration for large result sets:

```ts
for await (const batch of User.inBatchesOf(500)) {
  await processBatch(batch);
}

for await (const user of User.findEach()) {
  await sendEmail(user);
}
```

Both default to ordering by primary key if no order is set and honor any prior `limitBy`. `findEach` defaults to a batch size of 100.

## Dirty tracking

Before saving:

```ts
user.isChanged();                        // true if any pending change
user.isChangedBy('firstName');
user.changes();                          // { firstName: { from, to }, … }
user.revertChange('firstName');
user.revertChanges();
```

After saving — a snapshot of what the last `save()` persisted:

```ts
await user.update({ email: 'new@x.com' });
user.wasChanged();                       // true
user.wasChangedBy('email');
user.savedChanges();                     // { email: { from, to }, … }
user.savedChangeBy('email');
```

Use `savedChanges` inside `afterSave` / `afterUpdate` callbacks (or dynamic `Model.on` subscribers) to react to specific field transitions without re-reading the row.

## storeAccessors (JSON sub-attribute accessors)

Expose top-level instance accessors that proxy into a JSON column.
`user.theme = 'dark'` mutates `user.settings.theme`; reads pull the value
back out. Dirty tracking sees the JSON column as changed and `save()` ships
the merged blob through the connector.

```ts
const User = Model({
  // ...
  storeAccessors: {
    settings:    ['theme', 'locale', 'fontSize'],
    preferences: ['emailFreq', 'tz'],
  },
});

const u: any = await User.find(1);
u.theme;             // reads u.settings.theme
u.theme = 'light';   // writes u.settings = { ...current, theme: 'light' }
u.tz = 'UTC';        // initializes preferences if it was missing
await u.save();      // ships the merged JSON blob through the connector
```

Sub-keys that collide with an existing column or primary-key accessor on the
instance are skipped — the column accessor wins. Built on the connector-side
JSON serialization that `t.json(...)` columns already provide.

## Serialization

```ts
user.attributes();                       // { id, firstName, lastName, createdAt, updatedAt }
user.toJSON();                           // same shape; used by JSON.stringify
user.pick(['firstName', 'lastName']);
user.omit(['createdAt', 'updatedAt']);
```

## Validators

```ts
class User extends Model({
  tableName: 'users',
  init: (props: { email: string; age: number }) => props,
  validators: [
    (u) => u.email.includes('@'),
    async (u) => u.age >= 0,
  ],
}) {}

await new User({ email: 'bad', age: 10 }).isValid(); // false
await user.save();                                   // throws ValidationError if invalid
```

### Built-in validator factories

Eight Rails-style factories ship from `@next-model/core` for the common
constraints — drop them into the same `validators: [...]` array next to your
function-form validators.

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
    validateConfirmation('password'), // requires `passwordConfirmation` to match
  ],
});
```

Every factory accepts `{ message?, allowNull?, allowBlank?, if?, unless? }` for
the usual ergonomics. `validateUniqueness` runs through `Model.unscoped()` so
soft-deleted rows still count, excludes the current record by primary key on
updates, and supports `scope` (multi-column uniqueness).

### Errors collection

Every Model instance carries an `errors` collection populated by `isValid()`:

```ts
const u = User.build({});
await u.isValid();       // false — runs every validator (no short-circuit)
u.errors.on('email');    // ['cannot be blank']
u.errors.full();         // ['email cannot be blank', 'name cannot be blank']
u.errors.any();          // true
u.errors.count();        // 2
u.errors.toJSON();       // { email: [...], name: [...] }

try { await u.save(); }
catch (e) {
  e instanceof ValidationError;
  e.errors;              // same structured payload
}
```

## Lifecycle callbacks

Declare at factory time:

```ts
Model({
  ...,
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
```

Or subscribe dynamically at runtime — returns an unsubscribe function:

```ts
const unsubscribe = User.on('afterSave', (user) => {
  logger.info('user saved', user.savedChanges());
});

// later
unsubscribe();
```

Dynamic and factory-declared callbacks compose; factory-declared fire first in registration order.

## Timestamps

Enabled by default. `createdAt` is set on insert, `updatedAt` on every save. `touch()` updates `updatedAt` without any other changes. Opt out with `timestamps: false`, or pass your own values on insert to override.

## Soft deletes

Set `softDelete: true` to filter out discarded rows by default. The model looks for a `discardedAt` column.

```ts
class Post extends Model({
  tableName: 'posts',
  init: (props: { title: string; discardedAt?: Date | null }) => ({ discardedAt: null, ...props }),
  softDelete: true,
}) {}

const post = await Post.create({ title: 'Hello' });
await post.discard();           // sets discardedAt = now
post.isDiscarded();             // true

await Post.count();             // excludes discarded
await Post.withDiscarded().count(); // includes discarded
await Post.onlyDiscarded().all();   // only discarded

await post.restore();           // clears discardedAt
```

## Single Table Inheritance

Declare a base Model with `inheritColumn`, then create subclasses via
`Base.inherit({ type: '...' })`. Each subclass shares the base's table /
keys / connector / init, auto-fills the discriminator column on insert, and
auto-filters reads to its own type.

```ts
const Animal = Model({
  tableName: 'animals',
  keys: { id: KeyType.number },
  init: (p: { name?: string }) => ({ name: p.name ?? '' }),
  inheritColumn: 'type',
});

const Dog = Animal.inherit({ type: 'Dog' });
const Cat = Animal.inherit({
  type: 'Cat',
  validators: [(r) => /* cat-specific */ true],   // appended to base validators
});

await Dog.create({ name: 'Rex' });   // inserts row with type='Dog'

const rex = await Animal.find(1);    // returns a Dog instance
rex instanceof Dog;                  // true
rex instanceof Animal;               // true

await Dog.all();                     // only type='Dog' rows
await Animal.all();                  // mixed Dog / Cat / base instances
```

`Base.find(id)` and `Base.all()` inspect the discriminator column on each row
and return an instance of the registered subclass; rows whose type doesn't
match a registered subclass fall back to the base. Subclass filters / scopes
compose on top of the auto-type filter.

## Associations

Associations are defined as instance methods using the provided helpers. Each returns a scoped related class (for `hasMany` / `hasManyThrough`) or a `Promise<Related | undefined>` (for `belongsTo` / `hasOne`).

```ts
class User extends Model({ ... }) {
  posts() { return this.hasMany(Post); }
  profile() { return this.hasOne(Profile); }
  roles() { return this.hasManyThrough(Role, UserRole); }
}

class Post extends Model({ ... }) {
  author() { return this.belongsTo(User); }
}

const user = await User.find(1);
const posts = await user.posts().all();
const author = await post.author();
```

Polymorphic associations use a shared `{name}Id` + `{name}Type` pair:

```ts
class Comment extends Model({ ... }) {
  commentable() { return this.belongsTo(Post, { polymorphic: 'commentable' }); }
}

class Post extends Model({ ... }) {
  comments() { return this.hasMany(Comment, { polymorphic: 'commentable' }); }
}
```

Override the defaults via `foreignKey`, `primaryKey`, `typeKey`, `typeValue` as needed.

### Eager loading

Instance-level association helpers query lazily, which is fine for a single record but produces N+1 queries when iterating a collection. Use `preloadBelongsTo` / `preloadHasMany` on the related model to batch-load in a single query and look up per record:

```ts
// belongsTo: one parent per child
const posts = await Post.all();
const authorsByKey = await User.preloadBelongsTo(posts, { foreignKey: 'userId' });
for (const post of posts) {
  const author = authorsByKey.get(post.userId);
  // ...
}

// hasMany: many children per parent
const users = await User.all();
const postsByUser = await Post.preloadHasMany(users, { foreignKey: 'userId' });
for (const user of users) {
  const posts = postsByUser.get(user.id) ?? [];
  // ...
}
```

Both helpers accept an optional `primaryKey` for non-`id` parent keys. `preloadHasMany` pre-seeds empty buckets for every parent, so `.get(parent.id)` always returns an array.

## Transactions

```ts
await User.transaction(async () => {
  const user = await User.create({ ... });
  await Profile.create({ userId: user.id, ... });
  // if anything throws, all inserts/updates within this block roll back
});
```

Transactions are nestable (the inner block just runs within the outer). `MemoryConnector` snapshots storage on entry and restores it on throw.

## Connectors

Any object implementing the `Connector` interface works. The package ships with:

- `MemoryConnector` — in-memory storage for tests, local development, and quick scripts. Exported from the package root.

Writing your own is mostly a matter of mapping `Scope` to your driver's query builder. See `packages/knex-connector` or `packages/aurora-data-api-connector` for full examples.

## Errors

All errors extend `NextModelError` so you can catch them with a single check:

- `NextModelError` — base class
- `NotFoundError` — thrown by `find`, `findOrFail`, `save` (when update target vanished)
- `PersistenceError` — connector-level insert/update/delete failures, or actions on unsaved records
- `ValidationError` — thrown by `save` when any validator returns false
- `FilterError` — malformed filter expressions

## Changelog

See [HISTORY.md](HISTORY.md) for earlier releases.
