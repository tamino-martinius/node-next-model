import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryConnector } from '@next-model/core';
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

  it('readSchemaFile rejects snapshots from a future version', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-schema-'));
    const path = join(dir, 'schema.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, JSON.stringify({ version: 99, generatedAt: '', tables: {} }));
    await expect(readSchemaFile(path)).rejects.toThrow(/unsupported schema snapshot version/);
  });
});
