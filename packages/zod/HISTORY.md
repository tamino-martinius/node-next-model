# History

## vNext

## v1.2.0

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.6 → 4.1.9, `@types/node` 25.9.0 → 25.9.3.

### Security

- Patched test-toolchain advisories via root `pnpm.overrides`: `ws` → `>=8.21.0` (GHSA-96hv-2xvq-fx4p) and `vite` → `>=8.0.16` (GHSA-fx2h-pf6j-xcff / GHSA-v6wh-96g9-6wx3), reached transitively through `vitest` / `happy-dom` (test-time only).

## v1.1.8

### Changed

- Bumped dev deps: `zod` 4.3.6 → 4.4.3, `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.0.0

- Initial release. `fromZod(objectSchema)` returns `{ init, validators, applyColumns, describeColumns }` for use with the Model factory + schema DSL.
- `.optional()` / `.nullable()` → `null: true`; `.default(value)` → `default: value`.
- Class-name sniffing keeps the bridge working against both zod 3 and zod 4 without a peer-dep pin.
