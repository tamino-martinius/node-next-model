---
name: next-model-migrations
description: Connector-agnostic schema migration runner for `@next-model/migrations`. Provides a `Migrator` plus `SchemaCollector` typed-snapshot writer, supports `up`/`down` and Rails-style reversible `ChangeMigration` bodies, and emits `IrreversibleMigrationError` when an auto-inversion would be unsafe. Triggers include "schema migration runner", "rollback migrations", "alterTable migration", `defineAlter`, and any `next-model` schema versioning task.
license: MIT
metadata:
  author: tamino-martinius
  version: '1.0.0'
---

# next-model-migrations

Connector-agnostic schema migration runner for `@next-model/core`. Works with
every `@next-model/*` connector — `MemoryConnector`, `KnexConnector`
(sqlite/pg/mysql), `DataApiConnector`, `LocalStorageConnector`, the dedicated
`PostgresConnector` / `SqliteConnector` / `MysqlConnector` / `MariadbConnector`
families, or your own implementation. Migrations declare schema changes through
the core schema DSL (`connector.createTable(name, t => …)`); raw SQL is
available as an escape hatch via `connector.execute(sql, bindings)`. The runner
ships an opt-in dependency graph (`parent: string[]`), a `SchemaCollector`
wrapper that snapshots applied DDL, and supports both classic `up`/`down`
migrations and Rails-style reversible `change(connector)` bodies. Zero runtime
dependencies beyond `@next-model/core`.

## When to use

Any project that wants versioned schema changes against a `Connector` — service
backends, CLI tools, edge workers, browser apps using `LocalStorageConnector`,
or test fixtures backed by `MemoryConnector`. Reach for it when you want
`pending` / `applied` tracking, atomic per-migration transactions, and the
option to emit a typed `defineSchema(...)` artefact for downstream tooling.

## Install

```sh
pnpm add @next-model/migrations @next-model/core
# or: npm install @next-model/migrations @next-model/core
```

## Migration shape

Two flavours are exported from `@next-model/migrations`:

`UpDownMigration` — classic `up` / `down` pair (verbatim from the README):

```ts
import type { Migration } from '@next-model/migrations';

export const m_2026_04_24_create_users: Migration = {
  version: '20260424100000',
  async up(connector) {
    await connector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
      t.integer('age');
      t.timestamps();
    });
    await connector.createTable('user_emails', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.references('user', { column: 'user_id' });    // integer user_id + index on user_id
      t.string('email', { unique: true });
    });
  },
  async down(connector) {
    await connector.dropTable('user_emails');
    await connector.dropTable('users');
  },
};
```

`ChangeMigration` — Rails-style reversible body. The runner records every
schema mutation issued in `change(connector)` and replays the inverse on
`down()` automatically:

```ts
import type { ChangeMigration } from '@next-model/migrations';

export const m_2026_04_28_add_role: ChangeMigration = {
  version: '20260428080000',
  async change(connector) {
    await connector.alterTable('users', (t) => {
      t.addColumn('role', { type: 'string', default: 'member' });
      t.addIndex(['role']);
    });
  },
};
```

Both forms accept an optional `name` plus `parent?: string[]` to opt into the
dependency graph (see below).

## Migrator

```ts
import { Migrator } from '@next-model/migrations';
import { KnexConnector } from '@next-model/knex-connector';

import { m_2026_04_24_create_users } from './migrations/2026-04-24-create-users.js';
import { m_2026_04_28_add_role } from './migrations/2026-04-28-add-role.js';

const migrations = [m_2026_04_24_create_users, m_2026_04_28_add_role];

const migrator = new Migrator({
  connector: new KnexConnector({ client: 'pg', connection: process.env.DATABASE_URL }),
  // tableName: 'schema_migrations',  // default — identifier-validated
});

await migrator.init();
await migrator.migrate(migrations);
```

The `schema_migrations` tracking table is created on `init()`. Each `up`/`down`
runs inside `connector.transaction` so a thrown migration body is rolled back
atomically; the tracking row is only written after the body succeeds.

