---
name: next-model-arktype
description: arktype schema bridge for next-model — a single `@next-model/arktype` object type drives the Model's `init` coercer, `validators`, AND `createTable` columns. Triggers on "arktype model", "type-syntax schema", "single source of truth Model + DB", or any request to wire arktype into next-model.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# @next-model/arktype

`@next-model/arktype` is the arktype variant of the same three-consumer schema bridge that `@next-model/zod` provides. You author one arktype object `type({...})`, hand it to `fromArkType`, and a single result feeds three different next-model surfaces: `Model.init` (so attribute writes are coerced + validated), `Model.validators` (so `valid()` reflects the schema), and the schema-DSL `applyColumns(t)` callback (so `connector.createTable` derives column kinds and nullability from the same source of truth). It's the right choice when you already use arktype's TypeScript-style string syntax and want one schema, not three.

## When to use

- You are already using arktype 2.x in the project and want next-model to mirror its types.
- You prefer arktype's compact TS-style string syntax (`'string>=2'`, `'number.integer>=0'`) over zod's chained builders.
- You want one schema authored in arktype to drive both runtime validation AND your SQL/JSON column definitions.

## When not to use

- You are using zod — reach for `@next-model/zod` instead, which exposes the same shape (`init`, `validators`, `applyColumns`) for `z.object(...)`.
- You are using TypeBox — reach for `@next-model/typebox`.
- You only need column definitions and don't care about runtime validation — write the schema DSL directly.

## Install

```sh
pnpm add @next-model/arktype arktype
# or: npm install @next-model/arktype arktype
```

`arktype` is a peer dependency, pinned to `^2.0.0`. `@next-model/core` is the other peer.

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';
import { fromArkType } from '@next-model/arktype';
import { type } from 'arktype';

const UserType = type({
  name:       'string>=2',
  age:        'number.integer>=0',
  active:     'boolean',
  'nickname?': 'string',
  metadata:   { source: 'string' },
});

const bridge = fromArkType(UserType);

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      ...bridge.toTypedColumns(),   // name, age, active, nickname, metadata columns
    },
  },
});

const connector = new SqliteConnector(':memory:', { schema });

class User extends Model({
  connector,
  tableName: 'users',
  init:       bridge.init,
  validators: bridge.validators,
}) {}
```

`fromArkType(schema)` returns `{ init, validators, applyColumns, toTypedColumns }`. Use `toTypedColumns()` to plug into `defineSchema`, and wire `init` + `validators` into `Model({...})`. `init` invokes the callable `type(value)` — on failure it throws `ValidationError` with `ArkErrors.summary`, the same human-readable multiline string arktype prints when you call `.throw()`.

### Using `applyColumns` for migrations

`applyColumns(t)` is still useful inside `connector.createTable(...)` migration callbacks — the `defineTable` builder is imperative and operates independently from `defineSchema`:

```ts
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  bridge.applyColumns(t);
});
```

## Type mapping

| arktype source                         | column `kind` | notes                                                   |
|----------------------------------------|---------------|---------------------------------------------------------|
| `'string'`                             | `string`      |                                                         |
| `'string'` with `format: date(-time)?` | `datetime`    |                                                         |
| `'number.integer'`                     | `integer`     | detected via `divisor: 1`                               |
| `'number'`                             | `float`       |                                                         |
| `'boolean'`                            | `boolean`     | arktype represents this as `[{unit:false},{unit:true}]` |
| object literal / array types           | `json`        |                                                         |
| literal unions (`'a' \| 'b'`)          | `string`      |                                                         |
| anything else                          | `text`        | fallback                                                |

Optional keys (`'nickname?': '...'`) and nullable unions flow through as `null: true`.

## Validators

Every constraint in the arktype schema becomes a Model validator at the call to `fromArkType`. When you assign an attribute or call `record.valid()`, next-model runs the same arktype check that the `init` coercer uses, so:

- Refinements like `'string>=2'` or `'number.integer>=0'` reject invalid writes.
- Optional keys are allowed to be missing/undefined.
- Nullable unions accept `null`.
- Failures surface as `ValidationError` carrying arktype's `ArkErrors.summary` — the same multiline text you would get from `.throw()`.

## Gotchas

- **Only top-level keys are introspected** for `applyColumns`. Nested object refinements still drive `init` and validation correctly, but they don't produce additional column definitions — they collapse into the parent's `json` column.
- **arktype version**: built against arktype 2.x. The bridge reads the stable public `type.json` representation, not `type.internal`, so 2.x minor bumps are safe but 1.x is not supported.
- **Optionals vs nullable**: arktype's `'key?'` (optional key) and unions with `null` both flow through as `null: true` on the column. If you need "required but nullable" vs "optional and present", express that in arktype itself — the bridge can't reconstruct intent the schema didn't capture.
- **Narrowed string unions** (`'a' | 'b'`) become a plain `string` column — the union arms are not enforced at the DB level, only by the validator.

## See also

- `next-model-core` — the underlying Model + schema-DSL primitives `fromArkType` plugs into.
- `next-model-zod` — same bridge shape for zod schemas.
- `next-model-typebox` — same bridge shape for TypeBox schemas.
