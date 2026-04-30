---
name: next-model-typebox
description: TypeBox schema bridge for next-model — `@next-model/typebox` turns one TypeBox `TObject` into a Model's `init` coercer, `validators` list, AND `createTable` columns. Triggers on "TypeBox model", "JSON Schema model", or "single source of truth Model + DB" when the project already uses `@sinclair/typebox`.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

## Overview

`@next-model/typebox` is the TypeBox variant of `@next-model/zod`: the same three-consumer bridge, but driven by a TypeBox `TObject` instead of a Zod object schema. A single `Type.Object({...})` definition feeds the Model's `init` (coercion + defaults), its `validators`, and the schema-DSL columns passed to `connector.createTable`. One source of truth covers runtime input, validation, and DDL — without writing a separate column list, validator array, or default-applier.

## When to use

- The project already uses TypeBox for request/response schemas, OpenAPI generation, or JSON Schema interop, and you want next-model Models that match those schemas exactly.
- You want a JSON-Schema-shaped source of truth (TypeBox emits standard JSON Schema) and need it to also drive your database columns.
- You'd otherwise hand-write `init`, `validators`, AND a `createTable` column list for the same shape.

## When not to use

- The project uses Zod — use `@next-model/zod` so the bridge speaks the same dialect as the rest of the schemas.
- The project uses ArkType — use `@next-model/arktype` instead.
- You need column definitions for nested objects' inner fields. The bridge only introspects top-level properties (see Gotchas).

## Install

```sh
pnpm add @next-model/typebox @sinclair/typebox
# or: npm install @next-model/typebox @sinclair/typebox
```

Peer dependency: `@sinclair/typebox` `^0.34.0` (needs `Value.Default` and stable `Value.Errors` paths). `@next-model/core` is also a peer.

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';
import { fromTypeBox } from '@next-model/typebox';
import { Type } from '@sinclair/typebox';

const UserSchema = Type.Object({
  name:     Type.String({ minLength: 2 }),
  age:      Type.Integer({ minimum: 0 }),
  active:   Type.Boolean({ default: true }),
  metadata: Type.Optional(Type.Object({ source: Type.String() })),
});

const bridge = fromTypeBox(UserSchema);

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      ...bridge.toTypedColumns(),   // name, age, active, metadata columns
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

`fromTypeBox(schema)` returns `{ init, validators, applyColumns, toTypedColumns }`. Use `toTypedColumns()` to plug into `defineSchema`, and wire `init` + `validators` into `Model({...})`.

### Using `applyColumns` for migrations

`applyColumns(t)` is still useful inside `connector.createTable(...)` migration callbacks — the `defineTable` builder is imperative and operates independently from `defineSchema`:

```ts
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  bridge.applyColumns(t);
});
```

## Type mapping

| TypeBox schema                              | column `kind` | notes                                   |
|---------------------------------------------|---------------|-----------------------------------------|
| `Type.String()`                             | `string`      |                                         |
| `Type.String({ format: 'date(-time)?' })`   | `datetime`    |                                         |
| `Type.Integer()`                            | `integer`     |                                         |
| `Type.Number()`                             | `float`       |                                         |
| `Type.Boolean()`                            | `boolean`     |                                         |
| `Type.Object()` / `Type.Array()`            | `json`        |                                         |
| `Type.Union([Type.Literal(...), ...])`      | `string`      | falls back to enum-style coercion       |
| anything else                               | `text`        | fallback                                |

Wrappers and modifiers:

- `Type.Optional(...)` or absence from `required` → `null: true`
- `Type.Union([X, Type.Null()])` → `null: true`, kind inferred from `X`
- `{ default: value }` on the schema → `default: value` + `null: true`

## Validators

`init` runs `Value.Default(...)` first so defaulted fields are filled in before validation, then runs `Value.Check`. If `Value.Check` fails, `init` throws `ValidationError` with a newline-separated summary of the `Value.Errors` paths and messages. Anything TypeBox can express as a JSON Schema constraint — `minLength`, `minimum`, `format`, `pattern`, union membership, nested shapes — is enforced automatically without writing a separate validator function.

## Gotchas

- **`Type.Optional` vs nullability.** Optional in TypeBox means "may be absent" — the bridge maps that to `null: true` on the column. If you actually want a non-null column with a default, give the field a `default` instead of wrapping it with `Type.Optional`. To get a true nullable column without making the field optional, use `Type.Union([X, Type.Null()])`.
- **`format` keywords drive column kind.** Only `format: 'date'` and `format: 'date-time'` upgrade `Type.String()` to `datetime`. Other formats (`uuid`, `email`, `uri`, ...) still validate at `init` time but stay `string` columns — set the column kind manually if you need something different.
- **Top-level only.** Only the top-level properties of the outer `Type.Object({ ... })` are introspected for columns. Nested `Type.Object` / `Type.Array` are stored as `json` columns; their inner fields still drive `init` coercion and validation but don't produce additional columns.
- **TypeBox version.** Requires TypeBox 0.34+. Older versions predate `Value.Default` and the stable `Value.Errors` paths the bridge relies on.

## See also

- `next-model-core` — the Model + connector + schema DSL the bridge plugs into.
- `next-model-zod` — same bridge, Zod flavor. Pick this when the project speaks Zod.
- `next-model-arktype` — same bridge, ArkType flavor. Pick this when the project speaks ArkType.
