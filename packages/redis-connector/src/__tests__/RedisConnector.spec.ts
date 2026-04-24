import { runModelConformance } from '@next-model/conformance';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RedisConnector } from '../index.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const connector = new RedisConnector({ client: { url: REDIS_URL }, prefix: 'nm-test:' });

beforeAll(() => connector.connect());
afterAll(() => connector.destroy());

beforeEach(async () => {
  // Wipe every key under our test prefix so each test gets a clean slate.
  let cursor = 0;
  do {
    const result = await connector.client.scan(cursor, { MATCH: 'nm-test:*', COUNT: 100 });
    cursor = Number(result.cursor);
    if (result.keys.length > 0) await connector.client.del(result.keys);
  } while (cursor !== 0);
});

describe('RedisConnector', () => {
  it('round-trips a HASH row through createTable + batchInsert + query', async () => {
    const tableName = 'redis_smoke';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.hasTable(tableName)).toBe(true);
    const rows = await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada' }]);
    expect(rows[0].name).toBe('Ada');
    expect(typeof rows[0].id).toBe('number');
    expect(await connector.count({ tableName })).toBe(1);
  });

  it('preserves Date and boolean values across reads', async () => {
    const tableName = 'redis_types';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.boolean('active');
      t.timestamp('seen_at');
      t.json('payload');
    });
    const date = new Date('2026-04-24T10:00:00.000Z');
    await connector.batchInsert(tableName, { id: 1 } as any, [
      { active: true, seen_at: date, payload: { foo: 'bar' } },
    ]);
    const [row] = await connector.query({ tableName });
    expect(row.active).toBe(true);
    expect(row.seen_at).toBeInstanceOf(Date);
    expect((row.seen_at as Date).toISOString()).toBe(date.toISOString());
    expect(row.payload).toEqual({ foo: 'bar' });
  });

  it('hasTable reports false after dropTable', async () => {
    const tableName = 'redis_drop';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    expect(await connector.hasTable(tableName)).toBe(true);
    await connector.dropTable(tableName);
    expect(await connector.hasTable(tableName)).toBe(false);
  });

  it('execute() runs a raw redis command', async () => {
    await connector.execute('SET', ['nm-test:raw', 'hello']);
    const [value] = await connector.execute('GET', ['nm-test:raw']);
    expect(String(value)).toBe('hello');
  });
});

runModelConformance({
  name: 'RedisConnector',
  makeConnector: () => connector,
});
