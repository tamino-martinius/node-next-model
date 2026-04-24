# @next-model/arktype

Bridge an [arktype](https://arktype.io) object type into a next-model `Model`'s `init` coercer, validator list, and schema-DSL columns.

```sh
pnpm add @next-model/arktype arktype
```

## Usage

```ts
import { Model, SqliteConnector } from '@next-model/core';
import { fromArkType } from '@next-model/arktype';
import { type } from 'arktype';

const UserType = type({
  name: 'string>=2',
  age: 'number.integer>=0',
  active: 'boolean',
  'nickname?': 'string',
  metadata: { source: 'string' },
});

const user = fromArkType(UserType);
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

`init` invokes the callable `type(value)` — on failure it throws `ValidationError` with `ArkErrors.summary`, the same human-readable multiline string arktype prints when you call `.throw()`.

## Mapping

| arktype source                  | column `kind` | notes                                    |
|---------------------------------|---------------|------------------------------------------|
| `'string'`                      | `string`      |                                          |
| `'string'` with `format: date(-time)?` | `datetime`   |                                          |
| `'number.integer'`              | `integer`     | detected via `divisor: 1`                |
| `'number'`                      | `float`       |                                          |
| `'boolean'`                     | `boolean`     | arktype represents this as `[{unit:false},{unit:true}]` |
| object literal / array types    | `json`        |                                          |
| literal unions (`'a' \| 'b'`)   | `string`      |                                          |
| anything else                   | `text`        | fallback                                 |

Optional keys (`'nickname?': '...'`) and nullable unions flow through as `null: true`.

## Caveats

- Only top-level keys of an object `type({...})` are introspected. Nested refinements still drive `init` + validation correctly but don't produce additional column definitions.
- Works against arktype 2.x. The bridge reads `type.json` (stable public API) rather than `type.internal`.
