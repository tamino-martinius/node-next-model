# @next-model/core

A typed, promise-based ORM for TypeScript. Declare models with a factory, chain scoped queries, manage associations, and plug in any storage via the `Connector` interface.

## Contents

- [Installation](#installation)
- [Defining a model](#defining-a-model)
  - [Schema-driven props](#schema-driven-props)
  - [Schema-first associations (recommended)](#schema-first-associations-recommended)
  - [Factory options](#factory-options)
  - [Keys (primary key type)](#keys-primary-key-type)
  - [Named scopes](#named-scopes)
- [Creating records](#creating-records)
- [Saving and updating](#saving-and-updating)
- [Deleting](#deleting)
- [Querying](#querying)
  - [filterBy / orFilterBy](#filterby--orfilterby)
  - [orderBy / withOrder / reverse / unordered](#orderby--withorder--reverse--unordered)
  - [limitBy / skipBy / unlimited / unskipped](#limitby--skipby--unlimited--unskipped)
  - [unfiltered / unscoped](#unfiltered--unscoped)
  - [Default scope](#default-scope)
  - [Filter operators](#filter-operators)
  - [Subquery filter values](#subquery-filter-values)
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
- [Enums](#enums)
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

Models are defined via the `Model({...})` factory, which returns a class you can extend. Every model requires a connector carrying a `defineSchema(...)` schema.

### Schema-driven props

Instead of writing an `init` callback to give TypeScript the row shape, declare a full database schema with `defineSchema(...)` and attach it to the connector. Each Model picks a table off the connector's schema by `tableName` — TypeScript infers the prop shape, `keys`, and `init` from the column map at the call site.

> **`defineSchema` vs `defineTable`.** These are two different APIs and the difference trips up first-time users. **`defineSchema(...)`** takes a record of plain `{ columns, associations? }` literals (column objects keyed by name) — the declarative shape shown below; this is what you want for typed Models. **`defineTable(name, callback)`** is an imperative builder used by `@next-model/migrations` (`t.string('email', { null: false })`, …) and is **not** valid inside the `defineSchema(...)` argument. If you see an error like `Property 'string' does not exist on type '{ ... }'` while filling in a schema, you've reached for `defineTable`'s builder by mistake — pass plain column literals instead.

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

const u = await User.create({
  email: 'a@b',
  name: 'Ada',
  age: 30,
  archivedAt: null,
});
// TypeScript knows: u.email is string, u.age is number, u.archivedAt is Date | null.
```

Column-kind → prop-type mapping:

- `'string'` / `'text'` → `string`
- `'integer'` / `'bigint'` / `'float'` / `'decimal'` → `number`
- `'boolean'` → `boolean`
- `'date'` / `'datetime'` / `'timestamp'` → `Date`
- `'json'` → `unknown`

Adding `null: true` widens any of the above to `T | null`. Primary columns drive the `keys` map: string / text primaries become `KeyType.uuid`, numeric primaries become `KeyType.number`. The fallback when no primary is declared is `{ id: KeyType.number }` — same as the legacy form.

`tableName` is statically constrained to keys of `dbSchema.tables`, so a typo like `tableName: 'unknwon'` is a TypeScript error at the Model definition site — and the runtime throws `Model(): tableName 'unknwon' is not declared on the attached schema. Known tables: users, posts` if you bypass the type system.

Each schema entry's `tableDefinitions[name]` is a runtime [`TableDefinition`](#schema-dsl) — the same shape `defineTable(...)` produces for `@next-model/migrations`. Tooling that consumes `TableDefinition` (schema snapshots, GraphQL / OpenAPI generators, admin UIs) can read the schema directly so there's a single source of truth for the table.

The returned schema is iterable for bootstrap-style code — read `Object.keys(schema.tableDefinitions)` (or `Object.entries(...)`) to walk every declared table without touching the type-level `tables` field:

```ts
const schema = defineSchema({
  users: { columns: { id: { type: 'integer', primary: true, autoIncrement: true } } },
  posts: { columns: { id: { type: 'integer', primary: true, autoIncrement: true } } },
});

for (const tableName of Object.keys(schema.tableDefinitions)) {
  console.log(tableName);
  // → 'users'
  // → 'posts'
}

for (const [tableName, table] of Object.entries(schema.tableDefinitions)) {
  console.log(tableName, table.columns.map((c) => c.name));
}
```

This is how `connector.ensureSchema()` and the schema-from-db generator walk a schema; the same pattern is useful for app boot diagnostics, fixture seeding, or feeding tables into a generic admin UI.

You can still pass an explicit `init` to coerce or derive fields, or override `keys`:

```ts
class User extends Model({
  connector,
  tableName: 'users',
  init: (p) => ({ ...p, email: p.email.toLowerCase() }),  // optional transformer
}) {}
```

### Schema-first associations (recommended)

Declare associations on the schema — strings reference sibling tables, so there's no circular import and no `() =>` thunk boilerplate. Pass the schema to your connector once; every Model bound to that connector picks it up. Accessors on the instance are fully typed against the target row shape.

```ts
// schema.ts — single source of truth
import { defineSchema } from '@next-model/core';

export const schema = defineSchema({
  users: {
    columns: {
      id:   { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
    associations: {
      tasks: { hasMany: 'tasks', foreignKey: 'userId' },
    },
  },
  tasks: {
    columns: {
      id:     { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      title:  { type: 'string' },
      done:   { type: 'boolean', default: false },
    },
    associations: {
      user: { belongsTo: 'users', foreignKey: 'userId' },
    },
  },
});

// connector.ts — the connector carries the schema; every Model bound to it inherits the typing.
import { MemoryConnector } from '@next-model/core';
import { schema } from './schema';
export const connector = new MemoryConnector({ storage: {} }, { schema });

// user.ts
import { Model } from '@next-model/core';
import { connector } from './connector';
export class User extends Model({ connector, tableName: 'users' }) {
  greet() { return `Hi, ${this.name}`; }
}

// task.ts
import { Model } from '@next-model/core';
import { connector } from './connector';
export class Task extends Model({ connector, tableName: 'tasks' }) {
  isOpen() { return !this.done; }
}

const ada = await User.create({ name: 'Ada' });    // `done` defaulted by schema on inserts
const t   = await Task.create({ userId: ada.id, title: 'walk' });

// Typed accessors — no thunks, no class refs in the schema:
const tasks = await ada.tasks.all();   // CollectionQuery<{ id, userId, title, done }[]>
const owner = await t.user;            // { id, name } | undefined

// Static-side helpers typed against association names — typos caught at compile time:
await User.includes('tasks').all();
await User.joins('tasks').filterBy({ tasks: { done: true } }).all();
```

#### `init` is optional

When you don't pass `init`, the Model derives one from the schema: each column's `default` is applied at `build()` / `create()` time, and `'currentTimestamp'` defaults become a fresh `Date`. Auto-incremented primary keys are left for the connector to assign. Pass an explicit `init` when you need a transformation:

```ts
class User extends Model({
  connector,
  tableName: 'users',
  init: (p) => ({ ...p, email: p.email.toLowerCase() }),
}) {}
```

#### Class instances on associations — `ModelRegistry`

By default `ada.tasks` returns `CollectionQuery<TaskRow[]>` — the row shape from the schema. To get `CollectionQuery<Task[]>` (your class with custom methods like `isOpen()`), augment the registry once. `import('...')` is type-only and erased at runtime, so this is cycle-free even when `user.ts` and `task.ts` reference each other:

```ts
// models/registry.ts (or any file imported once at app startup)
declare module '@next-model/core' {
  interface ModelRegistry {
    users: import('./user').User;
    tasks: import('./task').Task;
  }
}
```

After this block, `ada.tasks` is `CollectionQuery<Task[]>` and you can call `tasks[0].isOpen()`. Tables you don't register fall back to row shapes — register only what you need.

#### Per-association overrides (no registry)

If you want one association to return class instances without setting up the global registry, override that accessor on the class body. The class getter shadows the auto-accessor:

```ts
import { Task } from './task';

class User extends Model({ connector, tableName: 'users' }) {
  get tasks() {
    return this.hasMany(Task, { foreignKey: 'userId' });
  }
}
```

### Schema generation

You don't have to hand-write `defineSchema(...)` calls. Two pipelines emit them for you:

#### From migrations

`@next-model/migrations`' `Migrator` writes a typed-schema TS file after every successful `migrate()` run when the connector is wrapped in `SchemaCollector`:

```ts
import { Migrator, SchemaCollector } from '@next-model/migrations';
import { SqliteConnector } from '@next-model/sqlite-connector';

const collector = new SchemaCollector(new SqliteConnector(':memory:'));
const migrator = new Migrator({
  connector: collector,
  schemaOutputPath: './src/generated/schema.ts',
});

await migrator.migrate(allMigrations);
// → ./src/generated/schema.ts now contains a single multi-table schema:
//   export const schema = defineSchema({
//     users: { columns: {...} },
//     posts: { columns: {...} },
//   });
```

Import the generated `schema` and attach it to your connector — `new SqliteConnector(':memory:', { schema })` — then declare each Model with `Model({ connector, tableName: 'users' })`.

#### From a live database

`@next-model/migrations-generator`'s `schema-from-db` subcommand reflects the schema of any connector that implements `Connector.reflectSchema?()`:

```sh
npx nm-generate-migration schema-from-db \
  --connector ./db-connector.js \
  --output ./src/schema.ts
```

The connector module exports a default `Connector` instance (or a `connector` named export, or a factory). The CLI calls `connector.reflectSchema()` and writes the same single multi-table `defineSchema(...)` declaration as the migrator. Bundled support: `@next-model/sqlite-connector` (SQLite reflects via `PRAGMA table_info` + `PRAGMA index_list`); native Postgres / MySQL / MariaDB / Aurora ships in follow-up releases. Memory / Redis / Valkey / Mongo connectors do not implement `reflectSchema` (no canonical schema to reflect).

The runtime helper `generateSchemaSource(tables, options?)` is exported alongside `defineSchema` for ad-hoc emission:

```ts
import { defineTable, generateSchemaSource } from '@next-model/core';

const usersTable = defineTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('email', { null: false });
});
const source = generateSchemaSource([usersTable]);
// `source` is a parseable .ts module with `import { defineSchema } from
// '@next-model/core'` + `export const schema = defineSchema({ users: {...} });`.
```

Pass `{ exportName: 'mySchema' }` to override the binding name.

### Factory options

```ts
Model({
  connector,                          // required — must carry a defineSchema(...) schema
  tableName: 'users',
  init: (p) => ({ ...p, email: p.email.toLowerCase() }), // optional transformer
  keys: { id: KeyType.number },       // or { id: KeyType.uuid }, or composite (inferred from schema)
  filter: { active: true },           // initial chain filter (cleared by `unfiltered()`)
  defaultScope: { $null: 'deletedAt' }, // sticky filter — only `unscope` / `unscoped` removes it
  order: { key: 'createdAt' },        // default sort
  limit: 25,                          // default limit
  skip: 0,                            // default offset
  timestamps: true,                   // createdAt / updatedAt columns (default)
  softDelete: true,                   // enables discard/restore against discardedAt
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

`scopes` are the preferred shorthand for predeclared filters. Each entry is either a `Filter<any>` literal (no-arg method) or a `(...args) => Filter<any>` factory (args-forwarding method) — both call `filterBy(...)` under the hood. Use a static method on your subclass for multi-clause logic that doesn't fit a single `filterBy`:

```ts
class User extends Model({ connector, tableName: 'users',
  scopes: {
    males: { gender: 'male' },
    adults: { $gte: { age: 18 } },
    olderThan: (age: number) => ({ $gt: { age } }),
  },
}) {
  // Multi-step / multi-clause: declare a static method instead.
  static popularAdults(minAge: number) {
    return this.adults().olderThan(minAge).orderBy({ key: 'createdAt' });
  }
}

await User.males().adults().all();
await User.olderThan(18).all();
await User.popularAdults(21).all();
```

Scope methods produce a `CollectionQuery`, so they compose naturally with `filterBy` / `orderBy` / `limitBy` / etc.

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

### Property accessors for every schema column

Property getters / setters are installed for every column declared on the Model's schema — not just the columns supplied at `create({ ... })` time. So a `Model.create({ name: 'x' })` on a table that has a nullable `archivedAt` column produces an instance whose `archivedAt` getter exists from construction. A later `instance.update({ archivedAt: new Date() })` makes `instance.archivedAt` immediately readable without a re-fetch:

```ts
const item = await Item.create({ name: 'x' });    // archivedAt omitted
item.archivedAt;                                  // undefined (getter exists)
await item.update({ archivedAt: new Date() });
item.archivedAt;                                  // Date — no Model.findBy needed
```

Columns absent from the schema (legacy / dynamic) still fall through to the runtime `persistentProps` keys, preserving behaviour for callers that never went through `defineSchema(...)`.

## Saving and updating

```ts
user.assign({ firstName: 'Changed' });
await user.save();

await user.update({ lastName: 'Updated' });       // assign + save

await user.increment('loginCount');               // +1
await user.decrement('credits', 5);               // -5

// Class-level / chainable variants — return the affected row count.
// Routes through `Connector.deltaUpdate(spec)`, which every connector
// implements: SQL stores compile to `UPDATE col = col + N` in a single
// round-trip; Mongo uses `$inc`; Redis/Valkey queue `HINCRBY` per-row in
// `MULTI`; memory walks in-process. Race-free under concurrency on every
// connector with native single-statement support. `updatedAt` is bumped
// automatically when the model has timestamps. Validation and full save
// callbacks are skipped (matches Rails' `update_columns` semantics);
// `afterUpdate` / `afterUpdateCommit` still fire.
await User.filterBy({ id: 42 }).increment('loginCount');     // → 1 affected
await Post.filterBy({ trending: true }).decrement('rank', 1); // → N affected

await user.touch();                                // bump updatedAt only
await user.touch({ time: new Date('2099-01-01') });          // explicit time
await user.touch({ columns: ['updatedAt', 'lastSeenAt'] });   // multi-column
await user.touch({ time, columns: ['updatedAt', 'lastSeenAt'] });

await user.reload();                              // refetch from connector

await User.filterBy({ active: false }).updateAll({ active: true });
```

### Optimistic locking

Declare `lockVersion: true` (or pass a custom column name) and `save()` /
`delete()` enforce a version check on every mutation:

```ts
const Post = Model({
  // ...
  lockVersion: true,            // shorthand: column name `lockVersion`
  // OR
  lockVersion: 'lock_version',  // custom column name
});

const a = await Post.find(1);
const b = await Post.find(1);
a.title = 'A'; await a.save();   // OK; lockVersion 0 → 1
b.title = 'B'; await b.save();   // throws StaleObjectError
await b.reload();                 // refresh — lockVersion 1
b.title = 'B'; await b.save();   // OK; lockVersion 1 → 2
```

`StaleObjectError` is exported from `@next-model/core`. Inserts default the
column to 0 — declare the column in your migration / schema. Lives entirely
at the Model layer over the existing `updateAll` / `deleteAll` connector
primitives.

### upsert / upsertAll

Insert-or-update against a unique-key set (defaults to the primary key).

```ts
await Post.upsert({ id: 1, title: 'Hello' });
await Tag.upsert({ slug: 'js', name: 'JS' }, { onConflict: 'slug' });
await Slot.upsert(
  { tenantId: 1, key: 'home', value: 'new' },
  { onConflict: ['tenantId', 'key'] },
);

// Bulk: SQL connectors (pg / sqlite / mysql / mariadb) and MongoDB run
// the entire batch in a single atomic statement. Memory / LocalStorage
// also run atomically (single-threaded JS). Redis / Valkey compose the
// same semantics on top of their own primitives — non-atomic, but the
// Model API is identical. Returns instances in input order either way.
await Post.upsertAll(
  [
    { id: 1, title: 'A2' },
    { id: 99, title: 'New' },
    { id: 2, title: 'B2' },
  ],
  { onConflict: 'id' },
);

// Skip the update on conflict — keep the existing row untouched.
await Tag.upsert({ slug: 'js', name: 'IGNORED' }, { onConflict: 'slug', ignoreOnly: true });

// Restrict which columns get overwritten on conflict.
await Tag.upsert(
  { slug: 'js', name: 'JS', description: 'lang' },
  { onConflict: 'slug', updateColumns: ['description'] },
);
```

> **Atomicity.** Every bundled SQL connector (pg / sqlite / mysql /
> mariadb / aurora-data-api) and MongoDB run upsert as a single atomic
> statement (`INSERT … ON CONFLICT … DO UPDATE`, `ON DUPLICATE KEY
> UPDATE`, or `bulkWrite` with `upsert: true`); concurrent callers can
> never observe a duplicate insert. `MemoryConnector` and
> `LocalStorageConnector` are atomic by virtue of single-threaded JS.
> Redis / Valkey compose the same semantics from their own primitives
> (SELECT-then-INSERT-or-UPDATE) — **non-atomic** by Redis design; wrap
> Redis upserts in `Model.transaction(...)` for the snapshot/rollback
> safety net.
>
> **Callbacks & validators.** Mirroring Rails' `upsert` / `upsert_all`,
> the upsert path **skips per-row lifecycle callbacks and validators** on
> every connector — there is no instance to run hooks against when the
> work happens in a single connector call. Use `Model.create` /
> `record.update` (or wrap in `Model.transaction(...)`) when callbacks
> must run.

## Deleting

```ts
await user.delete();                                       // single row
await User.filterBy({ active: false }).deleteAll();        // bulk
await User.destroyAll();                                    // per-row .delete() — callbacks fire
```

`delete()` accepts `{ skipCallbacks: true }` to suppress `beforeDelete` /
`afterDelete` (matches Rails' `record.delete` vs `record.destroy` distinction).
`destroyAll()` is the chainable counterpart to `deleteAll()` that loads each
row and calls `.delete()` so per-row callbacks + cascade fire.

```ts
await record.delete({ skipCallbacks: true });               // skip per-row hooks
await User.filterBy({ active: false }).destroyAll();         // load + delete each
```

See [Soft deletes](#soft-deletes) for non-destructive variants.

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

Null foreign keys and missing parents are silent no-ops.

Routes through `Connector.deltaUpdate` (every native
connector other than the in-memory ones — postgres, mysql, mariadb, sqlite,
aurora-data-api, knex, mongodb, redis, valkey — plus the in-process memory
connectors which are race-free under JS's single-threaded execution), the
counter increment is a single atomic round-trip (`UPDATE posts SET
comments_count = comments_count + 1 WHERE id = ?` on SQL, `$inc` on Mongo,
`HINCRBY` on Redis / Valkey). 1 000 concurrent `Comment.create` calls land
the correct final count — no lost updates.

## Querying

Every chainable method returns a new query builder, so scopes are immutable and safe to share. Builders are `PromiseLike`, so `await` resolves them directly — `.all()` is optional when you just want the rows:

```ts
// These are equivalent — `await` on a CollectionQuery materializes the rows.
const todos = await Todo.filterBy({ active: true });
const todos = await Todo.filterBy({ active: true }).all();

// `findBy(...)` / `find(id)` / `first()` / `last()` resolve to a single instance.
const user = await User.findBy({ email: 'a@b.com' });
const user = await User.find(1);

// Aggregates resolve to a scalar.
const total = await User.filterBy({ active: true }).count();
```

> **Bare-class invariant.** `Todo` itself is not thenable — `await Todo` does not fetch. You always need at least one chainable method (`.all()`, `.first()`, `.find(id)`, `.filterBy(...)`, …) before the chain becomes awaitable.

### filterBy / orFilterBy

```ts
User.filterBy({ firstName: 'John' });
User.filterBy({ firstName: 'John', lastName: 'Doe' });             // AND
User.filterBy({ firstName: 'John' }).orFilterBy({ gender: 'male' });
User.filterBy({ $or: [{ firstName: 'John' }, { firstName: 'Jane' }] });
User.filterBy({ $not: { gender: 'male' } });
```

### orderBy / withOrder / reverse / unordered

```ts
User.orderBy({ key: 'lastName' });
User.orderBy([{ key: 'lastName' }, { key: 'firstName', dir: SortDirection.Desc }]);
User.orderBy({ key: 'lastName' }).reverse();     // flip directions
User.withOrder({ key: 'age' });                  // replace existing order
User.orderBy({ key: 'age' }).unordered();

// Conventional ORM shape works too — normalised inside the connector:
User.orderBy({ lastName: 'asc' });
User.orderBy([{ lastName: 'asc' }, { firstName: 'desc' }]);
```

> **`reorder()` is deprecated.** Earlier releases exposed `reorder(order)` as the "replace ORDER BY" chainable, which shadowed user-facing static methods on subclasses (`Item.reorder([…])` for "reorder these items by sortOrder"). Use `withOrder(order)` instead — it does exactly the same thing. `reorder()` still works as a deprecated alias and emits a one-shot `console.warn` per process.

`reverse()` flips the current order; with no order set, it falls back to descending primary key — which makes `Model.last()` reliable without configuration.

`orderBy` accepts either the strict `{ key, dir }` shape (with `dir` as either the `SortDirection` enum or the strings `'asc'` / `'desc'`) or the conventional single-key `{ [col]: 'asc' | 'desc' }` shape. Both are normalised before being passed to the connector — no more silent `ORDER BY "undefined"` SQL when the loose shape sneaks past the type checker.

### limitBy / skipBy / unlimited / unskipped

```ts
await User.limitBy(10).all();
await User.skipBy(20).limitBy(10).all();
await User.limitBy(5).unlimited().count();
```

### unfiltered / unscoped

- `unfiltered()` clears only the filter.
- `unscoped()` clears filter, limit, skip, order, the soft-delete scope, **and** the default scope.

```ts
await User.filterBy({ active: true }).unscoped().count();  // ignore every default
```

### Default scope

The `defaultScope` factory option declares a sticky filter that's merged into
every chained read on the Model — `Post.all()`, `Post.count()`,
`Post.filterBy({...})`, terminals like `find` / `findBy`, and the deferred
`pluck` / `select` paths all see it. It composes as AND with anything else the
chain adds.

Unlike the `filter` factory option (which is the chain's initial state and
therefore cleared by `unfiltered()`), `defaultScope` is applied at materialise
time regardless of what the chain did with `filter`. Only two methods remove
it:

- `Model.unscope('column', ...)` — drops the listed columns from the default
  scope for this builder, leaving the rest intact (and leaving the chain's
  regular `filter`, `order`, `limit`, etc. untouched).
- `Model.unscoped()` — clears the filter / order / limit / skip / soft-delete
  scope alongside the default scope (the existing "give me everything" escape
  hatch, now extended to cover `defaultScope` too).

```ts
class Post extends Model({
  connector,
  tableName: 'posts',
  defaultScope: { $and: [{ $null: 'archivedAt' }, { published: true }] },
}) {}

await Post.all();                        // archivedAt IS NULL AND published = true
await Post.count();                      // same scope
await Post.filterBy({ title: 'Hi' });    // + AND title = 'Hi'

await Post.unfiltered().all();           // defaultScope still applies
await Post.unscope('archivedAt').all();  // published = true (no archivedAt clause)
await Post.unscope('archivedAt', 'published').all(); // both clauses dropped
await Post.unscoped().all();             // every default cleared, including defaultScope
```

`unscope` walks the scope recursively: it drops column-keyed clauses
(`{ active: true }`), `$null` / `$notNull` whose value is the column name,
and entries inside column-value-map operators (`$gt`, `$in`, `$between`,
`$like`, etc.); empty `$and` / `$or` arms collapse away; `$raw` / `$async`
opaque payloads pass through untouched.

### Query helpers

Four small Rails-parity additions to the chainable API:

- `Model.merge(otherScope)` — AND-combines filters; the merged scope's `order` (when set) replaces and `limit` / `skip` (when set) override the receiver's.
- `Model.none()` — returns a chainable scope that resolves to zero rows without hitting the connector. Implemented by swapping in a `NullConnector`, so writes silently no-op too.
- `Model.having(predicate)` — post-filter the `countBy(...)` result map. Accepts a function `(count: number) => boolean` or a comparison object `{ count: { $eq | $gt | $gte | $lt | $lte: number } }`.
- `Model.pluck(...keys)` — multi-column variant returns `Array<[A, B, ...]>` tuples in the requested order. Single-column callers keep the existing flat-array shape.

```ts
// merge
const recent = Post.orderBy({ key: 'createdAt', dir: SortDirection.Desc }).limitBy(10);
await Post.filterBy({ status: 'published' }).merge(recent).all();

// none — zero connector calls
const scope = user.banned ? Post.none() : Post.filterBy({ userId: user.id });
await scope.all();

// having
await Post.having({ count: { $gt: 5 } }).countBy('userId');

// multi-column pluck
await Post.pluck('id', 'title');                       // [[1, 'A'], [2, 'B'], ...]
```

### whereMissing

Filter to parents that have no matching child rows — Rails'
`User.where.missing(:posts)`. Pass the name of a declared `hasMany` /
`hasOne` association (see [Associations](#associations) for how to declare
them):

```ts
await User
  .whereMissing('posts')
  .filterBy({ active: true });

// hasOne associations work the same way:
await User.whereMissing('profile');
```

Multiple `whereMissing` calls AND together. Connectors that implement
`Connector.queryWithJoins` (Knex / native pg / sqlite / mysql / mariadb /
Aurora Data API) emit a single `WHERE NOT EXISTS (...)` on the parent
query. Memory / Redis / Valkey / Mongo / LocalStorage fall back to a
`pluckUnique` subquery + `$notIn` filter. See
[Joins and JOIN-capable connectors](#joins-and-join-capable-connectors)
for the full surface.

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
| `$raw` | connector-specific raw SQL + bindings (SQL connectors); predicate function `(item, ...bindings) => boolean` on JS-evaluating connectors |

#### Two equivalent shapes per column operator

Every column-style operator (`$in`, `$notIn`, `$gt`, `$gte`, `$lt`, `$lte`, `$like`, `$between`, `$notBetween`, `$not`) accepts both the nested ORM-style form and the legacy top-level form. The two compile to the same query:

```ts
// Nested form (matches the shape most popular ORMs use).
User.filterBy({ age: { $gt: 18 } });
User.filterBy({ status: { $in: ['open', 'pending'] } });

// Top-level form (equivalent).
User.filterBy({ $gt: { age: 18 } });
User.filterBy({ $in: { status: ['open', 'pending'] } });
```

#### Mixed-object filters compose with AND

A single filter object can mix plain column equality with top-level operator keys and composition ops (`$and`, `$or`). Every entry is ANDed together; you don't need to chain `.filterBy(...).filterBy(...)` to keep them all alive:

```ts
// All three predicates apply.
await User.filterBy({
  workspaceId: 1,             // equality
  $null: 'archivedAt',        // top-level operator
  age: { $gt: 18 },           // column-op map (rewritten internally)
}).all();
```

Without this composition step, the connector's `compileFilter` short-circuits on the first `$`-prefixed key it sees and silently drops the rest — `normalizeFilterShape` wraps mixed shapes in `$and` so every predicate survives.

### Subquery filter values

Any query builder can be passed as a filter value — the parent query
embeds it as a correlated subquery, with the connector emitting `IN (...)`
or splicing the resolved value as appropriate. No need to `await` first.

```ts
// CollectionQuery / InstanceQuery as filter value — correlated subquery
// on the related table's primary key (or `pluck(...)` column).
await Todo.filterBy({
  userId: User.filterBy({ active: true }),
});

// ColumnQuery (from `.pluck(...)`) — uses the projected column directly.
const adminIds = User.filterBy({ role: 'admin' }).pluck('id');
await Todo.filterBy({ userId: { $in: adminIds } });

// ScalarQuery (from `.sum(...)` / `.count()` / `.min(...)` / etc.) —
// resolved eagerly when used as a top-level value, or spliced inside
// an operator like `$gt` so `total > SUM(items.amount)` works directly.
const itemTotal = OrderItem.filterBy({ orderId: 99 }).sum('amount');
await Order.filterBy({ total: { $gt: itemTotal } });
```

Subquery values compose inside `$and` / `$or` / `$not` arms too — the
extraction descends into nested filter trees so the same shapes work
everywhere a literal would.

## Fetching

```ts
await User.all();
await User.first();
await User.last();                                     // reverse + first

await User.find(42);                                   // by primary key, throws NotFoundError
await User.findOrNull(42);                             // by primary key, returns null on miss
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
user.changeBy('firstName');              // { from, to } | undefined
user.was('firstName');                   // prior value (or current if unchanged) — Rails' <attr>_was
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
user.savedWas('email');                  // value before the last save — Rails' attribute_before_last_save
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
user.attributes;                         // { id, firstName, lastName, createdAt, updatedAt }
user.toJSON();                           // same shape; used by JSON.stringify
user.pick(['firstName', 'lastName']);
user.omit(['createdAt', 'updatedAt']);
```

### Structured clone / IPC

Column accessors on Model instances are installed as **enumerable** own properties, so a raw instance survives the structured clone algorithm (Electron IPC, Web Workers, `BroadcastChannel`, `postMessage`) with its column values at the top level:

```ts
const user = await User.findBy({ isDefault: true });
const clone = structuredClone(user);
clone.id;        // ✓ readable on the clone
clone.firstName; // ✓ readable on the clone
```

Two caveats when crossing the boundary:

1. **`@next-model/react` Proxies are not cloneable.** The hook layer (`useModel`, `useWatch`, `useAsyncTerminal`) wraps row instances in a `Proxy` for reactivity. `Proxy` is unconditionally non-cloneable in V8 / Chromium — `structuredClone(proxy)` and `port.postMessage(proxy)` both throw `DataCloneError: ... could not be cloned`. Extract a plain object with `instance.toJSON()` or `instance.attributes` before handing it to `ipcRenderer.invoke(...)` / `worker.postMessage(...)`:

   ```ts
   // ❌ throws "An object could not be cloned" when `user` is wrapped
   await ipcRenderer.invoke('something', { user });

   // ✓ works regardless of whether `user` is wrapped or raw
   await ipcRenderer.invoke('something', { user: user.toJSON() });
   ```

   `.toJSON()` works on both wrapped and raw instances (the Proxy forwards the call to its target), so it's the safest single pattern.

2. **Clone keeps the internal bookkeeping fields.** A cloned raw instance carries the column values *and* the `persistentProps` / `changedProps` / `lastSavedChanges` / `keys` shadows. Consumers that want only the wire-shape columns should use `.toJSON()` (or `JSON.parse(JSON.stringify(instance))` when datetime columns need to round-trip to ISO strings).

## Attribute boundary helpers

### normalizes

Run a normalizer function whenever a column is written through `assign(...)`
(which covers direct setters, `update(...)`, and round-trips through the
property accessor). Useful for trimming whitespace, lowercasing emails,
stripping non-digits from phone numbers, etc.

```ts
const User = Model({
  // ...
  normalizes: {
    email: (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    phone: (v) => (typeof v === 'string' ? v.replace(/\D/g, '') : v),
  },
});

const u: any = User.build({});
u.email = '  Foo@BAR.com\n';   // → 'foo@bar.com'
u.phone = '+1 (555) 123-4567';  // → '15551234567'
```

### secureTokens

Auto-fill a column with a URL-safe random base64url token on insert, when
the value is blank. Default length is 24 bytes (32-character output).
Explicit values are preserved.

```ts
const Invite = Model({
  // ...
  secureTokens: ['token'],
  // OR with options:
  // secureTokens: { token: { length: 32 } },
});

const invite = await Invite.create({});
invite.token;   // 'r4nd0m_url_s4f3_token_string'
```

The underlying primitive is exported as `generateSecureToken(length?)` for
ad-hoc use. Uses Web Crypto (`globalThis.crypto.getRandomValues`) so it
stays browser-bundle-safe.

## Validators

```ts
class User extends Model({
  connector,
  tableName: 'users',
  validators: [
    (u) => u.email.includes('@'),
    async (u) => u.age >= 0,
  ],
}) {}

await new User({ email: 'bad', age: 10 }).isValid(); // false
await user.save();                                   // throws ValidationError if invalid
```

> **`validators` is a flat array, not a per-field map.** Every factory takes the column name (or list of column names) as its first argument and returns a single validator function. Drop them all into `validators: [...]` side-by-side — there is no `validators: { email: [...] }` shape. Multiple column-scoped factories can target the same column.
>
> ```ts
> validators: [
>   validatePresence(['email', 'name']),         // flat array, not per-field map
>   validateFormat('email', { with: /…/ }),
>   validateLength('name', { min: 3, max: 50 }),
> ],
> ```

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

### Extended lifecycle events

In addition to the eight `before*` / `after*` save / create / update / delete
hooks, the following events are available:

| Event | Fires |
|-------|-------|
| `afterInitialize` | After every record is constructed (`build`, hydration). Sync — async returns are fire-and-forget. |
| `afterFind` | After hydration only (`all` / `first` / `last` / `find` / `findBy`). |
| `beforeValidation` / `afterValidation` | Wrap every `isValid()` call (including the implicit one inside `save()`). |
| `aroundSave` / `aroundCreate` / `aroundUpdate` / `aroundDelete` | Middleware-style hooks: `(record, next) => Promise<void>`. Compose LIFO. Skip `next()` to abort the operation. |

```ts
Post.on('aroundSave', async (record, next) => {
  const start = Date.now();
  await next();
  metrics.timing('post.save', Date.now() - start);
});

Post.on('beforeValidation', (post) => {
  post.email = post.email?.trim();
});
```

Use `Model.skipCallbacks(events, fn)` to temporarily suppress a list of
events for the duration of a block — handlers are restored in `finally`.

```ts
await Post.skipCallbacks(['afterCreate', 'afterSave'], async () => {
  await Post.create({ ... });   // those events do not fire
});
```

## Timestamps

`createdAt` is set on insert, `updatedAt` on every save. `touch()` updates `updatedAt` without any other changes.

The `timestamps:` option is inferred from the schema's column declarations when you don't pass it explicitly:

- Schema declares both `createdAt` + `updatedAt` → enable both (matches the historical default).
- Schema declares only `createdAt` → behaves as `{ updatedAt: false }`.
- Schema declares only `updatedAt` → behaves as `{ createdAt: false }`.
- Schema declares neither → behaves as `timestamps: false`.

This means a plumbing table (sessions, ad-hoc lookups, …) that does not declare timestamp columns no longer fails inserts with `SqliteError: table X has no column named createdAt`. Explicit `timestamps:` always wins — pass `timestamps: false`, `timestamps: true`, or `timestamps: { createdAt: 'inserted_at', updatedAt: false }` to override inference. Pass your own values on insert to override individual rows.

## Soft deletes

Set `softDelete: true` to filter out discarded rows by default. The model looks for a `discardedAt` column.

```ts
class Post extends Model({
  connector,
  tableName: 'posts',
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

## Enums

Typed enum columns with auto-generated scopes and predicates:

```ts
const Post = Model({
  // ...
  enums: {
    status: ['draft', 'published', 'archived'] as const,
    visibility: ['public', 'private'] as const,
  },
});

// One chainable class scope per value — composes with .filterBy / .orderBy / etc.
await Post.draft().all();
await Post.published().filterBy({ visibility: 'public' }).all();

// One instance predicate per value:
post.isDraft();        // boolean
post.isPublished();

// Snake_case values map to camelCase scopes / PascalCase predicates:
//   'in_review' → Item.inReview() / item.isInReview()

// Reflect the value list:
Post.statusValues;     // ['draft', 'published', 'archived']
```

Values that would collide with existing static / prototype methods throw
at factory construction. A built-in validator rejects out-of-range values
at `isValid()` / `save()` time. The `camelize` / `pascalize` helpers used
internally are exported for ad-hoc use.

## Single Table Inheritance

Declare a base Model with `inheritColumn`, then create subclasses via
`Base.inherit({ type: '...' })`. Each subclass shares the base's table /
keys / connector / init, auto-fills the discriminator column on insert, and
auto-filters reads to its own type.

```ts
const Animal = Model({
  connector,
  tableName: 'animals',
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

Declare associations on the schema (see [Schema-first associations](#schema-first-associations-recommended)) — each entry names a `belongsTo`, `hasMany`, or `hasOne` with a string table reference plus the foreign-key column. Each declared name installs a chainable instance accessor and unlocks the JOIN-shaped chainables (`joins(...)`, `whereMissing(...)`, `includes(...)`, cross-association `filterBy({ <name>: {...} })`).

```ts
// schema.ts — declare once, every Model bound to this connector inherits the associations.
export const schema = defineSchema({
  users: {
    columns: { id: { type: 'integer', primary: true, autoIncrement: true }, name: { type: 'string' } },
    associations: {
      posts:   { hasMany:   'posts',   foreignKey: 'userId' },
      profile: { hasOne:    'profiles', foreignKey: 'userId' },
      company: { belongsTo: 'companies', foreignKey: 'companyId' },
    },
  },
  posts: {
    columns: { id: { type: 'integer', primary: true, autoIncrement: true }, userId: { type: 'integer' }, title: { type: 'string' } },
    associations: {
      author: { belongsTo: 'users', foreignKey: 'userId' },
    },
  },
  // ... profiles, companies
});

class User extends Model({ connector, tableName: 'users' }) {}
class Post extends Model({ connector, tableName: 'posts' }) {}
```

Instance accessors return chainable query builders, not eager promises —
so you can keep refining the chain before resolving:

```ts
const user = await User.find(1);

// hasMany / hasManyThrough → CollectionQuery (PromiseLike).
await user.posts;                               // Promise<Post[]>
await user.posts.filterBy({ status: 'open' }); // chain further
await user.posts.count();                       // aggregate

// belongsTo / hasOne → InstanceQuery (PromiseLike).
await user.company;                             // Promise<Company | undefined>
await user.profile;                             // Promise<Profile | undefined>
```

Static-side traversal works the same way — `.findBy(...)` returns an
InstanceQuery, so the parent-scope chain reads naturally end-to-end:

```ts
// Resolve a user, then filter their open todos — single chain, no await
// in the middle.
const openTodos = await User
  .findBy({ email: 'a@b.com' })
  .todos
  .filterBy({ status: 'open' });

// Two-hop belongsTo chain.
const street = (await Order.first().customer.address)?.street;
```

Polymorphic associations share a `{name}Id` + `{name}Type` pair — declare
the `polymorphic` shorthand on each side in the schema:

```ts
export const schema = defineSchema({
  comments: {
    columns: { /* ... */ },
    associations: {
      commentable: { belongsTo: 'posts', polymorphic: 'commentable' },
    },
  },
  posts: {
    columns: { /* ... */ },
    associations: {
      comments: { hasMany: 'comments', polymorphic: 'commentable' },
    },
  },
});
```

Override the defaults via `foreignKey`, `primaryKey`, `typeKey`,
`typeValue` as needed. Association names that collide with primary-key
columns, `storeAccessors` sub-keys, enum predicates, or built-in instance
methods throw at factory construction so problems surface immediately.

### Eager loading

Instance accessors query lazily, which is fine for a single record but
produces N+1 queries when iterating a collection.

#### `Model.includes(...names)`

Pass the names of declared associations to preload them alongside the main
fetch — one batched query per association, no N+1. The resolved values
overwrite the lazy chainable accessors on every returned instance.

```ts
const posts = await Post.includes('user', 'comments', 'cover');

posts[0].user;      // User instance — pre-loaded, no extra query
posts[0].comments;  // Comment[]    — pre-loaded
posts[0].cover;     // Image | undefined
```

Without `includes(...)`, the instance accessors (`post.user`,
`post.comments`, `post.cover`) keep returning chainable query builders —
the lazy path. `includes(...)` is the explicit opt-in to eager-load.

`Model.includes('posts', 'profile', { strategy: 'auto' })` accepts a final
`{ strategy: 'preload' | 'join' | 'auto' }` option — `'preload'` (default)
runs one batched query per association; `'join'` requires
`Connector.queryWithJoins`; `'auto'` picks the right one. See
[Joins and JOIN-capable connectors](#joins-and-join-capable-connectors).

Consecutive `includes(...)` calls merge. `Model.withoutIncludes()` clears
the chain; `unscoped()` clears the includes map alongside everything else
it already clears.

#### Lower-level: `preloadBelongsTo` / `preloadHasMany`

When you need the lookup map directly (instead of attaching properties to
instances), use the connector-level primitives the chainable is built on:

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

<a id="join-strategy-followup"></a>
<a id="joins-and-join-capable-connectors"></a>

### Joins and JOIN-capable connectors

`Model.joins(...names)`, `Model.whereMissing(name)`,
`Model.includes(...names, { strategy })`, and cross-association
`filterBy({ <assocName>: {...} })` all consume the declared
associations and collect JOINs in a `pendingJoins` queue on the chain.
At terminal time:

- Connectors that implement `Connector.queryWithJoins` (Knex / native
  sqlite / postgres / mysql / mariadb / Aurora Data API) consume the whole
  queue in one `Connector.queryWithJoins({ parent, joins })` call —
  `'select'` clauses become `WHERE EXISTS (...)`, `'antiJoin'` becomes
  `WHERE NOT EXISTS (...)`, and `'includes'` clauses batch-fetch children
  and attach them under `record.<name>`.
- Every other connector (Memory / Redis / Valkey / Mongo / LocalStorage)
  falls back to a subquery: the parent's scope picks up
  `{ $in | $notIn: { [parentColumn]: [...child keys...] } }` and includes
  go through the existing `preloadBelongsTo` / `preloadHasMany` primitives.
  `$async` is fully resolved at the Model layer, so connectors that
  reject `$async` keep working transparently.

```ts
// INNER JOIN — keep parents that have at least one matching child.
await User.joins('posts');

// LEFT JOIN ... WHERE NOT EXISTS — Rails' `where.missing(:posts)`.
await User.whereMissing('posts').filterBy({ active: true });

// Cross-association filterBy — auto-promotes to INNER JOIN with the
// child filter applied. Equivalent to Rails'
// `User.where(posts: { status: 'published' })`.
await User.filterBy({ posts: { status: 'published' } } as any);

// Eager-load posts (and any other associations).
await User.includes('posts');
await User.includes('posts', 'profile', { strategy: 'auto' });
```

`includes` accepts `{ strategy: 'preload' | 'join' | 'auto' }`:
`'preload'` (default) is the existing one-batched-query-per-association
behaviour. `'join'` requires `queryWithJoins` and throws otherwise.
`'auto'` picks `'join'` when supported, `'preload'` when not — a safe
default for libraries that don't know which connector they'll run against.

## Transactions

```ts
await User.transaction(async () => {
  const user = await User.create({ ... });
  await Profile.create({ userId: user.id, ... });
  // if anything throws, all inserts/updates within this block roll back
});
```

Transactions are nestable (the inner block just runs within the outer). `MemoryConnector` snapshots storage on entry and restores it on throw.

### Transactional callbacks

Inside `Model.transaction(...)`, the after-commit / after-rollback hooks are
queued and drained only after the transaction body resolves — so side effects
(job enqueues, broadcasts, cache writes) don't fire if the transaction rolls
back.

```ts
Post.on('afterCommit',         (record) => enqueue('post-changed', record.id));
Post.on('afterRollback',       (record) => log('rolled back', record.id));
Post.on('afterCreateCommit',   ...);
Post.on('afterUpdateCommit',   ...);
Post.on('afterDeleteCommit',   ...);
Post.on('afterCreateRollback', ...);
Post.on('afterUpdateRollback', ...);
Post.on('afterDeleteRollback', ...);

await Post.transaction(async () => {
  await Post.create({ ... });          // afterCreate fires now;
                                        // afterCommit / afterCreateCommit do NOT.
});
// → afterCreateCommit + afterCommit drain here.
```

Outside a transaction the commit hooks fire immediately after the operation
lands (auto-commit semantics, matching Rails). Nested `Model.transaction`
calls reuse the outer context — commit-time effects drain once at the
outermost boundary. Per-callback errors during rollback are swallowed so the
original throw propagates intact.

> **Limitation.** Tracked via a module-level pointer (browser-bundle-safe — no
> `node:async_hooks` dependency). Sequential and nested transactions are
> correct; concurrent transactions on overlapping async timelines
> (`Promise.all([Model.transaction(...), Model.transaction(...)])`) can mix
> contexts. `await` one before starting the next when correctness matters.

## Connectors

Any object implementing the `Connector` interface works. The package ships with:

- `MemoryConnector` — in-memory storage for tests, local development, and quick scripts. Exported from the package root.

Writing your own is mostly a matter of mapping `Scope` to your driver's query builder. See `packages/knex-connector` or `packages/aurora-data-api-connector` for full examples.

### `ensureSchema()`

Connectors that carry an attached schema can implement the optional `ensureSchema()` method on the interface. It iterates the schema's `tableDefinitions` and creates every missing table idempotently, returning `{ created: string[], existing: string[] }`:

```ts
const connector = new MemoryConnector({ schema });
const { created } = await connector.ensureSchema();
// created → ['users', 'posts', ...]
```

`MemoryConnector`, `LocalStorageConnector` (inherits from `MemoryConnector`), and `SqliteConnector` implement `ensureSchema` today. Other connectors fall back to the original explicit `createTable(name, builder)` loop, and can opt in without a coordinated breaking change because the method is declared optional on `Connector`.

### `MemoryConnector` constructor shapes

```ts
new MemoryConnector();                                     // defaults
new MemoryConnector({ schema });                           // schema-only
new MemoryConnector({ storage, lastIds });                 // legacy props
new MemoryConnector({ storage, lastIds, schema });         // unified single-arg
new MemoryConnector({ storage, lastIds }, { schema });     // legacy two-arg
```

The unified single-arg form is preferred. The legacy two-arg form is kept for backwards compatibility (LocalStorageConnector subclassing relies on it). When `schema` appears on both args the extras arg wins. `LocalStorageConnector` accepts the same single-arg shape via `new LocalStorageConnector({ localStorage, schema })`.

### Builder `null` default

`TableBuilder.column(name, type, options)` and friends default `options.null` to **false** — matching the typed-schema convention (`defineSchema(...)` columns are NOT NULL unless `null: true`). Pass `{ null: true }` to make a column nullable:

```ts
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true });
  t.string('email');                       // NOT NULL
  t.timestamp('archivedAt', { null: true }); // nullable — must be explicit
});
```

Copy-pasting from a `defineSchema(...)` schema into a `createTable(...)` builder block now round-trips cleanly.

## Testing with Models

The hydrated instance shape (column getters + association accessors + key readonlys) is intersected at construction time, so direct `new Model(...)` calls or hand-built fixture objects don't satisfy the typed surface — TypeScript will reject reads of getter columns like `m.body` unless the value comes back through `Model.create()` / `Model.find()` / `typeof Model.Instance`.

Reach for a small typed factory helper instead of `as any`:

```ts
// test-helpers/makeMessage.ts
import { Message } from '../models/Message';

type MessageProps = Parameters<typeof Message.create>[0];

/**
 * Typed factory for unit tests: takes the same prop shape as `Message.create`,
 * persists through the real Model surface, and returns `typeof Message.Instance`
 * so test assertions on `m.body` / `m.author` typecheck without casts.
 */
export async function makeMessage(
  props: Partial<MessageProps> = {},
): Promise<typeof Message.Instance> {
  return Message.create({
    body: 'placeholder',
    author: null,
    ...props,
  } as MessageProps);
}
```

```ts
// some.spec.ts
import { makeMessage } from './test-helpers/makeMessage';

it('formats the body', async () => {
  const m = await makeMessage({ body: 'hello' });
  expect(m.body).toBe('hello');             // typed — no `as any`
  expect(formatLine(m)).toBe('hello');
});
```

The same pattern scales to every Model: define one `makeX(props?)` helper per Model under `test-helpers/`, key it on `Parameters<typeof X.create>[0]`, and return `typeof X.Instance`. This consolidates the `as any` casts that tend to grow in test fixtures and gives every test a single place to update when a column gets renamed.

## Errors

All errors extend `NextModelError` so you can catch them with a single check:

- `NextModelError` — base class
- `NotFoundError` — thrown by `find`, `findOrFail`, `save` (when update target vanished)
- `PersistenceError` — connector-level insert/update/delete failures, or actions on unsaved records
- `ValidationError` — thrown by `save` when any validator returns false. Carries `.errors: Record<string, string[]>` mirroring the rejected instance's `errors.toJSON()`; its `.message` is formatted `"Validation failed: <field>: <reason>; <field>: <reason>"` so `expect(p).rejects.toThrow(/name/)` works.
- `FilterError` — malformed filter expressions

```ts
import { ValidationError } from '@next-model/core';

try {
  await User.create({}); // missing required name + email
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(e.message);          // "Validation failed: name: cannot be blank; email: cannot be blank"
    console.error(e.errors?.name);     // ["cannot be blank"]
  }
  throw e;
}
```

Two construction shapes are accepted, mirrored both in tests and consumer code:

```ts
new ValidationError(errorsMap);                       // one-arg form
new ValidationError('Validation failed', errorsMap);  // legacy two-arg form
```

## Changelog

See [HISTORY.md](HISTORY.md) for earlier releases.
