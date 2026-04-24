# NextModel demos

Self-contained scripts that show NextModel against each connector. Every demo is a single `demo.ts` runnable via Node's built-in TypeScript stripping (`node --experimental-strip-types`); no `tsx`, `ts-node`, or build step needed.

| Demo | Connector | Infra |
|---|---|---|
| [`memory-node`](./memory-node) | `@next-model/core` (`MemoryConnector`) | none |
| [`sqlite-node`](./sqlite-node) | `@next-model/sqlite-connector` | none (in-memory db) |
| [`local-storage-node`](./local-storage-node) | `@next-model/local-storage-connector` | none (uses an in-memory `localStorage` shim) |

> Demos backed by Postgres / MySQL / MariaDB / Redis / Valkey / MongoDB / Aurora Data API ship in follow-up PRs and bundle a `docker-compose.yml` per demo.

## Running a demo

```sh
cd demos/<name>
pnpm install        # workspace install — links to the local connector packages
pnpm start
```

`pnpm start` runs `node --experimental-strip-types demo.ts` against your locally-built copy of the connector. To pick up changes you make to the connector source, run `pnpm -r --filter @next-model/<that-connector> build` from the repo root first.

## Structure of each demo

- `demo.ts` — single entry point. Defines a `User` (and where it makes sense, a `Post`) Model, runs through CRUD, queries, transactions, prints results.
- `package.json` — workspace member, declares only the connector packages it actually uses.
- `README.md` — one-paragraph summary + the exact `pnpm start` invocation.
