import type { Scope } from '@next-model/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisConnector } from '../index.js';

/**
 * Fake node-redis client that tracks every call so we can assert the
 * connector took the direct-lookup fast path (and did not fall back to a
 * full ZRANGE scan).
 */
function makeFakeClient(rows: Record<string, Record<string, string>>, meta: string | null) {
  return {
    isOpen: true,
    hGetAll: vi.fn(async (key: string) => rows[key] ?? {}),
    get: vi.fn(async (_key: string) => meta),
    zRange: vi.fn(async (_key: string, _start: number, _stop: number) =>
      Object.keys(rows).map((k) => k.split(':row:')[1]),
    ),
    connect: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
  };
}

function withFakeClient(rows: Record<string, Record<string, string>>, meta: string | null) {
  const fake = makeFakeClient(rows, meta);
  const connector = new RedisConnector({
    redis: fake as unknown as Parameters<typeof Object>[0] & object as never,
    prefix: 'nm-test:',
  });
  return { connector, fake };
}

describe('RedisConnector id-lookup fast path', () => {
  const META = JSON.stringify({ primaryKey: 'id' });
  const ROWS = {
    'nm-test:users:row:1': { id: '1', name: '"Ada"' },
    'nm-test:users:row:2': { id: '2', name: '"Linus"' },
    'nm-test:users:row:3': { id: '3', name: '"Old"' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses hGetAll and skips zRange for {id: value}', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { id: 1 } };
    const rows = await connector.query(scope);
    expect(rows).toEqual([{ id: 1, name: 'Ada' }]);
    expect(fake.hGetAll).toHaveBeenCalledTimes(1);
    expect(fake.hGetAll).toHaveBeenCalledWith('nm-test:users:row:1');
    expect(fake.zRange).not.toHaveBeenCalled();
  });

  it('uses hGetAll for every id in {$in: {id: [...]}}', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { $in: { id: [1, 3] } } };
    const rows = await connector.query(scope);
    expect(rows.map((r) => r.name).sort()).toEqual(['Ada', 'Old']);
    expect(fake.hGetAll).toHaveBeenCalledTimes(2);
    expect(fake.zRange).not.toHaveBeenCalled();
  });

  it('skips rows the lookup did not find (missing ids return an empty hash)', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { $in: { id: [1, 999] } } };
    const rows = await connector.query(scope);
    expect(rows.map((r) => r.name)).toEqual(['Ada']);
    expect(fake.hGetAll).toHaveBeenCalledTimes(2);
  });

  it('count uses the fast path without zRange', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    expect(await connector.count({ tableName: 'users', filter: { id: 1 } })).toBe(1);
    expect(await connector.count({ tableName: 'users', filter: { $in: { id: [1, 2] } } })).toBe(2);
    expect(fake.zRange).not.toHaveBeenCalled();
  });

  it('falls back to zRange when the filter is not pk-only', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { name: 'Ada' } };
    await connector.query(scope);
    expect(fake.zRange).toHaveBeenCalled();
  });

  it('falls back to zRange when the filter is an object but not just pk', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { id: 1, name: 'Ada' } };
    await connector.query(scope);
    expect(fake.zRange).toHaveBeenCalled();
  });

  it('falls back when $in carries a non-pk column', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    const scope: Scope = { tableName: 'users', filter: { $in: { name: ['Ada', 'Linus'] } } };
    await connector.query(scope);
    expect(fake.zRange).toHaveBeenCalled();
  });

  it('falls back when there is no filter', async () => {
    const { connector, fake } = withFakeClient(ROWS, META);
    await connector.query({ tableName: 'users' });
    expect(fake.zRange).toHaveBeenCalled();
  });

  it('honours a non-default primary key from the table meta', async () => {
    const meta = JSON.stringify({ primaryKey: 'uuid' });
    const rows = {
      'nm-test:tickets:row:abc': { uuid: '"abc"', title: '"Hello"' },
    };
    const { connector, fake } = withFakeClient(rows, meta);
    const scope: Scope = { tableName: 'tickets', filter: { uuid: 'abc' } };
    const out = await connector.query(scope);
    expect(out).toEqual([{ uuid: 'abc', title: 'Hello' }]);
    expect(fake.zRange).not.toHaveBeenCalled();
  });
});
