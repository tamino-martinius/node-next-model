# History

## vNext

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.6 → 4.1.9, `@types/node` 25.9.0 → 25.9.3.

### Security

- Patched test-toolchain advisories via root `pnpm.overrides`: `ws` → `>=8.21.0` (GHSA-96hv-2xvq-fx4p) and `vite` → `>=8.0.16` (GHSA-fx2h-pf6j-xcff / GHSA-v6wh-96g9-6wx3), reached transitively through `vitest` / `happy-dom` (test-time only).

## v1.1.8

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

### Notes

- `redis` is kept at `^4.7.1` (Valkey is wire-compatible with Redis and uses `node-redis`). node-redis v5 is deferred pending the underlying `@next-model/redis-connector` migration.

## v1.1.2

### Changed

- `@next-model/core` moved from `devDependencies` to `peerDependencies` (`^1.1.1`).

## v1.0.0

### Native UPSERT
- Inherits `Connector.upsert(spec)` from `@next-model/redis-connector` (composed via SELECT-then-INSERT-or-UPDATE on the connector's own primitives — non-atomic by Redis/Valkey design).

### Initial release

- New `@next-model/valkey-connector` package: thin re-export of `@next-model/redis-connector` for apps targeting [Valkey](https://valkey.io/), the open-source fork of Redis.
- Currently identical behaviour to the Redis connector — Valkey is wire-compatible with the Redis protocol, so the same `node-redis` client, the same HASH-per-row + ZSET-of-ids storage layout, and the same client-side filter / aggregate / snapshot-transaction semantics apply.
- The package exists as its own publishable name so apps can pin `@next-model/valkey-connector` and pick up Valkey-specific overrides as they emerge (Valkey ≥ 8.x adds JSON / vector / clustering features that aren't part of the base Redis protocol).
- Validated through the shared `runModelConformance` suite against a real `valkey/valkey:8` service container in CI.
