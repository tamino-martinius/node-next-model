import { runModelConformance } from '@next-model/conformance';
import { afterAll, describe, expect, it } from 'vitest';

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

runModelConformance({
  name: 'MysqlConnector',
  makeConnector: () => connector,
});
