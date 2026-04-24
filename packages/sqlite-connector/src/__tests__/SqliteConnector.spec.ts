import { runModelConformance } from '@next-model/conformance';
import { afterAll, describe, expect, it } from 'vitest';

import { SqliteConnector } from '../index.js';

const connector = new SqliteConnector(':memory:');

afterAll(() => connector.destroy());

describe('SqliteConnector', () => {
  it('runs raw SQL via execute', async () => {
    const rows = await connector.execute('SELECT 1 + 1 AS sum', []);
    expect(rows[0].sum).toBe(2);
  });

  it('counts an empty table at zero', async () => {
    const tableName = 'lite_smoke';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.count({ tableName })).toBe(0);
    await connector.dropTable(tableName);
  });

  it('renders every supported column kind in createTable', async () => {
    const tableName = 'lite_kinds';
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
      t.json('payload', { default: null });
      t.index(['email'], { name: 'idx_lite_kinds_email' });
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
    const tableName = 'lite_async_guard';
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

  it('coerces Date and boolean parameters when binding', async () => {
    const tableName = 'lite_coerce';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.boolean('active');
      t.timestamp('seen_at');
    });
    const now = new Date();
    await connector.batchInsert(tableName, { id: 1 } as any, [{ active: true, seen_at: now }]);
    const [row] = await connector.query({ tableName });
    expect(row.active).toBe(1);
    expect(row.seen_at).toBe(now.toISOString());
    await connector.dropTable(tableName);
  });
});

runModelConformance({
  name: 'SqliteConnector',
  makeConnector: () => connector,
});
