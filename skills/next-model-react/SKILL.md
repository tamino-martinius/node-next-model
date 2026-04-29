---
name: next-model-react
description: React reactivity bindings for `@next-model/core`. Use when wiring next-model data into a React 18/19 app — exposes `useModel` (chainable query builder with `.fetch()` / `.watch()` terminals) and `useInvalidateKeys` for key-based refetch. Triggers include "React hook for next-model", "live model state", "subscribe to a model", "watch a next-model query".
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-react

`@next-model/react` provides React reactivity bindings for `@next-model/core`: a `<NextModelProvider>`-scoped identity map, reactive Proxy instance shells, and key-based invalidation. The same row across queries returns the `===` same shell within a Provider; mutations (assign / save / delete) emit per-instance to subscribed components and broadcast on the row key so live `.watch()` results rerender. Built for React 18 and 19 — works with concurrent rendering, but does not currently integrate with Suspense or ship an SSR adapter.

## When to use

- React 18+ or React 19 client apps that need to read and mutate next-model data with automatic rerenders on save/delete.
- Forms backed by reactive instance shells (`build()` returns a stable mutable Proxy).
- Live lists / single-record views that should refresh when a key is invalidated elsewhere in the tree.

## When not to use

- Server-only code paths (route handlers, Node scripts, jobs) — call the Model API directly from `@next-model/core`.
- Non-React frameworks (Vue, Svelte, Solid) — there are no bindings here for those.
- SSR / Next.js app-router server components — no SSR adapter ships in this package (deferred).
- Code paths that need Suspense data fetching — not supported.

## Install

```bash
pnpm add @next-model/react @next-model/core
# or: npm install @next-model/react @next-model/core
```

`react` is a peer dependency: `^18.0.0 || ^19.0.0` must already be installed.

## Setup

Wrap your app once at the root. Every hook throws if called outside a Provider.

```tsx
import { NextModelProvider } from '@next-model/react';

export function Root() {
  return (
    <NextModelProvider>
      <App />
    </NextModelProvider>
  );
}
```

One `Store` is created per Provider, owning the identity map keyed by `tableName[pk]`. Provider unmount disposes the Store; subsequent broadcasts are silent. Cross-Provider mutations are not propagated.

## Hooks

### `useModel(ModelClass)`

Returns a chainable query builder mirroring the static surface of the Model. Chain methods (`filterBy`, `where`, `orderBy`, `limit`, `skip`, `joins`, `includes`, `withoutIncludes`, `whereMissing`, `none`) return another chain. The hook return type is `ReactiveModelQuery<I, P>` where `I` is the fully-typed instance and `P` is the create-props type inferred from `Model({ init })`.

#### Sync terminal — `build(props?)`

Returns a stable reactive instance. Mutating attributes triggers a rerender. Includes `.reset(props?)` to re-initialise via `Model.init(...)`.

> `props` are snapshotted on first call. Like `useState(initial)`, `build()` doesn't track later renders' `props` arguments. To swap defaults when context changes (e.g. a per-user form when the active user switches), give the parent a `key` so React remounts it:
>
> ```tsx
> {activeId != null && <Tasks key={activeId} userId={activeId} />}
> ```

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

#### Chain terminals — `PendingResult<T>`

Terminal methods (`all`, `find`, `findBy`, `first`, `last`, `findOrFail`, `count`, `sum`, `min`, `max`, `avg`, `pluck`, `exists`) record the terminal in the plan and return a `PendingResult<T>` without invoking any React hook. To execute:

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

`isLoading` is true only on the very first fetch. `find(pk)` resolves to `undefined` on miss; `findOrFail(pk)` lands the error in `error`.

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

Calling `.fetch()` or `.watch()` directly on a chain (without a preceding terminal) defaults to `'all'`:

```tsx
function TodoList({ userId }: { userId: number }) {
  const { data, isLoading } = useModel(Todo).filterBy({ userId }).watch({
    keys: ['todos', `todos-user:${userId}`],
  });
  if (isLoading) return <p>loading…</p>;
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

Watch behaviour:
- In-place updates on save: the row stays in `data` with fresh attributes.
- Deleted rows drop from `data`.
- New rows are not auto-added — call `useInvalidateKeys()` to refetch.
- Filters are not auto re-evaluated client-side.

### `useInvalidateKeys()`

```tsx
const invalidate = useInvalidateKeys();
invalidate(['todos', `todos-user:${id}`]);
```

## Public types

```ts
import type {
  ReactiveModelQuery,   // the full query builder surface
  PendingResult,        // { fetch(): AsyncResult<T>; watch(): WatchResult<T> }
  AsyncResult,          // { data: T; isLoading: boolean; error: Error | undefined }
  WatchResult,          // { data: T; isLoading: boolean; isRefetching: boolean; error: Error | undefined }
  ModelInstanceType,    // extract instance type from a Model class
  ModelCreatePropsType, // extract create-props type from a Model class
} from '@next-model/react';
```

## Suspense / transitions

Suspense integration is not supported in this release. Loading is surfaced via `isLoading` / `isRefetching` on `AsyncResult` / `WatchResult` — render fallbacks based on those flags, not `<Suspense>` boundaries.

## SSR / hydration notes

No SSR / Next.js adapter is shipped in this package — it is deferred to a separate package. For Next.js usage today, keep `useModel` calls inside Client Components (`"use client"`) and source server data via the Model API or a dedicated server route. For HTTP API scaffolding on the server side, see `next-model-nextjs-api`.

## Caveats

- No SSR / Next.js adapter (deferred to a separate package).
- No Suspense integration.
- No optimistic insertion of newly saved rows into watched arrays — use `useInvalidateKeys`.
- No interval / background polling.
- Cross-Provider mutations are not propagated.
- Watch result sets are refcounted; rows are evicted on the last unmount.

## See also

- `next-model-core` — Model definition, query builder, lifecycle hooks.
- `next-model-local-storage-connector` — browser-side connector that pairs well with React state.
- `next-model-nextjs-api` — Next.js route-handler scaffolding for serving model data to the client.
