# redis-node

End-to-end demo of `@next-model/redis-connector` against a real Redis 7.

## Run it

```sh
pnpm install
pnpm db:up           # docker compose up -d (redis on :6379)
pnpm start
pnpm db:down
```

`REDIS_URL` overrides the default (`redis://127.0.0.1:6379`).

## What it shows

- HASH-per-row + ZSET-of-ids storage layout (under a configurable `prefix`).
- JSON / array / Date round-trip cleanly through the per-field JSON encoding.
- `$like` filter — evaluated **client-side** by `MemoryConnector`'s pattern matcher (Redis can't express the full filter DSL natively).
- Snapshot `transaction(...)` — same semantics as the in-memory connector. Note that it's **not** Redis `MULTI/EXEC` and therefore not isolated against concurrent writers on the same prefix.

The demo wipes its key prefix at the start so it's safe to re-execute.
