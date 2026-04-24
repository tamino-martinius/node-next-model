# local-storage-node

Plain Node demo of `@next-model/local-storage-connector`. The connector is built for the browser; this demo runs it in Node by handing it a tiny in-memory `Storage` shim so you can see the same behaviour without booting Chrome.

```sh
pnpm install
pnpm start
```

What it shows:

- Constructing `LocalStorageConnector` with an injected `localStorage`-shaped object
- `prefix` keeps multiple stores side-by-side without collision
- `$like` filter (uses MemoryConnector's pattern matcher, not SQL `LIKE`)
- Snapshot transactions (rollback on throw) — the same semantics you get in the browser
