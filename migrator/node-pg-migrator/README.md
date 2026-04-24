# Postgres Migrator

[![Build Status](https://travis-ci.org/tamino-martinius/node-pg-migrator.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-pg-migrator)
[![codecov](https://codecov.io/gh/tamino-martinius/node-pg-migrator/branch/master/graph/badge.svg)](https://codecov.io/gh/tamino-martinius/node-pg-migrator)

Migrations for [Postgres](https://www.npmjs.com/package/pg).

## Whats different in this package compared to most others?

- This package has 0 dependencies  - just postgres (pg) itself as peer dependency
- Support of parallel migrations when the dependent migrations are defined
- Ships with TypeScript types, commonJs (.js) and module exports (.mjs)
- Can be called by CLI or by programmatic access

## CLI

### Getting Help

`pg-migrator help`

Lists all commands.

`pg-migrator <command> help`

Lists command details and parameters.

**Parameters**

All commands with Database interactions allow all of the following Environment variables:

- `PGHOST` Host of postgres server
- `PGPORT` Port of postgres server
- `PGUSER` Username of postgres user
- `PGPASSWORD` Password of postgres user
- `PGDATABASE` Database Name

All commands use the `migrations` folder to locate migrations.
This can be changed with the `-f` or the `--folder` parameter.

The commands `up` and `down` also provide parameters to select a single migrations.

Use -n or --name to select migration by passing full filename without extension.
You can also use -v or --version to select migration by version (first part of filename).

### Create Migrations

Creates a new migration file prefixed with current timestamp to the `migrations` folder.
You can pass a different folder with the `-f` or `--folder` parameter.

`pg-commander create <name>`

### Migrate

Applies all pending migrations. The migrations will be applied in the order of the
version numbers ascending.

`pg-migrator migrate`

Applies/Rolls back just the selected migration.

`pg-migrator up`

`pg-migrator down`

### Create / Drop Database

Tries to create or drop the database.

`pg-migrator createDatabase`

`pg-migrator dropDatabase`

### Drop Table

Drops the migration table from the database.

`pg-migrator dropTable`

## Programmatic Access

### Migration

A migration is an object with the keys `version`, `parent`, `up` and `down`.
The `version` is a string which identifies the migration. The migrator saves these
in a separate table to check if an migration is already applied.

The methods `up` and `down` are async methods with the migration logic.
Both need to be present, but can be empty if not needed.
`up` contains the logic to apply the migration while `down` contains the logic
to undo the changed of the migration.

When `up` method creates a new table the method `down` should drop the table.

Migrations will be applied in the order as they are passed. Each migration will
wait until the previous is done, except you add the `parent` attribute.

`parent` is a array of version strings. The migrator will wait for all versions
named there to be finished. But once all dependent migrations are done the migration
will run instantly parallel to other migrations where all dependent migrations are
applied. The migration will be applied instantly when `parent` is an empty array.

~~~ts
const migration = [
  version: '201812312359',
  async up(client) {
    // ...
  },
  async down(client) {
    // ...
  },
]
~~~

### Create Migrator

The Migrator creates a table

~~~ts
// constructor(tableName?: string = 'migrations', poolConfig?: PoolConfig)
const migrator = new Migrator();

// migrate(migrations: Migration[]);
migrator.migrate([
  migration1,
  migration2,
  //...
]);
~~~

### Migrate

Pass an array of migrations and the migrator will skip all migrations which were already applied.
Pending migrations will be applied in parallel - if possible - depending on the dependent migrations.

~~~ts
// constructor(tableName?: string = 'migrations', poolConfig?: PoolConfig)
const migrator = new Migrator();

// migrate(migrations: Migration[]);
migrator.migrate([
  migration1,
  migration2,
  //...
]);
~~~

### Up / Down

Pass an single migration and the will apply or undo the migration depending on
the current status of the migration.

~~~ts
// constructor(tableName?: string = 'migrations', poolConfig?: PoolConfig)
const migrator = new Migrator();

// up(migration: Migration);
// down(migration: Migration);
migrator.up(migration);
migrator.down(migration);
~~~

### Create / Drop Database

The migrator also supports to create or drop a new database. The command will check
if the database is already existing and skip creation if database already exists.
On the other hand the drop of the database will be skipped when database is not existing.

~~~ts
// constructor(tableName?: string = 'migrations', poolConfig?: PoolConfig)
const migrator = new Migrator();

// createDatabase();
// dropDatabase();
migrator.createDatabase();
migrator.dropDatabase();
~~~

### Drop Table

Once a migration is applied the migrator will create a table to save the applied migrations.
This table can be dropped with the dropTable command.
~~~ts
// constructor(tableName?: string = 'migrations', poolConfig?: PoolConfig)
const migrator = new Migrator();

// dropTable();
migrator.dropTable();
~~~

## Changelog

See [history](HISTORY.md) for more details.

* `1.0.0` **2018-xx-xx** Initial release
