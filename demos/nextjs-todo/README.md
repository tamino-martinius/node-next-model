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

Because you don't need one. Server components run on the server, the connector runs on the server, the database lives on the server — wrapping that round-trip in an HTTP API would just add a hop. Use `@next-model/express-rest-api` (coming in a follow-up PR) when something *outside* Next.js wants to talk to the same data.
