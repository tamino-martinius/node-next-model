import { runModelConformance } from '@next-model/conformance';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoDbConnector } from '../index.js';

const URL = process.env.MONGODB_URL ?? 'mongodb://127.0.0.1:27017';

const connector = new MongoDbConnector({ url: URL, database: 'nm_test' });

beforeAll(() => connector.connect());
afterAll(() => connector.destroy());

beforeEach(async () => {
  // Wipe the test database before each test.
  const collections = await connector.db.listCollections().toArray();
  for (const c of collections) {
    await connector.db
      .collection(c.name)
      .drop()
      .catch(() => {});
  }
});

describe('MongoDbConnector', () => {
  it('round-trips a document via createTable + batchInsert + query', async () => {
    const tableName = 'mongo_smoke';
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

  it('compiles $like to a regex', async () => {
    const tableName = 'mongo_like';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [
      { email: 'ada@example.com' },
      { email: 'bob@other.org' },
    ]);
    const rows = await connector.query({
      tableName,
      filter: { $like: { email: '%@example.com' } } as any,
    });
    expect(rows.map((r) => r.email)).toEqual(['ada@example.com']);
  });

  it('rejects unsafe collection names', async () => {
    await expect(connector.query({ tableName: 'bad name; drop' })).rejects.toThrow(
      /unsafe collection/i,
    );
  });

  it('rejects $async filters at the connector boundary', async () => {
    const tableName = 'mongo_async_guard';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await expect(
      connector.query({ tableName, filter: { $async: Promise.resolve({}) } as any }),
    ).rejects.toThrow(/\$async/);
  });

  it('select() projects requested fields and strips _id', async () => {
    const tableName = 'mongo_select';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
      t.integer('age');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'a', age: 1 }]);
    const rows = await connector.select({ tableName }, 'name');
    expect(rows).toEqual([{ name: 'a' }]);
  });
});

runModelConformance({
  name: 'MongoDbConnector',
  makeConnector: () => connector,
});
