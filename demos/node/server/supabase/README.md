# supabase

Plain Node demo of `@next-model/supabase-connector` against the in-tree `MockSupabaseClient` — no Supabase project or network access required.

```sh
pnpm install
pnpm start
```

## What it shows

- The connector speaks PostgREST regardless of whether it's backed by a real Supabase project or a mock: in production you'd hand it a `@supabase/supabase-js` client (or `{ url, key }`); locally it's `MockSupabaseClient` (exposed at `@next-model/supabase-connector/mock-client`) which executes the same PostgREST-shaped calls against an in-memory sqlite database.
- Same `Model({...})` declaration, same filters / aggregates as every other connector.
- A one-line swap moves the demo from the local mock to a real Supabase project:

  ```ts
  const connector = new SupabaseConnector({
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_KEY!,
  });
  ```

  Server code typically uses the `service_role` key; browser code uses the `anon` key — only the client/key differs, the connector code stays the same.

The demo provisions the `users` table on the mock client directly (`client.exec(...)`), since DDL is not part of the connector's supported surface — real Supabase projects manage schema via migrations instead.
