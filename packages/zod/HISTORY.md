# History

## vNext

### Changed

- Bumped dev deps: `zod` 4.3.6 → 4.4.3, `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.1.7

## v1.1.6

## v1.1.5

## v1.1.4

## v1.1.2

## v1.1.1

## v1.1.0

## v1.0.0

- Initial release. `fromZod(objectSchema)` returns `{ init, validators, applyColumns, describeColumns }` for use with the Model factory + schema DSL.
- `.optional()` / `.nullable()` → `null: true`; `.default(value)` → `default: value`.
- Class-name sniffing keeps the bridge working against both zod 3 and zod 4 without a peer-dep pin.
