import { conformanceSchema, runModelConformance } from '@next-model/conformance';
import { KeyType } from '@next-model/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MariaDbConnector } from '../index.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://root:mariadb@127.0.0.1:3306/test';

const connector = new MariaDbConnector(DATABASE_URL);

afterAll(() => connector.destroy());

describe('MariaDbConnector', () => {
  it('runs raw SQL via execute', async () => {
    const rows = await connector.execute('SELECT 1 + 1 AS sum', []);
    expect(rows[0].sum).toBe(2);
  });

  it('counts an empty table at zero', async () => {
    const tableName = 'mariadb_smoke';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.count({ tableName })).toBe(0);
    await connector.dropTable(tableName);
  });

  it('returns inserted rows directly via RETURNING (no re-fetch round-trip)', async () => {
    const tableName = 'mariadb_returning';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    const rows = await connector.batchInsert(tableName, { id: 1 } as any, [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => typeof r.id === 'number')).toBe(true);
    await connector.dropTable(tableName);
  });

  it('updateAll still works (inherited SELECT-then-UPDATE)', async () => {
    const tableName = 'mariadb_update_inherited';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
      t.integer('age');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [
      { name: 'a', age: 1 },
      { name: 'b', age: 2 },
    ]);
    const updated = await connector.updateAll({ tableName }, { age: 99 });
    expect(updated.map((r) => r.age)).toEqual([99, 99]);
    await connector.dropTable(tableName);
  });

  it('deleteAll returns the deleted rows via RETURNING', async () => {
    const tableName = 'mariadb_delete_returning';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'a' }, { name: 'b' }]);
    const deleted = await connector.deleteAll({ tableName });
    expect(deleted.map((r) => r.name).sort()).toEqual(['a', 'b']);
    expect(await connector.count({ tableName })).toBe(0);
    await connector.dropTable(tableName);
  });

  it('rejects unsafe identifiers (inherited)', async () => {
    await expect(connector.query({ tableName: 'bad name; DROP' })).rejects.toThrow(
      /unsafe identifier/i,
    );
  });

  it('renders every supported column kind in createTable', async () => {
    const tableName = 'mariadb_kinds';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email', { unique: true, limit: 320, null: false });
      t.text('body');
      t.bigint('counter', { default: 0 });
      t.float('rate', { default: 1.5 });
      t.decimal('price', { precision: 12, scale: 4 });
      t.decimal('plain');
      t.boolean('active', { default: true });
      t.date('starts_on');
      t.datetime('happens_at');
      t.timestamp('seen_at', { default: 'currentTimestamp' });
      t.json('payload');
      t.index(['email'], { name: 'idx_mariadb_kinds_email' });
      t.index(['email', 'active'], { unique: true });
    });
    expect(await connector.hasTable(tableName)).toBe(true);
    await connector.dropTable(tableName);
  });

  it('enforces JSON_VALID on json columns', async () => {
    const tableName = 'mariadb_json_check';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.json('payload');
    });
    await expect(
      connector.batchInsert(tableName, { id: 1 } as any, [{ payload: 'not json' }]),
    ).rejects.toThrow();
    await connector.dropTable(tableName);
  });
});