| Method | Purpose |
|--------|---------|
| `init()` | Create the tracking table. Idempotent. |
| `drop()` | Drop the tracking table (does **not** roll back applied migrations). |
| `appliedVersions()` | `string[]` — versions already applied, in order. |
| `appliedEntries()` | `{ version, name, appliedAt }[]` — same plus name and ISO timestamp. |
| `pending(migrations)` | Subset of `migrations` that have not been applied yet. |
| `status(migrations)` | `MigrationStatus[]` — one entry per provided migration with `{ version, name, isApplied, appliedAt?, parent? }`. |
| `migrate(migrations, opts?)` | Apply pending migrations in topological order. `opts.parallel = true` runs independent dependency waves concurrently. |
| `up(migration)` | Apply a single migration. Throws `MigrationAlreadyAppliedError` if it ran already. |
| `down(migration)` | Revert a single migration. Throws `MigrationNotAppliedError` if it never ran. |
| `rollback(migrations, steps?)` | Roll back the last `steps` (default 1) migrations in reverse topological order. |

`MigratorOptions` accepts `connector`, `tableName?`, and `schemaOutputPath?`
(see the SchemaCollector section).

## Reversible migrations

`ChangeMigration.change(connector)` is recorded by an internal
`RecordingConnector` and inverted automatically on `down()`. Inversion table:

| Forward op | Auto inverse |
|------------|--------------|
| `createTable` | `dropTable` |
| `addColumn` | `removeColumn` |
| `renameColumn(from, to)` | `renameColumn(to, from)` |
| `changeColumn` (with `previous` snapshot) | `changeColumn` restoring `previous` |
| `addIndex` | `removeIndex` |
| `renameIndex(from, to)` | `renameIndex(to, from)` |
| `addForeignKey` | `removeForeignKey` |
| `addCheckConstraint` | `removeCheckConstraint` |

Operations that are inherently irreversible — `dropTable`, `removeColumn`,
`removeIndex`, `removeForeignKey`, `removeCheckConstraint`, and `changeColumn`
without a `previous` snapshot — raise `IrreversibleMigrationError` when the
recorded body is replayed in reverse. Write explicit `up()` / `down()` for
those, or supply the missing inverse metadata.

## Schema mutations DSL

Inside `up` / `down` / `change` the connector exposes a `defineAlter`-style
builder via `connector.alterTable(name, (t) => …)`:

```ts
await connector.alterTable('users', (t) => {
  // columns
  t.addColumn('role', { type: 'string', default: 'member' });
  t.removeColumn('legacy');
  t.renameColumn('email', 'email_address');
  t.changeColumn('age', { type: 'integer', null: true }, { previous: { type: 'integer' } });

  // indexes
  t.addIndex(['email_address'], { unique: true });
  t.removeIndex(['legacy_idx']);
  t.renameIndex('users_email_idx', 'users_email_address_idx');

  // foreign keys
  t.addForeignKey('user_id', { references: { table: 'users', column: 'id' } });
  t.removeForeignKey('user_id');

  // check constraints
  t.addCheckConstraint('age_positive', 'age >= 0');
  t.removeCheckConstraint('age_positive');

  // references (column + index + FK in one step)
  t.addReference('account', { column: 'account_id' });
  t.removeReference('account');
});
```

Every op has a matching pair so explicit `up`/`down` migrations stay symmetric;
inside `change()` only the additive halves are safe to call without supplying
extra metadata.

## SchemaCollector

`SchemaCollector` wraps any `Connector`, forwards every call, and mirrors
`createTable` / `alterTable` / `dropTable` DDL into an in-memory snapshot.
After a migration run, serialise it to JSON for consumption by downstream
tooling (GraphQL / REST / OpenAPI generators, form builders, admin UIs) so you
don't have to re-declare each model's field set by hand.

