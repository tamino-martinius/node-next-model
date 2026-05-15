# @next-model/sqlite-connector

Native SQLite connector for [`@next-model/core`](../core), built directly on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3). No Knex, no extra query-builder layer.

## When to pick this over `@next-model/knex-connector`

- You target SQLite only and don't need the multi-driver flexibility Knex provides.
- You want the synchronous, near-zero-overhead `better-sqlite3` driver under the hood.
- You don't want to ship Knex (smaller dep footprint).

If you also need MySQL / Postgres / MariaDB / MSSQL too, keep `@next-model/knex-connector`.

## Installation

```sh
pnpm add @next-model/core @next-model/sqlite-connector better-sqlite3
# or: npm install @next-model/core @next-model/sqlite-connector better-sqlite3
```

`@next-model/core` is declared as a `peerDependency` so consumers control the exact core version. Install it alongside the connector — pnpm and npm both warn at install time if it's missing.

## Constructing the connector

```ts
import { SqliteConnector } from '@next-model/sqlite-connector';

// In-memory (default)
const c1 = new SqliteConnector();
const c2 = new SqliteConnector(':memory:');

// File-backed
const c3 = new SqliteConnector('./data/app.sqlite');

// With better-sqlite3 options
const c4 = new SqliteConnector({
  filename: './data/app.sqlite',
  options: { fileMustExist: true, readonly: false },
});

// Programmatic shutdown (tests, scripts)
c1.destroy();
```

The underlying handle is exposed as `connector.db` if you need raw access.

### Attaching a typed schema

Pass a `DatabaseSchema` (from `defineSchema(...)`) as the optional second argument so `Model({ connector, tableName: 'users' })` can infer per-table props at the type level:

```ts
import { defineSchema } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string' },
    },
  },
});

const connector = new SqliteConnector(':memory:', { schema });
```

The `extras: { schema }` arg is purely a type-level decoration — the runtime contract is unchanged, and existing constructor call sites without a schema keep working.

### Materialising tables with `ensureSchema()`

Once a schema is attached, `connector.ensureSchema()` walks every declared table and creates any that don't already exist. It's idempotent — call it on every app boot:

```ts
const connector = new SqliteConnector('./data/app.sqlite', { schema });
const { created, existing } = await connector.ensureSchema();
// first boot:  { created: ['users', 'posts', ...], existing: [] }
// later boots: { created: [], existing: ['users', 'posts', ...] }
```

Calling `ensureSchema()` without a schema throws — pass `{ schema }` at construction.

## Wiring a Model

```ts
import { Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

const connector = new SqliteConnector('./data/app.sqlite');

class User extends Model({
  tableName: 'users',
  connector,
  init: (props: { name: string; age: number }) => props,
}) {}
```

## Feature → connector specifics

### Identifiers

All identifiers are quoted with `"…"`. Identifiers are validated against `^[A-Za-z_][A-Za-z0-9_]*$` before quoting; anything else throws `PersistenceError` to keep injection vectors closed. camelCase columns (`createdAt`, `discardedAt`, …) round-trip without renaming.

### Filter operators

| Filter | SQL produced |
|--------|--------------|
| `{ name: 'Ada' }` | `"name" = ?` |
| `{ $or: [a, b] }` | `(…) OR (…)` |
| `{ $not: f }`     | `NOT (…)` |
| `{ $in: { col: [...] } }`  | `"col" IN (?, ?, …)` |
| `{ $notIn: { col: [...] } }` | `"col" NOT IN (…)` |
| `{ $null: 'col' }` | `"col" IS NULL` |
| `{ $notNull: 'col' }` | `"col" IS NOT NULL` |
| `{ $between: { col: { from, to } } }` | `"col" BETWEEN ? AND ?` |
| `{ $gt / $gte / $lt / $lte: { col: v } }` | `"col" > ?` etc. |
| `{ $like: { col: 'pat%' } }` | `"col" LIKE ?` (SQLite is case-insensitive for ASCII by default). |
| `{ $raw: { $query: 'col = ?', $bindings: [v] } }` | The raw fragment is wrapped in `(...)`; bindings are appended in order. |
| `{ $async: Promise<Filter> }` | Resolved by Model before reaching the connector — passing one directly raises `FilterError`. |

