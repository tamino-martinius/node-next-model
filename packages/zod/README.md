# @next-model/zod

Bridge a [zod](https://zod.dev) object schema into the three places a next-model `Model` cares about: the `init` coercer, the validator list, and the schema-DSL columns for `createTable`.

```sh
pnpm add @next-model/zod zod
# or: npm install @next-model/zod zod
```

## Usage

```ts
import { Model, SqliteConnector } from '@next-model/core';
import { fromZod } from '@next-model/zod';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(2),
  age: z.number().int().nonnegative(),
  active: z.boolean().default(true),
  metadata: z.object({ source: z.string() }).optional(),
});

const user = fromZod(UserSchema);
const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  init: user.init,              // parses + throws ValidationError on failure
  validators: user.validators,   // same schema gates save() / isValid()
}) {}

// Same schema drives the migration — no drift between parse-time types and
// the DDL that backs them.
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  user.applyColumns(t);         // adds name, age, active, metadata columns
});
```

## Mapping

| zod type                        | column `kind` | notes                                  |
|---------------------------------|---------------|----------------------------------------|
| `z.string()` / `z.enum()` / `z.literal()` | `string`      |                                        |
| `z.number().int()`              | `integer`     | calls `.int()` are detected            |
| `z.number()`                    | `float`       | default numeric mapping                |
| `z.bigint()`                    | `bigint`      |                                        |
| `z.boolean()`                   | `boolean`     |                                        |
| `z.date()`                      | `datetime`    |                                        |
| `z.object()` / `z.array()` / `z.record()` | `json`        | serialized via the connector's JSON column |
| other (e.g. `z.union()`)        | `text`        | fallback                               |

Wrappers are unwrapped before classification:

- `.optional()` / `.nullable()` → `null: true` on the column
- `.default(value)` → `default: value` + `null: true`

## Caveats

- Only top-level object fields of `z.object({ ... })` are introspected. Nested refinements / transformations still drive `init` + validation correctly but do not produce column definitions.
- Zod 3 and Zod 4 are both supported — the bridge uses class-name sniffing rather than `instanceof`, so a pinned major version isn't required.
