# react-todo

React 19 + Vite demo of `@next-model/local-storage-connector` running entirely in the browser. No backend.

```sh
pnpm install
pnpm dev      # opens http://localhost:5173
pnpm build    # produces a static dist/
```

## What it shows

- **Two Models with a foreign key**: `User` (`id`, `name`) and `Task` (`id`, `userId`, `text`, `done`). Tasks belong to a user; deleting a user cascades (`Task.filterBy({ userId }).deleteAll()`).
- **User CRUD**: add, rename inline (double-click or pencil), delete (with confirm). The current user's tasks appear underneath.
- **Optimistic updates** (on by default; togglable in the UI). Mutations apply to local state immediately, then hit the connector; on failure the UI reverts and surfaces the error in a banner. Flip the toggle off to watch the alternative: mutations only show up after the connector round-trip returns.
- **Reactive checking / removal / creation** — the list is a `useState` array. Every mutation produces a state delta; the whole list never gets reloaded on a single toggle or add.
- **Interactive list items** — inline rename with Enter / Esc, double-click to edit, per-row buttons for toggle and delete.
- **Single shared connector** under the `nm-todo-v2:` prefix. Open DevTools → Application → Local Storage to inspect.

The initial boot creates the `users` and `tasks` tables (idempotent) and seeds three users (`ada`, `linus`, `dennis`) on a fresh install.

## What it deliberately doesn't show

- Cross-tab sync — `localStorage` doesn't push, so adding a task in one tab doesn't appear in another until you trigger a re-read. Use a server-side connector + WebSocket / SSE if you need that.
- Conflict resolution between concurrent writers — `localStorage` has no MVCC. This demo assumes a single tab writes at a time.
