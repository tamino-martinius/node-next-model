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

- Initial release. `fromArkType(objectType)` returns `{ init, validators, applyColumns, describeColumns }` — same surface as `@next-model/zod` and `@next-model/typebox`, backed by arktype 2.x.
- Reads arktype's stable public `type.json` projection so the bridge doesn't depend on internal APIs. Booleans (arktype emits `[{unit:false},{unit:true}]`) are detected and mapped to the `boolean` column kind; `number` with `divisor: 1` → `integer`.
- `init` surfaces arktype's `ArkErrors.summary` string as the `ValidationError` message.
