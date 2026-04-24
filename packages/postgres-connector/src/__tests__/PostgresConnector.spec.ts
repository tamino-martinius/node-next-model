import { runModelConformance } from '@next-model/conformance';
import { afterAll, describe, expect, it } from 'vitest';

import { PostgresConnector } from '../index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

const connector = new PostgresConnector({ connectionString: DATABASE_URL, max: 1 });

afterAll(() => connector.destroy());

describe('PostgresConnector', () => {
  it('runs raw SQL via execute', async () => {
    const rows = await connector.execute('SELECT 1 + 1 AS sum', []);
    expect(rows[0].sum).toBe(2);
  });

  it('counts an empty table at zero', async () => {
    const tableName = 'pg_smoke';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.count({ tableName })).toBe(0);
    await connector.dropTable(tableName);
  });
});

runModelConformance({
  name: 'PostgresConnector',
  makeConnector: () => connector,
});
