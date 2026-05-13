---
name: next-model-zod
description: Zod schema bridge for `@next-model/zod` — turns one zod object schema into a Model `init` coercer, `validators`, AND `createTable` columns at the same time. Trigger when the user says "zod model", "infer model from zod", "single source of truth for Model + DB schema", wants their existing zod schema to drive both run-time validation and DDL, or asks how to wire `fromZod(...)` into `Model({...})`.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# @next-model/zod

`@next-model/zod` bridges a [zod](https://zod.dev) object schema into the three places a next-model `Model` cares about: the `init` coercer that runs on construction, the validator list that gates `save()` / `isValid()`, and the schema-DSL columns consumed by `connector.createTable(...)`. One schema, three consumers — types, run-time checks, and DDL all stay in lockstep.

## When to use

- You already author your input/output contracts with zod and want a Model + table that mirror them.
- You want compile-time types, run-time validation, AND migration columns from a single `z.object({ ... })`.
- You need `init` coercion + `validators` to share the exact same rules with zero duplication.
- You want `createTable(...)` columns derived automatically so DDL never drifts from the parsed shape.

## When not to use

- You author schemas with [TypeBox](https://github.com/sinclairzx81/typebox) — use the `next-model-typebox` bridge.
- You author schemas with [arktype](https://arktype.io) — use the `next-model-arktype` bridge.
- You only have a plain TypeScript `interface` / type and don't need run-time checking — use `defineSchema({ table: { columns: {...} } })` from `@next-model/core` directly (see `next-model-core`).

## Install

```sh
pnpm add @next-model/zod zod
# or: npm install @next-model/zod zod
```

`zod` is a peer dependency. The bridge supports `zod@^3.23.0 || ^4.0.0` — Zod 3 and Zod 4 both work because the bridge uses class-name sniffing rather than `instanceof`, so a pinned major version isn't required.

## Quick start

```ts
import { defineSchema, Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';
import { fromZod } from '@next-model/zod';
import { z } from 'zod';

const UserSchema = z.object({
  name:     z.string().min(2),
  age:      z.number().int().nonnegative(),
  active:   z.boolean().default(true),
  metadata: z.object({ source: z.string() }).optional(),
});

const bridge = fromZod(UserSchema);

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
  init:       bridge.init,        // parses + throws ValidationError on failure
  validators: bridge.validators,  // same schema gates save() / isValid()
}) {}
```

`fromZod(schema)` returns `{ init, validators, applyColumns, toTypedColumns }`. Use `toTypedColumns()` to plug into `defineSchema`, and wire `init` + `validators` into `Model({...})`.

### Using `applyColumns` for migrations

`applyColumns(t)` is still useful inside `connector.createTable(...)` migration callbacks — the `defineTable` builder is imperative and operates independently from `defineSchema`:

```ts
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  bridge.applyColumns(t);   // adds name, age, active, metadata columns
});
```

## Type mapping

| zod type                                  | column `kind` | notes                                  |
|-------------------------------------------|---------------|----------------------------------------|
| `z.string()` / `z.enum()` / `z.literal()` | `string`      |                                        |
| `z.number().int()`                        | `integer`     | calls `.int()` are detected            |
| `z.number()`                              | `float`       | default numeric mapping                |
| `z.bigint()`                              | `bigint`      |                                        |
| `z.boolean()`                             | `boolean`     |                                        |
| `z.date()`                                | `datetime`    |                                        |
| `z.object()` / `z.array()` / `z.record()` | `json`        | serialized via the connector's JSON column |
| other (e.g. `z.union()`)                  | `text`        | fallback                               |

Wrappers are unwrapped before classification:

- `.optional()` / `.nullable()` → `null: true` on the column
- `.default(value)` → `default: value` + `null: true`

## Validators

The same zod schema that produces `init` also produces `validators`. Every `safeParse` failure surfaces as a Model `ValidationError`, so `min`, `max`, `regex`, `nonnegative`, `int`, `.refine(...)`, and any chained refinement / pre-check rides through to `save()` and `isValid()` without restating the rules. Nested object refinements / transformations still drive `init` + validation correctly even though they don't produce column definitions — the parse pipeline is the source of truth.

## Gotchas

- **Zod major version**: the bridge supports `zod@^3.23.0 || ^4.0.0`. Either major works because internals are sniffed by class name, not `instanceof`.
- **Only top-level fields become columns**: `applyColumns` introspects the top level of `z.object({ ... })`. Nested objects map to a single `json` column — they validate fine, but they don't expand into separate columns.
- **`.nullable()` vs `.optional()`**: both map to `null: true` on the column. If you need a column that's `NOT NULL` at the DDL level, leave the field required in the schema.
- **`.default(value)`**: produces `null: true` plus `default: value` on the column. The DB-level default and the parse-level default stay in sync.
- **Unsupported types**: anything that isn't recognized (e.g. `z.union()` of mixed primitives) falls back to a `text` column. Reach for an explicit `z.string()` / `z.enum()` if you want a sharper kind.

## See also

- `next-model-core` — the `Model({...})` factory, schema DSL, and `Connector` interface this bridge plugs into.
- `next-model-typebox` — same idea, but for TypeBox schemas.
- `next-model-arktype` — same idea, but for arktype schemas.
