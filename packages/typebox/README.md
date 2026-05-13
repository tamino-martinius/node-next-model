# @next-model/typebox

Bridge a [TypeBox](https://github.com/sinclairzx81/typebox) `TObject` into a next-model `Model`'s `init` coercer, validator list, and schema-DSL columns.

```sh
pnpm add @next-model/typebox @sinclair/typebox
# or: npm install @next-model/typebox @sinclair/typebox
```

## Usage

```ts
import { Model, SqliteConnector } from '@next-model/core';
import { fromTypeBox } from '@next-model/typebox';
import { Type } from '@sinclair/typebox';

const UserSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  age: Type.Integer({ minimum: 0 }),
  active: Type.Boolean({ default: true }),
  metadata: Type.Optional(Type.Object({ source: Type.String() })),
});

const user = fromTypeBox(UserSchema);
const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  init: user.init,
  validators: user.validators,
}) {}

await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  user.applyColumns(t);
});
```

`init` runs `Value.Default(...)` first so defaulted fields are filled in before validation, then throws `ValidationError` with a newline-separated error summary on any `Value.Check` failure.

## Mapping

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

Wrappers/modifiers:

- `Type.Optional(...)` or absence from `required` → `null: true`
- `Type.Union([X, Type.Null()])` → `null: true`, kind inferred from `X`
- `{ default: value }` on the schema → `default: value` + `null: true`

## Caveats

- Only the top-level properties of `Type.Object({ ... })` are introspected. Nested refinements still drive `init` + validation correctly but don't produce additional column definitions.
- Works against TypeBox 0.34+. Older versions predate `Value.Default` + stable `Value.Errors` paths.
