import { runModelConformance } from '@next-model/conformance';
import { defineAlter } from '@next-model/core';
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

  it('round-trips objects in json columns (insert + query + update)', async () => {
    const tableName = 'lite_json';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.json('profile');
      t.json('tags');
    });
    const profile = { nickname: 'ada', settings: { theme: 'dark', notifications: [1, 2, 3] } };
    const tags = ['admin', 'ops'];
    await connector.batchInsert(tableName, { id: 1 } as any, [{ profile, tags }]);
    const [row] = await connector.query({ tableName });
    expect(row.profile).toEqual(profile);
    expect(row.tags).toEqual(tags);

    const [updated] = await connector.updateAll({ tableName, filter: { id: row.id } as any }, {
      profile: { nickname: 'ada2', settings: null },
    } as any);
    expect(updated.profile).toEqual({ nickname: 'ada2', settings: null });
    expect(updated.tags).toEqual(tags);

    await connector.dropTable(tableName);
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

describe('SqliteConnector.alterTable', () => {
  async function setupUsers(tableName: string): Promise<void> {
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name', { null: false });
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada' }, { name: 'Linus' }]);
  }

  it('addColumn ALTER TABLE retains existing rows and back-fills with the default', async () => {
    const tableName = 'lite_alter_add';
    await setupUsers(tableName);
    await connector.alterTable(
      defineAlter(tableName, (a) => a.addColumn('role', 'string', { default: 'member' })),
    );
    const rows = await connector.query({ tableName });
    expect(rows.map((r) => r.role)).toEqual(['member', 'member']);
    await connector.dropTable(tableName);
  });

  it('renameColumn renames the column and preserves data', async () => {
    const tableName = 'lite_alter_rename';
    await setupUsers(tableName);
    await connector.alterTable(defineAlter(tableName, (a) => a.renameColumn('name', 'fullName')));
    const rows = await connector.query({ tableName });
    expect(rows.map((r) => r.fullName).sort()).toEqual(['Ada', 'Linus']);
    expect('name' in rows[0]).toBe(false);
    await connector.dropTable(tableName);
  });

  it('removeColumn drops the column', async () => {
    const tableName = 'lite_alter_drop';
    await setupUsers(tableName);
    await connector.alterTable(defineAlter(tableName, (a) => a.removeColumn('name')));
    const rows = await connector.query({ tableName });
    expect('name' in rows[0]).toBe(false);
    await connector.dropTable(tableName);
  });

  it('changeColumn recreates the table preserving data', async () => {
    const tableName = 'lite_alter_change';
    await setupUsers(tableName);
    await connector.alterTable(
      defineAlter(tableName, (a) => a.changeColumn('name', 'text', { null: false })),
    );
    const rows = await connector.query({ tableName });
    expect(rows.map((r) => r.name).sort()).toEqual(['Ada', 'Linus']);
    await connector.dropTable(tableName);
  });

  it('addIndex / removeIndex / renameIndex round-trip', async () => {
    const tableName = 'lite_alter_idx';
    await setupUsers(tableName);
    await connector.alterTable(
      defineAlter(tableName, (a) => a.addIndex('name', { name: 'idx_lite_alter_idx_name' })),
    );
    const before = (await connector.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = ?",
      [tableName],
    )) as { name: string }[];
    expect(before.map((r) => r.name)).toContain('idx_lite_alter_idx_name');

    await connector.alterTable(
      defineAlter(tableName, (a) =>
        a.renameIndex('idx_lite_alter_idx_name', 'idx_lite_alter_idx_renamed'),
      ),
    );
    const renamed = (await connector.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = ?",
      [tableName],
    )) as { name: string }[];
    expect(renamed.map((r) => r.name)).toContain('idx_lite_alter_idx_renamed');

    await connector.alterTable(
      defineAlter(tableName, (a) => a.removeIndex('idx_lite_alter_idx_renamed')),
    );
    const after = (await connector.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = ?",
      [tableName],
    )) as { name: string }[];
    expect(after.map((r) => r.name)).not.toContain('idx_lite_alter_idx_renamed');
    await connector.dropTable(tableName);
  });

  it('addForeignKey + removeForeignKey via the recreate dance', async () => {
    const parent = 'lite_alter_parent';
    const child = 'lite_alter_child';
    if (await connector.hasTable(child)) await connector.dropTable(child);
    if (await connector.hasTable(parent)) await connector.dropTable(parent);
    await connector.createTable(parent, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await connector.createTable(child, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('parentId');
    });

    await connector.alterTable(
      defineAlter(child, (a) =>
        a.addForeignKey(parent, { column: 'parentId', onDelete: 'cascade' }),
      ),
    );
    const fkList = (await connector.execute(
      `SELECT * FROM pragma_foreign_key_list('${child}')`,
      [],
    )) as Dict<any>[];
    expect(fkList.length).toBe(1);
    expect(fkList[0].table).toBe(parent);
    expect(fkList[0].on_delete.toUpperCase()).toBe('CASCADE');

    await connector.alterTable(defineAlter(child, (a) => a.removeForeignKey(parent)));
    const after = (await connector.execute(
      `SELECT * FROM pragma_foreign_key_list('${child}')`,
      [],
    )) as Dict<any>[];
    expect(after).toEqual([]);

    await connector.dropTable(child);
    await connector.dropTable(parent);
  });

  it('addCheckConstraint + removeCheckConstraint via the recreate dance', async () => {
    const tableName = 'lite_alter_check';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('age', { null: false });
    });

    await connector.alterTable(
      defineAlter(tableName, (a) =>
        a.addCheckConstraint('age >= 0', { name: 'chk_age_non_negative' }),
      ),
    );
    await expect(
      connector.batchInsert(tableName, { id: 1 } as any, [{ age: -1 }]),
    ).rejects.toBeTruthy();

    await connector.alterTable(
      defineAlter(tableName, (a) => a.removeCheckConstraint('chk_age_non_negative')),
    );
    const inserted = await connector.batchInsert(tableName, { id: 1 } as any, [{ age: -1 }]);
    expect(inserted.length).toBe(1);
    await connector.dropTable(tableName);
  });
});

interface Dict<T> {
  [key: string]: T;
}

runModelConformance({
  name: 'SqliteConnector',
  makeConnector: () => connector,
});
