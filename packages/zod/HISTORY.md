# History

## vNext

## v1.0.0

- Initial release. `fromZod(objectSchema)` returns `{ init, validators, applyColumns, describeColumns }` for use with the Model factory + schema DSL.
- `.optional()` / `.nullable()` → `null: true`; `.default(value)` → `default: value`.
- Class-name sniffing keeps the bridge working against both zod 3 and zod 4 without a peer-dep pin.
