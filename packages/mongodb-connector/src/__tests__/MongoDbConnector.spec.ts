import { runModelConformance } from '@next-model/conformance';
import { defineAlter, UnsupportedOperationError } from '@next-model/core';
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

  it('creates collection indexes declared via t.index / t.references', async () => {
    const tableName = 'mongo_indexed';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email', { null: false });
      t.index('email', { unique: true });
      t.references('author');
    });
    const collection = connector.db.collection(tableName);
    const indexes = await collection.indexes();
    const byColumnKey = (col: string) =>
      indexes.find((idx) => idx.key && Object.keys(idx.key).join(',') === col);
    expect(byColumnKey('email')).toMatchObject({ unique: true });
    expect(byColumnKey('authorId')).toBeTruthy();
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

describe('MongoDbConnector.alterTable', () => {
  it('removeColumn / renameColumn rewrite document fields', async () => {
    const tableName = 'mongo_alter_cols';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
      t.string('legacy');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada', legacy: 'old' }]);

    await connector.alterTable(
      defineAlter(tableName, (a) => {
        a.renameColumn('name', 'fullName');
        a.removeColumn('legacy');
      }),
    );
    const rows = await connector.query({ tableName });
    expect(rows[0].fullName).toBe('Ada');
    expect('name' in rows[0]).toBe(false);
    expect('legacy' in rows[0]).toBe(false);
  });

  it('addColumn / changeColumn are document-store no-ops', async () => {
    const tableName = 'mongo_alter_noop';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada' }]);
    await connector.alterTable(
      defineAlter(tableName, (a) => {
        a.addColumn('lastSeenAt', 'datetime');
        a.changeColumn('name', 'text');
      }),
    );
    const rows = await connector.query({ tableName });
    expect(rows[0].name).toBe('Ada');
  });

  it('addIndex / removeIndex map to collection.createIndex / dropIndex', async () => {
    const tableName = 'mongo_alter_idx';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email');
    });
    await connector.alterTable(
      defineAlter(tableName, (a) => a.addIndex('email', { name: 'idx_mongo_email', unique: true })),
    );
    const indexes = await connector.db.collection(tableName).indexes();
    expect(indexes.find((i) => i.name === 'idx_mongo_email')).toMatchObject({ unique: true });
    await connector.alterTable(defineAlter(tableName, (a) => a.removeIndex('idx_mongo_email')));
    const after = await connector.db.collection(tableName).indexes();
    expect(after.find((i) => i.name === 'idx_mongo_email')).toBeUndefined();
  });

  it('renameIndex throws UnsupportedOperationError', async () => {
    const tableName = 'mongo_alter_rename_idx';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await expect(
      connector.alterTable(defineAlter(tableName, (a) => a.renameIndex('a', 'b'))),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);
  });

  it('foreign keys + check constraints throw UnsupportedOperationError', async () => {
    const tableName = 'mongo_alter_fk';
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await expect(
      connector.alterTable(defineAlter(tableName, (a) => a.addForeignKey('other'))),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);
    await expect(
      connector.alterTable(defineAlter(tableName, (a) => a.removeForeignKey('other'))),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);
    await expect(
      connector.alterTable(
        defineAlter(tableName, (a) => a.addCheckConstraint('id > 0', { name: 'chk' })),
      ),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);
    await expect(
      connector.alterTable(defineAlter(tableName, (a) => a.removeCheckConstraint('chk'))),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);
  });
});

runModelConformance({
  name: 'MongoDbConnector',
  makeConnector: () => connector,
});
