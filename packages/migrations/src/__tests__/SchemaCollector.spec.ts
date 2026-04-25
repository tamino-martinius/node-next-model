import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineAlter, MemoryConnector } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { Migrator } from '../Migrator.js';
import { readSchemaFile, SchemaCollector, type SchemaSnapshot } from '../SchemaCollector.js';
import type { Migration } from '../types.js';

function newCollector(): { inner: MemoryConnector; collector: SchemaCollector } {
  const inner = new MemoryConnector({ storage: {}, lastIds: {} });
  const collector = new SchemaCollector(inner);
  return { inner, collector };
}

describe('SchemaCollector', () => {
  it('captures createTable definitions into the snapshot', async () => {
    const { collector } = newCollector();
    await collector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name', { null: false });
      t.integer('age');
    });
    const snap = collector.snapshot();
    expect(Object.keys(snap.tables)).toEqual(['users']);
    const users = snap.tables.users;
    expect(users.name).toBe('users');
    expect(users.columns.map((c) => c.name)).toEqual(['id', 'name', 'age']);
    const id = users.columns.find((c) => c.name === 'id');
    expect(id).toMatchObject({
      type: 'integer',
      primary: true,
      autoIncrement: true,
      nullable: false,
    });
  });

  it('forwards the blueprint to the inner connector', async () => {
    const { inner, collector } = newCollector();
    await collector.createTable('posts', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('title');
    });
    expect(await inner.hasTable('posts')).toBe(true);
  });

  it('drops tables out of the snapshot on dropTable', async () => {
    const { collector } = newCollector();
    await collector.createTable('temp', (t) => t.integer('id', { primary: true }));
    await collector.dropTable('temp');
    expect(collector.snapshot().tables).toEqual({});
  });

  it('persists + restores the snapshot via writeSchema / readSchemaFile', async () => {
    const { collector } = newCollector();
    await collector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
    });
    const dir = mkdtempSync(join(tmpdir(), 'nm-schema-'));
    const path = join(dir, 'schema.json');
    collector.writeSchema(path);
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as SchemaSnapshot;
    expect(parsed.version).toBe(1);
    expect(parsed.tables.users.columns.map((c) => c.name)).toEqual(['id', 'name']);

    const loaded = await readSchemaFile(path);
    expect(loaded).toEqual(parsed);
  });

  it('seeds from an existing snapshot', async () => {
    const existing: SchemaSnapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      tables: {
        projects: {
          name: 'projects',
          columns: [
            {
              name: 'id',
              type: 'integer',
              nullable: false,
              primary: true,
              unique: false,
              autoIncrement: true,
            },
          ],
          indexes: [],
        },
      },
    };
    const { collector } = newCollector();
    const seeded = new SchemaCollector(collector.delegate, { initial: existing });
    expect(Object.keys(seeded.snapshot().tables)).toEqual(['projects']);
  });

  it('drives a full Migrator.migrate() end-to-end', async () => {
    const { collector } = newCollector();
    const migrations: Migration[] = [
      {
        version: '001',
        name: 'create_users',
        up: (connector) =>
          connector.createTable('users', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('email', { null: false });
          }),
        down: (connector) => connector.dropTable('users'),
      },
      {
        version: '002',
        name: 'create_posts',
        parent: ['001'],
        up: (connector) =>
          connector.createTable('posts', (t) => {
            t.integer('id', { primary: true, autoIncrement: true, null: false });
            t.string('title');
            t.integer('userId');
          }),
        down: (connector) => connector.dropTable('posts'),
      },
    ];
    const migrator = new Migrator({ connector: collector });
    await migrator.migrate(migrations);
    const snap = collector.snapshot();
    expect(Object.keys(snap.tables).sort()).toEqual(['posts', 'schema_migrations', 'users']);
    expect(snap.tables.posts.columns.map((c) => c.name)).toEqual(['id', 'title', 'userId']);
  });

  it('reflects rollback: rolling back drops the table from the snapshot', async () => {
    const { collector } = newCollector();
    const migrations: Migration[] = [
      {
        version: '001',
        name: 'create_users',
        up: (c) => c.createTable('users', (t) => t.integer('id', { primary: true })),
        down: (c) => c.dropTable('users'),
      },
    ];
    const migrator = new Migrator({ connector: collector });
    await migrator.migrate(migrations);
    expect(Object.keys(collector.snapshot().tables)).toContain('users');
    await migrator.rollback(migrations);
    expect(Object.keys(collector.snapshot().tables)).not.toContain('users');
  });

  it('forwards every data-path method to the inner connector', async () => {
    const { inner, collector } = newCollector();
    await collector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
      t.integer('age');
    });
    await collector.batchInsert('users', { id: 1 } as any, [
      { name: 'Ada', age: 36 },
      { name: 'Linus', age: 12 },
      { name: 'Old', age: 99 },
    ]);

    const scope = { tableName: 'users' };
    expect(await collector.count(scope)).toBe(3);
    expect(await collector.hasTable('users')).toBe(true);

    const all = await collector.query(scope);
    expect(all.map((r) => r.name).sort()).toEqual(['Ada', 'Linus', 'Old']);

    const partial = await collector.select(scope, 'name');
    expect(partial.every((r) => Object.keys(r).length === 1)).toBe(true);

    const avg = await collector.aggregate(scope, 'avg', 'age');
    expect(avg).toBeGreaterThan(0);

    await collector.updateAll({ tableName: 'users', filter: { name: 'Ada' } }, { age: 37 });
    const ada = (await collector.query({ tableName: 'users', filter: { name: 'Ada' } }))[0];
    expect(ada.age).toBe(37);

    await collector.deleteAll({ tableName: 'users', filter: { name: 'Old' } });
    expect(await collector.count(scope)).toBe(2);

    // transaction must run the callback and propagate its return value.
    const result = await collector.transaction(async () => 'ok');
    expect(result).toBe('ok');

    // execute is a raw passthrough; MemoryConnector throws for unknown SQL,
    // but reaching that throw proves the forward worked.
    await expect(collector.execute('noop', [])).rejects.toBeTruthy();

    // Sanity: the inner connector saw every mutation we issued through the wrapper.
    expect(await inner.count(scope)).toBe(2);
  });

  it('tracks alterTable ops in the snapshot', async () => {
    const { collector } = newCollector();
    await collector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
    });
    await collector.alterTable(
      defineAlter('users', (a) => {
        a.addColumn('email', 'string', { null: false });
        a.addIndex('email', { unique: true, name: 'idx_users_email' });
        a.renameColumn('name', 'fullName');
      }),
    );
    const snap = collector.snapshot();
    const users = snap.tables.users;
    expect(users.columns.map((c) => c.name)).toEqual(['id', 'fullName', 'email']);
    expect(users.indexes).toEqual([{ columns: ['email'], name: 'idx_users_email', unique: true }]);
  });

  it('schema-file roundtrip: createTable + alterTable replays to the same shape', async () => {
    const { collector } = newCollector();
    await collector.createTable('posts', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('title');
    });
    await collector.alterTable(
      defineAlter('posts', (a) => {
        a.addColumn('publishedAt', 'datetime');
        a.addIndex('publishedAt', { name: 'idx_posts_published_at' });
        a.changeColumn('title', 'string', { null: false, limit: 200 });
      }),
    );
    const dir = mkdtempSync(join(tmpdir(), 'nm-schema-alter-'));
    const path = join(dir, 'schema.json');
    collector.writeSchema(path);

    const replayInner = new MemoryConnector({ storage: {}, lastIds: {} });
    const replayCollector = new SchemaCollector(replayInner, {
      initial: await readSchemaFile(path),
    });
    expect(replayCollector.snapshot().tables).toEqual(collector.snapshot().tables);
  });

  it('alterTable forwards the op list to the inner connector', async () => {
    const { inner, collector } = newCollector();
    await collector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
    });
    await collector.batchInsert('users', { id: 1 } as any, [{ name: 'Ada' }]);
    await collector.alterTable(defineAlter('users', (a) => a.renameColumn('name', 'fullName')));
    const rows = await inner.query({ tableName: 'users' });
    expect(rows[0].fullName).toBe('Ada');
    expect('name' in rows[0]).toBe(false);
  });

  it('readSchemaFile rejects snapshots from a future version', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-schema-'));
    const path = join(dir, 'schema.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, JSON.stringify({ version: 99, generatedAt: '', tables: {} }));
    await expect(readSchemaFile(path)).rejects.toThrow(/unsupported schema snapshot version/);
  });
});