// MariaDbConnector inherits `queryScoped` from `MysqlConnector` (the SQL
// surface and identifier quoting are identical). These tests verify the
// inherited path works against a real MariaDB server — the same shape
// every other SQL connector exercises in its own queryScoped suite.
describe('MariaDbConnector#queryScoped', () => {
  const usersTable = 'mariadb_qs_users';
  const todosTable = 'mariadb_qs_todos';
  const ordersTable = 'mariadb_qs_orders';

  beforeEach(async () => {
    if (await connector.hasTable(todosTable)) await connector.dropTable(todosTable);
    if (await connector.hasTable(usersTable)) await connector.dropTable(usersTable);
    if (await connector.hasTable(ordersTable)) await connector.dropTable(ordersTable);
    await connector.createTable(usersTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email');
      t.integer('age');
    });
    await connector.createTable(todosTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('userId');
      t.string('title');
    });
    await connector.createTable(ordersTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('total');
    });
  });

  afterEach(async () => {
    if (await connector.hasTable(todosTable)) await connector.dropTable(todosTable);
    if (await connector.hasTable(usersTable)) await connector.dropTable(usersTable);
    if (await connector.hasTable(ordersTable)) await connector.dropTable(ordersTable);
  });

  it('returns rows for a flat query (no parent scopes)', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
    ]);
    const rows = (await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: 'rows',
    })) as { email: string }[];
    expect(rows.map((r) => r.email).sort()).toEqual(['a@b', 'c@d']);
  });

  it('emits nested IN subquery for parentScopes (one statement)', async () => {
    const inserted = await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'alice@x', age: 18 },
      { email: 'bob@x', age: 21 },
    ]);
    const aliceId = inserted[0].id;
    const bobId = inserted[1].id;
    await connector.batchInsert(todosTable, { id: KeyType.number } as any, [
      { userId: aliceId, title: 'a-1' },
      { userId: aliceId, title: 'a-2' },
      { userId: bobId, title: 'b-1' },
    ]);

    const rows = (await connector.queryScoped({
      target: { tableName: todosTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: usersTable,
          parentKeys: { id: KeyType.number },
          parentFilter: { age: 18 },
          link: { parentColumn: 'id', childColumn: 'userId', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    })) as { title: string; userId: number }[];
    expect(rows.map((r) => r.title).sort()).toEqual(['a-1', 'a-2']);
    for (const row of rows) expect(row.userId).toBe(aliceId);
  });

  it('aggregate count returns total matching row count', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
      { email: 'e@f', age: 30 },
    ]);
    const result = await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'count' },
    });
    expect(result).toBe(3);
    expect(typeof result).toBe('number');
  });

  it('aggregate sum on a column returns the total', async () => {
    await connector.batchInsert(ordersTable, { id: KeyType.number } as any, [
      { total: 3 },
      { total: 4 },
      { total: 5 },
    ]);
    const result = await connector.queryScoped({
      target: { tableName: ordersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'sum', column: 'total' },
    });
    expect(result).toBe(12);
  });

  it('column projection plucks values', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
    ]);
    const result = (await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      order: [{ key: 'id' }],
      projection: { kind: 'column', column: 'email' },
    })) as string[];
    expect(result).toEqual(['a@b', 'c@d']);
  });
});

// MariaDbConnector inherits `reflectSchema` from `MysqlConnector` — MariaDB
// is wire-compatible with MySQL's `information_schema` views, so the same
// queries Just Work. This test verifies the inherited path works against
// a real MariaDB server.
describe('MariaDbConnector#reflectSchema (inherited)', () => {
  const tableName = 'mariadb_reflect_basic';

  afterEach(async () => {
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
  });

  it('round-trips a simple table created via createTable', async () => {
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('email', { limit: 320, null: false, unique: true });
      t.integer('count', { default: 0, null: false });
      t.boolean('active', { default: true, null: false });
      t.index(['email'], { name: 'idx_mariadb_reflect_email' });
    });
    const reflected = await connector.reflectSchema!();
    const table = reflected.find((r) => r.name === tableName);
    expect(table).toBeDefined();
    expect(table!.primaryKey).toBe('id');

    const id = table!.columns.find((c) => c.name === 'id')!;
    expect(id.primary).toBe(true);
    expect(id.autoIncrement).toBe(true);
    expect(id.type).toBe('integer');

    const email = table!.columns.find((c) => c.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.limit).toBe(320);
    expect(email.unique).toBe(true);

    const active = table!.columns.find((c) => c.name === 'active')!;
    expect(active.type).toBe('boolean');
    expect(active.default).toBe(true);
  });
});

runModelConformance({
  name: 'MariaDbConnector',
  makeConnector: () => new MariaDbConnector(DATABASE_URL, { schema: conformanceSchema }),
  teardown: async (c) => (c as MariaDbConnector).destroy(),
});
