# nextjs-todo

Next.js 15 (App Router) demo of `@next-model/sqlite-connector` running entirely server-side. The user → tasks relationship lives in a shared on-disk sqlite file; React server components query it directly and server actions handle every mutation.

```sh
pnpm install
pnpm dev      # opens http://localhost:3000
pnpm build && pnpm start
```

## What it shows

- **Server components calling the connector directly** — `app/page.tsx` is an async component that does `await Task.filterBy({ userId }).all()` inline. No fetch, no API route in between.
- **Server actions** for every mutation (`addTask`, `toggleTask`, `deleteTask`, `setCurrentUser`). The page is automatically revalidated after each action via `revalidatePath('/')`.
- **Multi-user via cookie + foreign key** (`Task.userId → User.id`). The current user lives in a `nm-todo-user` cookie; switching is one server action call. Each user only sees their own tasks.
- **Connector lives on `globalThis`** so HMR reloads in `next dev` don't re-open the sqlite file every time.

The database file is created at `./.data/nextjs-todo.sqlite` on first run; delete it to start fresh.

## Why no API route?

Because you don't need one for this UI. Server components run on the server, the connector runs on the server, the database lives on the server — wrapping that round-trip in an HTTP API would just add a hop. When something *outside* Next.js needs to talk to the same data, use `@next-model/express-rest-api` or the sibling [`demos/nextjs/api`](../api) demo (which uses `@next-model/nextjs-api` to expose a REST resource from route handlers).

## Troubleshooting

`pnpm dev` can fail with a `NODE_MODULE_VERSION` mismatch on `better-sqlite3`:

```
The module 'better_sqlite3.node' was compiled against a different Node.js
version using NODE_MODULE_VERSION 141. This version of Node.js requires
NODE_MODULE_VERSION 127.
```

The cause is a prebuilt binding that targets a different Node ABI than the one you're running. From the repo root:

```sh
pnpm rebuild better-sqlite3
```

That re-runs `prebuild-install` / `node-gyp` against your current Node and drops a matching `.node` file into `better-sqlite3/build/Release/`. Switching Node versions (e.g. via `nvm use`) after an install will require a rebuild.
