# valkey-node

End-to-end demo of `@next-model/valkey-connector` against a real Valkey 8.

## Run it

```sh
pnpm install
pnpm db:up           # docker compose up -d (valkey on :6379)
pnpm start
pnpm db:down
```

`VALKEY_URL` overrides the default (`redis://127.0.0.1:6379` — Valkey is wire-compatible with the Redis protocol, so the URL scheme is unchanged).

## What it shows

Functionally identical to the `redis-node` demo. The package exists so apps that target Valkey can express that in their `package.json`; future Valkey-only features will land in the connector without bloating the Redis one.
