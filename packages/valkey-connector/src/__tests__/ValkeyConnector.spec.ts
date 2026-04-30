import { conformanceSchema, runModelConformance } from '@next-model/conformance';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ValkeyConnector } from '../index.js';

const VALKEY_URL = process.env.VALKEY_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const connector = new ValkeyConnector({
  client: { url: VALKEY_URL },
  prefix: 'nm-vk-test:',
});

beforeAll(() => connector.connect());
afterAll(() => connector.destroy());

beforeEach(async () => {
  let cursor = 0;
  do {
    const result = await connector.client.scan(cursor, {
      MATCH: 'nm-vk-test:*',
      COUNT: 100,
    });
    cursor = Number(result.cursor);
    if (result.keys.length > 0) await connector.client.del(result.keys);
  } while (cursor !== 0);
});

describe('ValkeyConnector', () => {
  it('inherits the redis-connector storage layout', async () => {
    const tableName = 'valkey_smoke';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    expect(await connector.hasTable(tableName)).toBe(true);
    const rows = await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada' }]);
    expect(rows[0].name).toBe('Ada');
    const meta = await connector.client.get(`nm-vk-test:${tableName}:meta`);
    expect(meta).toBeTruthy();
  });

  it('execute() reaches the underlying server', async () => {
    const [pong] = await connector.execute('PING', []);
    expect(String(pong)).toBe('PONG');
  });
});

runModelConformance({
  name: 'ValkeyConnector',
  makeConnector: () =>
    new ValkeyConnector({ client: connector.client, prefix: 'nm-vk-test:' }, { schema: conformanceSchema }),
  skipTransactions: true,
});
