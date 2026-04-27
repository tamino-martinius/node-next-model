import { runModelConformance } from '@next-model/conformance';
import { KeyType } from '@next-model/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MysqlConnector } from '../index.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://root:mysql@127.0.0.1:3306/test';

const connector = new MysqlConnector(DATABASE_URL);

afterAll(() => connector.destroy());

describe('MysqlConnector', () => {
  it('runs raw SQL via execute', async () => {
    const rows = await connector.execute('SELECT 1 + 1 AS sum', []);
    expect(rows[0].sum).toBe(2);
  });

  it('counts an empty table at zero', async () => {
    const tableName = 'mysql_smoke';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.count({ tableName })).toBe(0);
    await connector.dropTable(tableName);
  });

  it('renders every supported column kind in createTable', async () => {
    const tableName = 'mysql_kinds';
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
      t.index(['email'], { name: 'idx_mysql_kinds_email' });
      t.index(['email', 'active'], { unique: true });
    });
    expect(await connector.hasTable(tableName)).toBe(true);
    await connector.dropTable(tableName);
  });

  it('rejects unsafe identifiers', async () => {
    await expect(connector.query({ tableName: 'bad name; DROP' })).rejects.toThrow(
      /unsafe identifier/i,
    );
  });

  it('rejects $async filters at the connector boundary', async () => {
    const tableName = 'mysql_async_guard';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await expect(
      connector.query({ tableName, filter: { $async: Promise.resolve({}) } as any }),
    ).rejects.toThrow(/\$async/);
    await connector.dropTable(tableName);
  });

  it('execute() accepts a single binding', async () => {
    const rows = await connector.execute('SELECT ? AS n', 7 as any);
    expect(rows[0].n).toBe(7);
  });

  it('returns all rows from a multi-row batchInsert', async () => {
    const tableName = 'mysql_batch';
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
});

describe('MysqlConnector#queryScoped', () => {
  const usersTable = 'qs_users';
  const todosTable = 'qs_todos';
  const ordersTable = 'qs_orders';

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
    const aliceId = inserted[0].id as number;
    const bobId = inserted[1].id as number;
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

runModelConformance({
  name: 'MysqlConnector',
  makeConnector: () => connector,
});
