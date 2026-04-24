# react-todo

Plain React 19 + Vite demo of `@next-model/local-storage-connector` running entirely in the browser. No backend.

```sh
pnpm install
pnpm dev      # opens http://localhost:5173
pnpm build    # produces a static dist/
```

## What it shows

- **Multi-user** via per-user `prefix:` on the connector — each user picker switches to a fresh `LocalStorageConnector` whose keys live under `nm-todo:<user>:`. No data crossover between users.
- **`use(promise)`** — React 19's hook for awaiting a query inside a component. The `<TodoList>` component calls `use(loadTodos(user, version))` and React's `<Suspense>` boundary handles the loading state.
- **No build step** for the connector itself — the workspace install links the local copy of `@next-model/local-storage-connector` and Vite's bundler handles the ESM imports.

The data lives in your browser's `localStorage` under `nm-todo:<user>:*` keys. Open DevTools → Application → Local Storage to inspect.

## What it deliberately doesn't show

- Cross-tab sync (the connector reads on every call, so adding a todo in one tab requires a refresh in another).
- Conflict resolution between concurrent writers — `localStorage` has no MVCC. Use a server-side connector if you need that.
