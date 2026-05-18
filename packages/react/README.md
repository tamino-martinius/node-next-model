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

`orderBy` accepts either the strict `{ key, dir }` shape (`{ key: 'createdAt', dir: SortDirection.Desc }`) or the conventional `{ [col]: 'asc' | 'desc' }` shape (`{ createdAt: 'desc' }`) — both normalise into the same connector call.

The hook return type is `ReactiveModelQuery<I, P>` where `I` is the fully-typed instance (including attribute fields and `id`) and `P` is the create-props type inferred from `Model({ init })`.

#### Sync terminal

`build(props?)` — returns a stable reactive instance. Mutating attributes triggers a rerender. Includes `.reset(props?)` to re-initialise via `Model.init(...)`.

> **`props` are snapshotted on first call.** Like `useState(initial)`, `build()` doesn't track later renders' `props` arguments — that would clobber user input every render. To swap the form's defaults when its context changes (e.g. a per-user form when the active user switches), give the parent component a `key` so React remounts it:
>
> ```tsx
> {activeId != null && <Tasks key={activeId} userId={activeId} />}
> ```
>
> Inside `Tasks`, `useModel(Task).build({ userId, ... })` then re-runs with the new `userId`. Without the `key`, the build shell stays bound to the initial `userId`.

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

#### Chain terminals — `PendingResult<T>` — call `.fetch()`, `.watch()`, or `.run()`

Terminal methods (`all`, `find`, `findBy`, `first`, `last`, `findOrFail`, `count`, `sum`, `min`, `max`, `avg`, `pluck`, `exists`) are **chain steps** — they record the terminal in the plan and return a `PendingResult<T>` without invoking any React hook. To execute:

- `.fetch()` — one-shot async fetch: returns `AsyncResult<T>` (`{ data, isLoading, error }`) — hook, render-time only
- `.watch(opts?)` — live subscription: returns `WatchResult<T>` (`{ data, isLoading, isRefetching, error }`) — hook, render-time only
- `.run()` — imperative: returns `Promise<T>` whose instances are store-tagged reactive shells. Safe to call from event handlers, mutation callbacks, or any non-render async code. Subsequent `.update()` / `.delete()` calls on the returned shell auto-publish and refire any active watches on the same row.

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

// Imperative lookup + mutate from an event handler — sibling watches refire
// automatically. No `useInvalidateKeys` call needed for the mutation itself.
function ToggleButton({ id }: { id: number }) {
  const Todo = useModel(TodoModel);
  return (
    <button onClick={async () => {
      const row = await Todo.find(id).run();
      if (row) await row.update({ done: !row.done });
    }}>
      toggle
    </button>
  );
}
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
// - Filter-flipping mutations: when a mutation changes a column that the
//   watch's `filterBy` references, the watch refetches automatically and
//   the row appears / disappears from `data` to match. Works in both
//   directions (a row newly matching the filter is pulled in).
// - Rows created via `Model.create(...)` are not auto-added — that path
//   doesn't go through a tagged shell. Use `useInvalidateKeys()` or
//   `useModel(M).build(...)` + `.save()` for created rows.
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
  PendingResult,       // { fetch(): AsyncResult<T>; watch(): WatchResult<T>; run(): Promise<T> }
  AsyncResult,         // { data: T; isLoading: boolean; error: Error | undefined }
  WatchResult,         // { data: T; isLoading: boolean; isRefetching: boolean; error: Error | undefined }
  ModelInstanceType,   // extract instance type from a Model class
  ModelCreatePropsType,// extract create-props type from a Model class
} from '@next-model/react';
```

## How it works

- One `Store` per Provider, owning an identity map keyed by `tableName[pk]`.
- `useModel` materialises rows into reactive Proxy shells; the same row across queries returns `===` the same shell within a Provider.
- `.fetch()` / `.watch()` / `.run()` all funnel through the same `adopt` path — every fetched instance becomes a tagged shell that publishes on mutation.
- Mutations (`update` / `save` / `delete` / `increment` / `decrement`) emit per-instance to subscribed components AND broadcast on the row key so watches rerender. They also broadcast `col:<table>:<column>` for each column whose persistent value actually changes, so collection watches whose `filterBy` references those columns refetch (membership flips).
- Watch result sets are refcounted; rows are evicted on the last unmount.
- Provider unmount disposes the Store; subsequent broadcasts are silent.

## Caveats / deferred features

- No SSR / Next.js adapter (deferred to a separate package).
- No Suspense integration.
- Rows newly created via the static `Model.create(...)` (which doesn't go through a tagged shell) are not auto-added to watched arrays — use `useInvalidateKeys`, or use `useModel(M).build(...)` + `.save()` so the create round-trips through a shell.
- No interval / background polling.
- Cross-Provider mutations are not propagated.

## Source maps

`dist/**/*.map` is included in the published tarball, so downstream bundlers (Vite, webpack, esbuild, Rollup) resolve the original TypeScript source on errors out of `@next-model/react` without `ENOENT` warnings. There is no runtime change.
