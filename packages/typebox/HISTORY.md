# History

## vNext

### Changed

- Bumped dev deps: `vitest` / `@vitest/coverage-v8` 4.1.5 → 4.1.6, `@types/node` 25.6.0 → 25.9.0.

## v1.1.7

## v1.1.6

## v1.1.5

## v1.1.4

## v1.1.2

## v1.1.1

## v1.1.0

## v1.0.0

- Initial release. `fromTypeBox(objectSchema)` returns `{ init, validators, applyColumns, describeColumns }` mirroring `@next-model/zod`. `init` applies `Value.Default` + `Value.Check` and throws `ValidationError` with a formatted `Value.Errors` summary.
- Maps TypeBox primitives to schema-DSL kinds; `Type.String({ format: 'date-time' })` → `datetime`; `Union([X, Null])` and `Type.Optional(...)` → `null: true`.