```ts
import { Migrator, SchemaCollector, readSchemaFile } from '@next-model/migrations';
import { PostgresConnector } from '@next-model/postgres-connector';

const db = new PostgresConnector({ url: process.env.DATABASE_URL });
const tracked = new SchemaCollector(db);

const migrator = new Migrator({ connector: tracked });
await migrator.migrate(allMigrations);

tracked.writeSchema('./.schema/schema.json');

// Later, anywhere in the codebase:
const snapshot = await readSchemaFile('./.schema/schema.json');
console.log(snapshot.tables.users.columns);
// → [{ name: 'id', type: 'integer', primary: true, autoIncrement: true, nullable: false }, ...]
```

Set `schemaOutputPath` on the `Migrator` and after every successful `migrate()`
it writes a parseable TypeScript file with one `defineSchema(...)` per known
table. The connector must be wrapped in `SchemaCollector` (or otherwise expose
a `snapshot()` method) — a plain connector throws so the misconfiguration
surfaces immediately. The `schema_migrations` tracking table is filtered out
automatically. Only DDL changes issued via the schema DSL are captured — raw
SQL in `execute()` bypasses the collector by design.

## Dependency graph

Migrations may declare `parent?: string[]` to depend on one or more prior
versions:

```ts
export const m_2026_04_28_add_role: Migration = {
  version: '20260428080000',
  parent: ['20260424100000'],
  up: async (c) => { /* … */ },
  down: async (c) => { /* … */ },
};
```

When `parent` is omitted, the previous version in the sorted list becomes the
implicit parent (matching the historical sequential behaviour). An empty
`parent: []` marks a root node with no dependencies.

`Migrator` topologically sorts migrations before applying. Cycles raise
`MigrationCycleError`; a `parent` not present in the input list raises
`MigrationParentMissingError`. `migrate(migrations, { parallel: true })` runs
each topological wave via `Promise.all` so independent branches execute
concurrently. Sequential mode remains the default; `rollback` always runs in
reverse topological order regardless of mode.

Versions are sorted via `localeCompare` — zero-padded numeric strings
(`'20260424100000'`) and ISO-like timestamps both sort naturally.

## Errors

All errors inherit from `MigrationError`:

| Error | Raised when |
|-------|-------------|
| `MigrationAlreadyAppliedError` | `up(migration)` is called for a version already in `schema_migrations`. |
| `MigrationNotAppliedError` | `down(migration)` is called for a version not in `schema_migrations`. |
| `MigrationMissingError` | `rollback` cannot find a migration definition matching an applied version. |
| `MigrationParentMissingError` | A `parent` reference doesn't exist in the input migration list. |
| `MigrationCycleError` | The dependency graph has a cycle. |
| `IrreversibleMigrationError` | A `ChangeMigration` body uses an op that cannot be auto-inverted (`dropTable`, `removeColumn`, `removeIndex`, `removeForeignKey`, `removeCheckConstraint`, or bare `changeColumn`). |

## See also

- [`next-model-core`](../next-model-core/SKILL.md) — schema DSL, `defineSchema`, `Connector` interface.
- [`next-model-migrations-generator`](../next-model-migrations-generator/SKILL.md) — scaffold migration files.
- Connector skills: [`next-model-postgres-connector`](../next-model-postgres-connector/SKILL.md), [`next-model-mysql-connector`](../next-model-mysql-connector/SKILL.md), [`next-model-mariadb-connector`](../next-model-mariadb-connector/SKILL.md), [`next-model-sqlite-connector`](../next-model-sqlite-connector/SKILL.md), [`next-model-knex-connector`](../next-model-knex-connector/SKILL.md), [`next-model-aurora-data-api-connector`](../next-model-aurora-data-api-connector/SKILL.md), [`next-model-mongodb-connector`](../next-model-mongodb-connector/SKILL.md), [`next-model-redis-connector`](../next-model-redis-connector/SKILL.md), [`next-model-valkey-connector`](../next-model-valkey-connector/SKILL.md).
