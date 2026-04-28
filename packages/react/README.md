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

#### Async terminals — `{ data, isLoading, error }`

| Terminal | `data` |
|---|---|
| `find(pk)` / `findBy(filter)` / `first()` / `last()` / `findOrFail(pk)` | row instance \| `undefined` |
| `all()` | `instance[]` |
| `count()` | `number` |
| `sum/min/max/avg(col)` | `number \| undefined` |
| `pluck(col)` | `BaseType[]` |
| `exists()` | `boolean` |

`isLoading` is true only on the very first fetch. `find(pk)` resolves to `undefined` on miss (the React layer catches `NotFoundError` from core); `findOrFail(pk)` lands the error in `error`.

#### Watch terminals — `{ data, isLoading, isRefetching, error }`

For ergonomic + hook-rule-safe reasons, watch terminals are exposed as flat methods on the chain:

| Method | Equivalent in spec mockups |
|---|---|
| `.watch(opts?)` | `.all().watch(opts)` |
| `.findWatch(pk, opts?)` | `.find(pk).watch(opts)` |
| `.findByWatch(filter, opts?)` | `.findBy(filter).watch(opts)` |
| `.firstWatch(opts?)` / `.lastWatch(opts?)` | `.first().watch(...)` / `.last().watch(...)` |

`opts` is `{ keys?: (string | symbol)[] }`. Each key triggers a refetch when invalidated.

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
- In-place updates on save: row stays in `data` with fresh attributes.
- Deleted rows drop from `data`.
- New rows are not auto-added — call `useInvalidateKeys()` to refetch.
- Filters are not auto re-evaluated client-side. If a row no longer matches the filter after an update, it stays in `data` until refetch.

### `useInvalidateKeys()`

```tsx
const invalidate = useInvalidateKeys();
invalidate(['todos', `todos-user:${id}`]);
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
