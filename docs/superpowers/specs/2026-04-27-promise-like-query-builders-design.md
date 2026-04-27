# Promise-Like Chainable Query Builders

**Status:** Design proposed, awaiting review.
**Date:** 2026-04-27.
**Scope:** `@next-model/core`. Connector packages get a contract addition with a default fallback. No published API to migrate from — the change lands in `vNext`.

## Motivation

Today every query terminal (`Model.findBy`, `Model.first`, `Model.all`, …) is `async` and returns a `Promise`. Once a `Promise` is in hand, you can `await` it but you cannot extend the query. Cross-record traversal needs an explicit `await`, then a second method call:

```ts
const user = await User.findBy({ email });
const todos = await user!.todos;
const open = todos.filter(t => t.status === 'open');
// or, today: await User.findBy({email}).then(u => u?.todos)
```

We want chainable, deferred queries that compose end-to-end and execute as one SQL statement when the connector supports it:

```ts
const open = await User.findBy({ email }).todos.open;
// → ONE query with a nested subquery, no intermediate await
```

The deferral generalises beyond record traversal: subqueries also become valid values inside `filterBy(...)`, including aggregate subqueries used in scalar comparisons. The package is unreleased (`vNext`), so we accept breaking the existing `Promise<…>` return types of query terminals.

## Goals

1. Every method that returns a *scoped Model class* today returns a thenable query builder instead. `await` executes one query.
2. Two distinct builder shapes — **collection** and **instance** — with different chainable surfaces:
   - Collection chains within its own table (`filterBy`, `orderBy`, named scopes, enum predicates, …).
   - Instance chains *only* via the model's declared associations.
3. Cross-table traversal (`User.findBy({email}).todos.open`) lowers to a single SQL statement on connectors that support nested subqueries (or JOINs); a uniform Model-side fallback pre-resolves to concrete values for connectors that don't.
4. Subquery filter values: `CollectionQuery`, `InstanceQuery`, `ColumnQuery` (from `.pluck`) and `ScalarQuery` (from aggregates) are all valid `filterBy(...)` values and lower as nested SELECTs.
5. The bare `Model` base class is *not* awaitable; users must call at least one chain-op (or `.all()`) to get a thenable builder.
6. Default scope on the base model continues to work via the factory's existing `filter` / `order` / `limit` / `skip` options. Chain-ops narrow it; `unscoped()` / `unfiltered()` / etc. clear it.

## Non-goals

- Changing connector packages that don't natively support subqueries — they inherit a default fallback that pre-resolves nested builders into `$in: [...]` filters before delegating to the existing query primitive.
- Changing aggregate / mutation static methods that don't return Model instances (`count`, `sum`, `update`, `delete`, `create`, …) into chainable types beyond what's needed for subquery embedding (those become `ScalarQuery` for aggregates; mutations stay as `Promise`).
- Adding new association kinds. The existing `belongsTo` / `hasOne` / `hasMany` / `hasManyThrough` are sufficient.

## Architecture

Three deferred-query classes (plus a fourth scalar form):

```
Model (class)               -- not thenable; static methods return query builders
  ├── filterBy / orderBy / limitBy / skipBy / joins / whereMissing / includes / fields
  ├── named scopes / enum predicates
  ├── all() / first() / last() / findBy() / find() / findOrFail()
  └── count() / sum() / pluck() / update() / delete() / create() / build() / …

CollectionQuery<M, Items>    -- PromiseLike<Items>, default terminal: .all()
  ├── filterBy / orderBy / limitBy / skipBy / joins / whereMissing / includes / fields
  │     → CollectionQuery<M, Items>
  ├── named scopes / enum predicates
  │     → CollectionQuery<M, Items>
  ├── first() / last() / findBy(...) → InstanceQuery<M, InstanceType<M> | undefined>
  ├── find(id) / findOrFail(...)     → InstanceQuery<M, InstanceType<M>>
  ├── count() / sum(col) / average(col) → ScalarQuery<M, number>
  ├── minimum(col) / maximum(col)       → ScalarQuery<M, ColType | undefined>
  ├── pluck(col)                        → ColumnQuery<M, Col, Col[]>
  └── update(...) / delete(...) / etc.  → Promise<…>   (terminal escape, not chainable)

InstanceQuery<M, Result>     -- PromiseLike<Result>
  ├── associations declared on M (via factory's `associations: {…}`):
  │     belongsTo / hasOne   → InstanceQuery<Related, … | undefined>
  │     hasMany / hasManyThrough → CollectionQuery<Related>
  └── pluck(col)             → ScalarQuery<M, Col | undefined>

ColumnQuery<M, Col, Shape>   -- PromiseLike<Shape>; usable as filter value; no further chaining
ScalarQuery<M, T>            -- PromiseLike<T>;     usable as filter value; no further chaining
```