### `orderBy` shapes

Both the strict `{ key, dir }` shape and the conventional `{ [col]: 'asc' | 'desc' }` shape are normalised before SQL is built. Either produces the same `ORDER BY "col" ASC|DESC` fragment, so callers can pick whichever reads better:

```ts
await User.orderBy({ key: 'createdAt', dir: SortDirection.Desc }).all();
await User.orderBy({ createdAt: 'desc' }).all();   // same query
```

### Parameter coercion

`Date` and `boolean` bindings are normalised at the boundary:

- `Date` → ISO 8601 string (`new Date().toISOString()`).
- `boolean` → `1` / `0`.

This lets you pass JS-native values directly through Model.

### Boolean read-side coercion

SQLite has no native boolean kind; `better-sqlite3` returns 0 / 1 as `INTEGER` for any column declared `boolean`. When a schema is attached to the connector, columns declared `{ type: 'boolean' }` are coerced back to `true` / `false` on every read — strict identity (`=== true` / `=== false`) works without a `Boolean(...)` wrapper.

```ts
const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      isAdmin: { type: 'boolean', null: false },
    },
  },
});
const c = new SqliteConnector(':memory:', { schema });
await c.ensureSchema();
await c.batchInsert('users', { id: 1 } as any, [{ isAdmin: true }]);
const [row] = await c.query({ tableName: 'users' });
row.isAdmin === true; // ← was `row.isAdmin === 1` before
```

The coercion only kicks in when an actual schema is attached. Existing call sites that use `new SqliteConnector(':memory:')` with no schema (or run against pre-existing tables that were never declared through `defineSchema`) keep reading raw `0` / `1` INTEGER, so older code that compared columns with `=== 1` continues to compile and work — only the new schema-driven path opts into strict booleans.

`null` and any non-`0`/`1` integer value passes through unchanged.

### `execute(query, bindings)`

Wraps `db.prepare(sql).all(...params)`. Bindings can be a single value or an array.

### Transactions

`connector.transaction(fn)` issues raw `BEGIN`, then either `COMMIT` (success) or `ROLLBACK` (throw). Re-entrant `transaction` calls join the outer transaction — there are no savepoints, so an inner throw rolls back the whole outer transaction.

### `batchInsert`

A single multi-row `INSERT … RETURNING *` (SQLite ≥ 3.35, included with the version `better-sqlite3` ships). Items contributing different sets of columns are unioned.

### `updateAll` / `deleteAll`

Both use `RETURNING *` so the affected rows are returned in one round-trip. `LIMIT` / `OFFSET` from the scope are deliberately ignored — SQLite refuses both on `DELETE`/`UPDATE` (without `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`).

### Schema DSL → SQL DDL

| Core DSL                         | SQLite                       |
|----------------------------------|------------------------------|
| `t.integer('id', { autoIncrement: true })` | `"id" INTEGER PRIMARY KEY AUTOINCREMENT` |
| `t.string('name', { limit: 64 })` | `"name" VARCHAR(64)`        |
| `t.string('name')`               | `"name" TEXT`                |
| `t.text('body')`                 | `"body" TEXT`                |
| `t.integer('n')` / `t.bigint('n')` | `"n" INTEGER`              |
| `t.float('rate')`                | `"rate" REAL`                |
| `t.decimal('p', { precision, scale })` | `"p" NUMERIC(p, s)`     |
| `t.boolean('flag')`              | `"flag" INTEGER` (0 / 1)     |
| `t.date / t.datetime / t.timestamp / t.json` | `TEXT` (SQLite has no native types — values are coerced to strings on insert and stored verbatim) |

