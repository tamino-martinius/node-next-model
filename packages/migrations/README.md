# @next-model/migrations

Connector-agnostic schema migration runner for [`@next-model/core`](../core).

Works with any `Connector` — `MemoryConnector`, `KnexConnector` (sqlite/pg/mysql), `DataApiConnector`, `LocalStorageConnector`, or your own. Migrations declare schema changes through the core schema DSL (`connector.createTable(name, t => …)`); raw SQL is available as an escape hatch via `connector.execute(sql, bindings)`.

Zero runtime dependencies beyond `@next-model/core`. Connector packages are consumed only at test time.

## Installation

```sh
pnpm add @next-model/migrations @next-model/core
```

## A migration

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
      t.integer('user_id');
      t.string('email', { unique: true });
      t.index(['user_id']);
    });
  },
  async down(connector) {
    await connector.dropTable('user_emails');
    await connector.dropTable('users');
  },
};
```

## Running migrations

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

The `schema_migrations` tracking table is created on `init()`. Each `up`/`down` runs inside `connector.transaction` so a thrown migration body is rolled back atomically; the tracking row is only written after the body succeeds.

## Public API

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

## Dependency graph

Migrations may declare `parent?: string[]` to depend on one or more prior versions:

```ts
export const m_2026_04_28_add_role: Migration = {
  version: '20260428080000',
  parent: ['20260424100000'],
  up: async (c) => { /* … */ },
  down: async (c) => { /* … */ },
};
```

When `parent` is omitted, the previous version in the sorted list becomes the implicit parent (matching the historical sequential behaviour). An empty `parent: []` marks a root node with no dependencies.

`Migrator` topologically sorts migrations before applying:

- Cycles raise `MigrationCycleError`.
- A `parent` not present in the input list raises `MigrationParentMissingError`.

`migrate(migrations, { parallel: true })` runs each topological wave via `Promise.all`, so independent branches execute concurrently. Sequential mode remains the default. `rollback` always runs in reverse topological order regardless of mode.

## Versioning

Versions are sorted via `localeCompare` — zero-padded numeric strings (`'20260424100000'`) and ISO-like timestamps both sort naturally.

## Errors

All errors inherit from `MigrationError`:

| Error | Raised when |
|-------|-------------|
| `MigrationAlreadyAppliedError` | `up(migration)` is called for a version already in `schema_migrations`. |
| `MigrationNotAppliedError` | `down(migration)` is called for a version not in `schema_migrations`. |
| `MigrationMissingError` | `rollback` cannot find a migration definition matching an applied version. |
| `MigrationParentMissingError` | A `parent` reference doesn't exist in the input migration list. |
| `MigrationCycleError` | The dependency graph has a cycle. |

## Machine-readable schema snapshots (`SchemaCollector`)

`SchemaCollector` wraps any `Connector`, forwards every call, and mirrors `createTable` / `dropTable` DDL into an in-memory snapshot. After a migration run, serialise it to JSON for consumption by downstream tooling (GraphQL / REST / OpenAPI generators, form builders, admin UIs) so you don't have to re-declare each model's field set by hand.

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

The snapshot payload:

```ts
interface SchemaSnapshot {
  version: 1;                              // bumped on layout changes
  generatedAt: string;                     // ISO-8601
  tables: Record<string, TableDefinition>;
}
```

`TableDefinition` is the same `{ name, columns, indexes, primaryKey? }` shape `@next-model/core`'s schema DSL produces via `defineTable(name, blueprint)`. Rollbacks (`migrator.rollback`) drop tables from the snapshot when their migration runs `connector.dropTable(...)`, so the file always reflects what's currently applied.

Only DDL changes issued via the schema DSL are captured — raw SQL in `execute()` bypasses the collector by design.

## Changelog

See [`HISTORY.md`](./HISTORY.md).
