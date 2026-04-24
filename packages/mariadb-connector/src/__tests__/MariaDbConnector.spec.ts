import { runModelConformance } from '@next-model/conformance';
import { afterAll, describe, expect, it } from 'vitest';

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
});

runModelConformance({
  name: 'MariaDbConnector',
  makeConnector: () => connector,
});