`CollectionQuery` has no terminal field; awaiting is implicit `.all()`. `InstanceQuery` carries a `terminalKind` (`first` / `last` / `findBy` / `find` / `findOrFail`) that determines `LIMIT 1`, ordering, and missing-record policy.

### Two-step transitions

- Collection → Instance: `Todo.filterBy(...).first()` returns `InstanceQuery<typeof Todo, Todo | undefined>`.
- Instance → Collection: `Todo.first().attachments` returns `CollectionQuery<typeof Attachment>` (the parent is single-record, so the `attachments` accessor scopes by that one Todo's id).
- Instance → Instance: `Todo.first().user` returns `InstanceQuery<typeof User, User | undefined>` (belongsTo).

Even when the upstream terminal is `findOrFail` (which throws on miss), downstream traversal still types as `… | undefined` because foreign keys can dangle.

### Bare class is not awaitable

`Model` itself never carries a `then` member. TypeScript will let `await Todo` resolve to `typeof Todo` (the class object), but no documented path produces this and our examples always start with at least one chain-op or `.all()`. We document the invariant rather than encoding a `never`-brand on the base class — the brand pollutes inheritance and adds friction to legitimate static usage.

### Parens vs. paren-less associations

Both forms continue to work and produce query builders:

- **Declared via factory `associations: {...}`** → paren-less getters on `InstanceQuery` and on materialized instances.
   `Todo.first().user`, `(await Todo.first()).user`.
- **Explicit instance methods** (`user() { return this.belongsTo(User); }`) → parens-style, available only on the materialized instance after `await`.
   `(await Todo.first()).user()`.

The static-accessor surface on `InstanceQuery` is driven by the declarative `associations` literal; explicit instance methods remain useful for one-off shapes (e.g., custom polymorphic logic) that don't fit the literal form.

## State carried by a query builder

```
QueryState {
  Model           : typeof Model       // target model class
  filters         : Filter             // accumulated; default-scope-seeded on construction
  order           : OrderClause | undefined
  limit           : number | undefined
  skip            : number | undefined
  pendingJoins    : JoinClause[]       // existing concept — joins(...) / whereMissing(...) / cross-association filterBy
  selectedIncludes: string[]
  selectedFields  : string[] | undefined
  parent?         : { upstream: QueryBuilder; via: AssociationLink }
                    // present only when this builder was produced by an association accessor
                    // on an InstanceQuery; `via` records FK + direction (belongsTo/hasOne/hasMany/HMT)
}

InstanceQuery extends QueryState with:
  terminalKind    : 'first' | 'last' | 'findBy' | 'find' | 'findOrFail'
```

`CollectionQuery.fromModel(M)` seeds a fresh state from the factory's default-scope options. Chain-ops return new `CollectionQuery` instances with state merged. `unscoped()` / `unfiltered()` / etc. clear the relevant state slice. Single-record transitions construct an `InstanceQuery` from the current `CollectionQuery`'s state plus the chosen `terminalKind`.

## Lowering to SQL

Walk the `parent` chain leaf → root. Every link is a single-record upstream (an `InstanceQuery`), so each link contributes a `LIMIT 1` ordered subquery:

```sql
SELECT <leaf-projection>
FROM <leaf-table>
WHERE <leaf-fk> IN (
  SELECT <parent-pk-or-fk>
  FROM <parent-table>
  WHERE <parent-filters>
  ORDER BY <parent-order>
  LIMIT 1
)
AND <leaf-filters>
ORDER BY <leaf-order>
LIMIT <leaf-limit-if-set>
```

For `belongsTo` traversal, the inner SELECT projects the parent's foreign-key column instead of the parent's primary key — direction reversed but structure identical.

A chain of N association links nests N subqueries. The pending-join queue (from `joins(...)` / `whereMissing(...)` / `filterBy({assoc: {…}})`) continues to lower to `WHERE EXISTS (...)` / `WHERE NOT EXISTS (...)` exactly as today, on top of whatever subqueries the parent chain contributed.

JOINs are *not* used for parent-scope traversal because the parent is single-record; a JOIN would multiply rows when filters aren't unique. JOINs remain reserved for the existing `joins(...)` / cross-association `filterBy` use cases.

### Subquery filter values

Embedding a query builder inside `filterBy(...)` lowers identically through the same pipeline:

```ts
Todo.filterBy({ userId: User.filterBy({ lastLogin: { $gt: cutoff } }) });
// → WHERE todos.user_id IN (SELECT users.id FROM users WHERE last_login > ?)

Todo.filterBy({ ownerEmail: User.filterBy({ active: true }).pluck('email') });
// → WHERE todos.owner_email IN (SELECT users.email FROM users WHERE active = ?)

Order.filterBy({
  total: { $gt: OrderItem.filterBy({ id: referenceOrderId }).sum('amount') },
});
// → WHERE orders.total > (SELECT SUM(order_items.amount) FROM order_items WHERE order_items.id = ?)
```

| Value passed                | Lowers to                                                      |
| --------------------------- | -------------------------------------------------------------- |
| `CollectionQuery<M>`        | `<col> IN (SELECT <M.pk> FROM <M.table> WHERE …)`              |
| `InstanceQuery<M>`          | `<col> = (SELECT <M.pk> FROM <M.table> WHERE … LIMIT 1)`       |
| `ColumnQuery<M, Col, T[]>`  | `<col> IN (SELECT <Col> FROM <M.table> WHERE …)`               |
| `ColumnQuery<M, Col, T \| undefined>` | `<col> = (SELECT <Col> FROM … LIMIT 1)`                |
| `ScalarQuery<M, number>`    | `<col> <op> (SELECT <agg>(<Col>) FROM <M.table> WHERE …)`      |

Operators (`$in`, `$notIn`, `$gt`, `$lt`, `$eq`, …) compose with builder values transparently — the operator just changes the comparison emitted around the inner SELECT.

## Connector contract

A new entry point on `Connector`:

```ts
queryScoped(spec: {
  target: { tableName: string; keys: Dict<KeyType> };
  filter?: Filter<any>;
  order?: OrderColumn<any>[];
  limit?: number;
  skip?: number;
  selectedFields?: string[];
  pendingJoins: JoinClause[];                  // existing EXISTS-style joins
  parentScopes: ParentScope[];                 // 0..N nested subquery descriptors (closest parent last)
  projection: Projection;                      // 'rows' | 'pk' | { column } | { aggregate }
}): Promise<unknown>;
```

with

```ts
type ParentScope = {
  parentTable: string;
  parentKeys: Dict<KeyType>;       // column-name → KeyType for the parent table
  parentFilter?: Filter<any>;
  parentOrder?: OrderColumn<any>[];
  parentLimit?: number;
  link: { childColumn: string; parentColumn: string; direction: 'belongsTo' | 'hasOne' | 'hasMany' };
  // child uses link.childColumn, parent projects link.parentColumn
  // hasManyThrough decomposes into two ParentScope entries; not a direction value
};

type Projection =
  | 'rows'                                                                     // default for outermost leaf
  | { kind: 'pk' }                                                             // implicit for collection/instance subqueries
  | { kind: 'column'; column: string }                                         // from .pluck(col)
  | { kind: 'aggregate'; op: 'count'|'sum'|'avg'|'min'|'max'; column?: string };
```

`queryScoped` returns:
- `Record[]` when `projection` is `'rows'`.
- A list of values when `projection` is `'column'` or `{ kind: 'pk' }`.
- A single scalar when `projection` is `{ kind: 'aggregate' }`.

A default implementation (`baseQueryScoped` exported from `@next-model/core`) is used by every connector that doesn't override:

1. Top-down, resolve each `parentScope` to concrete primary-key values (or projected column values) by issuing one query per scope using the connector's existing primitives.
2. Rewrite the leaf's `filter` to splice those concrete values in as `$in: [...]` (or `$eq: …`) on the link's child column.
3. Resolve every subquery filter value the same way, rewriting them as concrete `$in: [...]` operators.
4. Delegate to the existing `query` / `queryWithJoins` to fetch the leaf rows or aggregate.

Connectors that natively support subqueries (Knex, Aurora Data API, native pg / sqlite / mysql / mariadb) override `queryScoped` to emit one statement with nested SELECTs.

The KV/document connectors (`MemoryConnector`, `RedisConnector`, `ValkeyConnector`, `MongodbConnector`, `LocalStorageConnector`) inherit the default fallback. Mongo could later override using `$lookup`, but that's out of scope here.

`queryWithJoins` stays as-is and remains the primitive for the `joins(...)` / `whereMissing(...)` / `includes(...)` chainables; `queryScoped` *uses* it for the join-clause portion when relevant.

## TypeScript

```ts
class CollectionQuery<M extends typeof Model, Items extends InstanceType<M>[] = InstanceType<M>[]>
  implements PromiseLike<Items> {
  filterBy(...): CollectionQuery<M, Items>
  orFilterBy(...): CollectionQuery<M, Items>
  orderBy(...): CollectionQuery<M, Items>
  limitBy(...): CollectionQuery<M, Items>
  skipBy(...): CollectionQuery<M, Items>
  joins(...): CollectionQuery<M, Items>
  whereMissing(...): CollectionQuery<M, Items>
  includes(...): CollectionQuery<M, Items>
  fields(...): CollectionQuery<M, Items>
  unscoped(): CollectionQuery<M, Items>           // and unfiltered/unordered/unlimited/unskipped/withoutIncludes
  // …named scopes and enum predicates mapped from the factory literal

  first():       InstanceQuery<M, InstanceType<M> | undefined>
  last():        InstanceQuery<M, InstanceType<M> | undefined>
  findBy(...):   InstanceQuery<M, InstanceType<M> | undefined>
  find(id):      InstanceQuery<M, InstanceType<M>>             // throws on miss
  findOrFail(...): InstanceQuery<M, InstanceType<M>>           // throws on miss

  count():       ScalarQuery<M, number>
  sum(col):      ScalarQuery<M, number>
  average(col):  ScalarQuery<M, number>
  minimum(col):  ScalarQuery<M, ColType | undefined>
  maximum(col):  ScalarQuery<M, ColType | undefined>
  pluck(col):    ColumnQuery<M, Col, Col[]>

  update(...): Promise<…>; delete(...): Promise<…>; …          // terminal escape

  then<R1, R2>(onF?, onR?): PromiseLike<R1 | R2>
  catch<R>(onR?): PromiseLike<Items | R>
  finally(onF?): PromiseLike<Items>
}

class InstanceQuery<M extends typeof Model, Result extends InstanceType<M> | undefined>
  implements PromiseLike<Result>, AssociationAccessors<M> {
  pluck(col): ScalarQuery<M, Col | undefined>
  then<R1, R2>(onF?, onR?): PromiseLike<R1 | R2>
}

class ColumnQuery<M, Col, Shape> implements PromiseLike<Shape> { /* terminal */ }
class ScalarQuery<M, T>          implements PromiseLike<T>     { /* terminal */ }
```

`AssociationAccessors<M>` is mapped from the factory's `associations` literal:

```ts
type AssociationAccessors<M> = {
  [K in keyof AssociationsOf<M>]:
    AssociationsOf<M>[K] extends infer S
      ? S extends { hasMany: any } | { hasManyThrough: any }
        ? CollectionQuery<RelatedOf<S>>
        : InstanceQuery<RelatedOf<S>, InstanceType<RelatedOf<S>> | undefined>
      : never
};
```

`FilterValue<T>` widens to admit deferred queries:

```ts
type FilterValue<T> =
  | T
  | OperatorRecord<T>
  | CollectionQuery<any>
  | InstanceQuery<any, any>
  | ColumnQuery<any, any, any>
  | ScalarQuery<any, any>;
```

Named scopes and enum predicates are mirrored onto `CollectionQuery<M>` via a Model-specific subclass type produced by the factory, so chain-IntelliSense (`Todo.open().filterBy(…).published()`) keeps working.

Named scopes are declarative filter literals, not callbacks. The factory's `scopes: {…}` option accepts a dict where each value is a `Filter` (the same shape `filterBy(...)` accepts):

```ts
class User extends Model({
  tableName: 'users',
  scopes: {
    active:      { lastSignInAt: { $gt: cutoffDate } },
    withoutMail: { $null: 'email' },
  },
}) {
  // complex / multi-clause scopes go in static methods on the user's class
  static admins() {
    return this.filterBy({ role: 'admin' });
  }
}
```

Each declared scope becomes a no-arg method available both on the base class (`User.active()` → `CollectionQuery<typeof User>`) and as a chain method on any `CollectionQuery<typeof User>` (`User.filterBy(…).active()`). Internally each scope-method just merges its filter literal into the current builder via the same `filterBy(...)` accumulation path — so scopes compose with everything else without special cases.

For anything that doesn't fit a single filter literal — multi-clause logic, ordering, joins, subqueries — write a static method on the user's class. Static methods naturally return whatever query builder they construct (`this.filterBy(...)` is `CollectionQuery<typeof User>`), and they continue to chain because the returned builder has the full method surface.

## `attributes` getter

The instance helper that returns a plain POJO is exposed as a getter (no parens) so it lines up with the chainable accessors on the same instance:

```ts
const user = await User.first();
user.attributes;          // { id, email, createdAt, … }   — plain object, JSON-safe
user.todos;               // CollectionQuery<typeof Todo>  — chainable, not in attributes
JSON.stringify(user);     // identical to JSON.stringify(user.attributes)  — via toJSON()
```

`attributes` reads from `persistentProps`, `changedProps`, and `keys` exactly as today (already excludes association accessors). `toJSON()` stays as a method (used by `JSON.stringify`'s lookup). `pick(keys)` / `omit(keys)` stay as methods (they take args).

A test asserts that a fresh `(await User.first()).attributes` round-trips through `JSON.stringify` cleanly with no `then` / association keys leaking in.

## File and module layout

**New files in `packages/core/src/`:**

- `query/CollectionQuery.ts`
- `query/InstanceQuery.ts`
- `query/ColumnQuery.ts`
- `query/ScalarQuery.ts`
- `query/QueryState.ts` — shared state shape, default-scope seeding, accumulation helpers (`mergeFilters`, `mergeOrder`, …).
- `query/lower.ts` — Model-side compiler from a builder + parent chain + subquery filter values to a flat `queryScoped` request.
- `query/baseQueryScoped.ts` — the default fallback that pre-resolves nested builders into concrete `$in: [...]` filters.

**`packages/core/src/Model.ts`:**

- Static methods that today return scoped subclasses (`filterBy`, `orderBy`, `joins`, `includes`, `all`, `first`, `last`, `findBy`, `find`, `findOrFail`, named scopes, enum predicates, `unscoped` family) construct and return `CollectionQuery` (or `InstanceQuery` for single-record terminals) instead of a subclass.
- Subclass-static state (`selectedFilters`, `pendingJoins`, …) goes away; default-scope seeding moves into `CollectionQuery.fromModel(M)`.
- Aggregate / mutation static methods continue to exist on the base class for ergonomics. They forward to a fresh `CollectionQuery` and call the corresponding builder method.
- Auto-installed instance association accessors switch from "returns a Promise" to "returns a query builder."
- `attributes` becomes a getter; `attributes()` is removed.

**Connector packages — `queryScoped` overrides:**

- `knex-connector`, `aurora-data-api-connector`, `postgres-connector`, `sqlite-connector`, `mysql-connector`, `mariadb-connector` — emit nested SELECTs.
- `mongodb-connector`, `redis-connector`, `valkey-connector`, `local-storage-connector`, plus `MemoryConnector` in core — no override; inherit `baseQueryScoped`.

**Other packages:**

- `graphql-api`, `express-rest-api`, `nextjs-api` — spot-check call sites that explicitly typed `Promise<Model | undefined>` and adjust to the corresponding builder type alias. Likely small.
- `migrations`, `migrations-generator`, `arktype`, `typebox`, `zod` — no surface change expected.
- `packages/core/README.md` — replace eager-execution examples with builder-chain ones; document the collection/instance distinction, default scope, subquery filter values, parens-vs-no-parens for associations.
- `packages/core/HISTORY.md` (vNext section) — append one bullet describing the change.

## Testing

- Unit tests for each query-builder shape: chain methods, transitions, thenable behavior, default-scope seeding, `unscoped` / `unfiltered` clearing.
- Conformance suite additions, exercised against every connector:
  - One-level parent-scope traversal (`User.findBy({email}).todos`).
  - Multi-level traversal (`Order.first().customer.address.country`).
  - Subquery as filter value with implicit primary key (`Todo.filterBy({userId: User.filterBy({…})})`).
  - Subquery as filter value via `.pluck(col)`.
  - Aggregate subquery via `count` / `sum` / etc.
  - `.pluck(col)` awaitable on its own (collection → array, instance → scalar).
  - `attributes` getter on a resolved instance is a clean POJO that `JSON.stringify`s cleanly.
- `RecordingConnector` / `SchemaCollector` (the test rigs added in #148) capture the new `queryScoped` calls so we can assert lowering shape per-connector — single SQL statement on SQL connectors, the right number of round trips on KV/document connectors.
- A regression test that `await Todo` (the bare class) is documented as not returning records and that the documented entry points always start with at least one chain-op.
- All existing tests using `await Model.something()` continue to pass — the builder is thenable. Tests that explicitly assert `instanceof Promise` are reworded to assert the builder type instead.

## Open questions / follow-ups

- Do we want a `WHERE EXISTS (subquery)` shorthand for `Order.filterBy({ $exists: OrderItem.filterBy({ orderId: '$parent.id', flagged: true }) })`? Useful but separable; defer.
- Mongo `$lookup` override of `queryScoped` for one-trip parent-scope traversal: tracked but not in this change.
- Async-chunked iteration (`findEach`, `findInBatches`) stays on `CollectionQuery` as async iterables — no surface change here.
