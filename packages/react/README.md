# @next-model/react

React reactivity bindings for [`@next-model/core`](../core). Provider-scoped identity map, reactive instance shells, and key-based invalidation hooks.

## Install

```bash
pnpm add @next-model/react @next-model/core
# react@18 or react@19 must already be installed
```

## Setup

Wrap your app once at the root:

```tsx
import { NextModelProvider } from '@next-model/react';

export function Root() {
  return <NextModelProvider><App /></NextModelProvider>;
}
```

Every hook throws if called outside a Provider.

## Hooks

### `useModel(ModelClass)`

Returns a chainable query builder mirroring the static surface of the Model. Chain methods (`filterBy`, `where`, `orderBy`, `limit`, `skip`, `joins`, `includes`, `withoutIncludes`, `whereMissing`, `none`) return another chain.

The hook return type is `ReactiveModelQuery<I, P>` where `I` is the fully-typed instance (including attribute fields and `id`) and `P` is the create-props type inferred from `Model({ init })`.

#### Sync terminal

`build(props?)` — returns a stable reactive instance. Mutating attributes triggers a rerender. Includes `.reset(props?)` to re-initialise via `Model.init(...)`.

```tsx
function NewTaskForm() {
  const todo = useModel(Todo).build({ done: false });
  const invalidate = useInvalidateKeys();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await todo.save();
      invalidate(['todos']);
      todo.reset({ done: false });
    }}>
      <input value={todo.title ?? ''} onChange={(e) => { todo.title = e.target.value; }} />
      <button disabled={!todo.isChanged() || todo.errors.count() > 0}>save</button>
    </form>
  );
}
```

#### Chain terminals — `PendingResult<T>` — call `.fetch()` or `.watch()`

Terminal methods (`all`, `find`, `findBy`, `first`, `last`, `findOrFail`, `count`, `sum`, `min`, `max`, `avg`, `pluck`, `exists`) are **chain steps** — they record the terminal in the plan and return a `PendingResult<T>` without invoking any React hook. To execute:

- `.fetch()` — one-shot async fetch: returns `AsyncResult<T>` (`{ data, isLoading, error }`)
- `.watch(opts?)` — live subscription: returns `WatchResult<T>` (`{ data, isLoading, isRefetching, error }`)

| Terminal | `T` for `.fetch()` / `.watch()` |
|---|---|
| `find(pk)` / `findBy(filter)` / `first()` / `last()` / `findOrFail(pk)` | row instance \| `undefined` |
| `all()` | `instance[]` |
| `count()` | `number` |
| `sum/min/max/avg(col)` | `number \| undefined` |
| `pluck(col)` | `unknown[]` |
| `exists()` | `boolean` |

`isLoading` is true only on the very first fetch. `find(pk)` resolves to `undefined` on miss (the React layer catches `NotFoundError` from core); `findOrFail(pk)` lands the error in `error`.

```tsx
// One-shot fetch
const { data: count } = useModel(Todo).count().fetch();

// Watch a single record
const { data: todo } = useModel(Todo).find(id).watch();

// Watch a filtered list with key invalidation
const { data: todos } = useModel(Todo).filterBy({ userId }).watch({
  keys: [`todos-user:${userId}`],
});
```

#### Shortcut: implicit-all `.fetch()` / `.watch()`

Calling `.fetch()` or `.watch()` directly on a chain (without a preceding terminal) defaults to `'all'`:

```tsx
// equivalent to useModel(Todo).all().watch(opts)
const { data } = useModel(Todo).filterBy({ done: false }).watch({ keys: ['todos'] });
```

```tsx
// Watch behaviour:
// - In-place updates on save: row stays in `data` with fresh attributes.
// - Deleted rows drop from `data`.
// - New rows are not auto-added — call `useInvalidateKeys()` to refetch.
// - Filters are not auto re-evaluated client-side.
function TodoList({ userId }: { userId: number }) {
  const { data, isLoading } = useModel(Todo).filterBy({ userId }).watch({
    keys: ['todos', `todos-user:${userId}`],
  });
  if (isLoading) return <p>loading…</p>;
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

### `useInvalidateKeys()`

```tsx
const invalidate = useInvalidateKeys();
invalidate(['todos', `todos-user:${id}`]);
```

## Public types

```ts
import type {
  ReactiveModelQuery,  // the full query builder surface
  PendingResult,       // { fetch(): AsyncResult<T>; watch(): WatchResult<T> }
  AsyncResult,         // { data: T; isLoading: boolean; error: Error | undefined }
  WatchResult,         // { data: T; isLoading: boolean; isRefetching: boolean; error: Error | undefined }
  ModelInstanceType,   // extract instance type from a Model class
  ModelCreatePropsType,// extract create-props type from a Model class
} from '@next-model/react';
```

## How it works

- One `Store` per Provider, owning an identity map keyed by `tableName[pk]`.
- `useModel` materialises rows into reactive Proxy shells; the same row across queries returns `===` the same shell within a Provider.
- Mutations (assign / save / delete) emit per-instance to subscribed components AND broadcast on the row key so watches rerender.
- Watch result sets are refcounted; rows are evicted on the last unmount.
- Provider unmount disposes the Store; subsequent broadcasts are silent.

## Caveats / deferred features

- No SSR / Next.js adapter (deferred to a separate package).
- No Suspense integration.
- No optimistic insertion of newly saved rows into watched arrays — use `useInvalidateKeys`.
- No interval / background polling.
- Cross-Provider mutations are not propagated.