`{ default: 'currentTimestamp' }` becomes `DEFAULT CURRENT_TIMESTAMP`. `t.index([col], { unique })` issues a follow-up `CREATE [UNIQUE] INDEX … ON tbl (col)` after the table create. `dropTable` uses `DROP TABLE IF EXISTS`.

## Electron integration

`@next-model/sqlite-connector` works inside an Electron renderer when the renderer can `require` Node modules (typically `nodeIntegration: true`, `contextIsolation: false` or via a preload bridge). This section documents the wiring that surfaced repeatedly during downstream integration.

### Main-process side (BrowserWindow + preload)

```ts
// electron-main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // The simplest configuration when you want `better-sqlite3` to load in
      // the renderer with a real Node `require`. If you keep
      // `contextIsolation: true`, route the connector through the main
      // process via IPC instead — `better-sqlite3` cannot cross the
      // structured-clone boundary.
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  win.loadFile('dist/index.html');
});
```

### Preload bridge under `contextIsolation: false`

`contextBridge.exposeInMainWorld(...)` is a no-op when `contextIsolation` is false — it only populates `window` inside the isolated world. Under `contextIsolation: false` you must assign directly:

```ts
// preload.cjs
const { ipcRenderer } = require('electron');

// Direct assignment — works under contextIsolation: false.
// `contextBridge.exposeInMainWorld` would NOT populate `window` here.
window.leitn = {
  paths: {
    appData: () => ipcRenderer.invoke('paths:appData'),
  },
};
```

### Vite renderer config

Renderer bundlers (Vite, Webpack, …) don't know how to bundle the native
`better-sqlite3` binding. Exclude both `better-sqlite3` and
`@next-model/sqlite-connector` from optimization and rewrite the
`better-sqlite3` import to a runtime `require()` so the renderer pulls
the Node module from disk at boot:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['better-sqlite3', '@next-model/sqlite-connector'],
  },
  plugins: [
    {
      name: 'better-sqlite3-require-shim',
      enforce: 'pre',
      // Rewrite `import Database from 'better-sqlite3'` so the renderer
      // resolves the native binding through Node's `require()` at runtime
      // instead of letting Vite try to bundle the .node binary.
      transform(code, id) {
        if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return null;
        if (!code.includes("from 'better-sqlite3'")) return null;
        return code.replace(
          /import\s+(\w+)\s+from\s+'better-sqlite3'/g,
          "const $1 = window.require('better-sqlite3')",
        );
      },
    },
  ],
});
```

A future `@next-model/sqlite-connector/vite` entrypoint may ship this transform out of the box — for this release we document the snippet.

### Renderer bootstrap

The renderer typically wants to mount the React tree only after the connector exists and the schema is materialised. Top-level `await` works in modern bundlers; the bootstrap chain looks like:

```ts
// renderer/main.tsx
import { createRoot } from 'react-dom/client';
import { SqliteConnector } from '@next-model/sqlite-connector';
import { schema } from './db/schema';
import { App } from './App';

// `window.require('fs')` instead of `import 'node:fs'` — Vite stubs the
// `node:fs` builtin in the renderer bundle and crashes at runtime.
const fs = window.require('fs');
const appData: string = await window.leitn.paths.appData();
fs.mkdirSync(appData, { recursive: true });
const dbPath = `${appData}/app.sqlite`;

const connector = new SqliteConnector(dbPath, { schema });
await connector.ensureSchema();

createRoot(document.getElementById('root')!).render(<App connector={connector} />);
```

The two gotchas worth calling out:

- `node:fs` is stubbed in the renderer bundle; reach for `window.require('fs')` for any renderer-side filesystem work.
- Always `await connector.ensureSchema()` before mounting the tree — Model reads issued before tables exist surface as opaque `no such table: …` errors deep inside `useSyncExternalStore` consumers.

## Testing matrix

The shared `runModelConformance` suite (every Model feature) runs against an in-memory database every commit — no service container required.

```sh
pnpm --filter @next-model/sqlite-connector test
```

## Changelog

See [`HISTORY.md`](./HISTORY.md).
