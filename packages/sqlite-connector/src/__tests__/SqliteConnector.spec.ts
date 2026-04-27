import { runModelConformance } from '@next-model/conformance';
import { defineAlter, KeyType } from '@next-model/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

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

describe('SqliteConnector#queryScoped', () => {
  const usersTable = 'qs_users';
  const todosTable = 'qs_todos';
  const ordersTable = 'qs_orders';

  beforeEach(async () => {
    if (await connector.hasTable(todosTable)) await connector.dropTable(todosTable);
    if (await connector.hasTable(usersTable)) await connector.dropTable(usersTable);
    if (await connector.hasTable(ordersTable)) await connector.dropTable(ordersTable);
    await connector.createTable(usersTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('email');
      t.integer('age');
    });
    await connector.createTable(todosTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('userId');
      t.string('title');
    });
    await connector.createTable(ordersTable, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.integer('total');
    });
  });

  afterEach(async () => {
    if (await connector.hasTable(todosTable)) await connector.dropTable(todosTable);
    if (await connector.hasTable(usersTable)) await connector.dropTable(usersTable);
    if (await connector.hasTable(ordersTable)) await connector.dropTable(ordersTable);
  });

  it('returns rows for a flat query (no parent scopes)', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
    ]);
    const rows = (await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: 'rows',
    })) as { email: string }[];
    expect(rows.map((r) => r.email).sort()).toEqual(['a@b', 'c@d']);
  });

  it('emits nested IN subquery for parentScopes (one statement)', async () => {
    const inserted = await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'alice@x', age: 18 },
      { email: 'bob@x', age: 21 },
    ]);
    const aliceId = inserted[0].id;
    const bobId = inserted[1].id;
    await connector.batchInsert(todosTable, { id: KeyType.number } as any, [
      { userId: aliceId, title: 'a-1' },
      { userId: aliceId, title: 'a-2' },
      { userId: bobId, title: 'b-1' },
    ]);

    const rows = (await connector.queryScoped({
      target: { tableName: todosTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: usersTable,
          parentKeys: { id: KeyType.number },
          parentFilter: { age: 18 },
          link: { parentColumn: 'id', childColumn: 'userId', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    })) as { title: string; userId: number }[];
    expect(rows.map((r) => r.title).sort()).toEqual(['a-1', 'a-2']);
    for (const row of rows) expect(row.userId).toBe(aliceId);
  });

  it('aggregate count returns total matching row count', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
      { email: 'e@f', age: 30 },
    ]);
    const result = await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'count' },
    });
    expect(result).toBe(3);
    expect(typeof result).toBe('number');
  });

  it('aggregate sum on a column returns the total', async () => {
    await connector.batchInsert(ordersTable, { id: KeyType.number } as any, [
      { total: 3 },
      { total: 4 },
      { total: 5 },
    ]);
    const result = await connector.queryScoped({
      target: { tableName: ordersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'sum', column: 'total' },
    });
    expect(result).toBe(12);
  });

  it('column projection plucks values', async () => {
    await connector.batchInsert(usersTable, { id: KeyType.number } as any, [
      { email: 'a@b', age: 18 },
      { email: 'c@d', age: 21 },
    ]);
    const result = (await connector.queryScoped({
      target: { tableName: usersTable, keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      order: [{ key: 'id' }],
      projection: { kind: 'column', column: 'email' },
    })) as string[];
    expect(result).toEqual(['a@b', 'c@d']);
  });
});

describe('SqliteConnector#reflectSchema', () => {
  it('returns one TableDefinition per user table', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('users', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('email', { null: false });
      });
      await local.createTable('posts', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('title', { null: false });
      });
      const tables = await local.reflectSchema!();
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual(['posts', 'users']);
    } finally {
      local.destroy();
    }
  });

  it('skips sqlite_* internal tables', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      // Force creation of a sqlite_sequence row by using AUTOINCREMENT.
      await local.createTable('seq_demo', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
      });
      await local.batchInsert('seq_demo', { id: 1 } as any, [{}]);
      const tables = await local.reflectSchema!();
      expect(tables.every((t) => !t.name.startsWith('sqlite_'))).toBe(true);
    } finally {
      local.destroy();
    }
  });

  it('captures column kinds, primary key, autoIncrement, and nullable flags', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('items', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('email', { limit: 320, null: false });
        t.text('body');
        t.integer('age', { null: true });
        t.boolean('active', { default: true, null: false });
        t.float('rating');
        t.decimal('price', { precision: 12, scale: 4 });
      });
      const tables = await local.reflectSchema!();
      const items = tables.find((t) => t.name === 'items');
      expect(items).toBeDefined();
      expect(items!.primaryKey).toBe('id');
      const id = items!.columns.find((c) => c.name === 'id')!;
      expect(id.primary).toBe(true);
      expect(id.autoIncrement).toBe(true);
      expect(id.nullable).toBe(false);
      expect(id.type).toBe('integer');
      // SQLite stores `t.string(...)` with a limit as `VARCHAR(N)`, which
      // round-trips back to 'string' with the limit. Without a limit it
      // collapses to TEXT and we can't distinguish it from `t.text`.
      const email = items!.columns.find((c) => c.name === 'email')!;
      expect(email.type).toBe('string');
      expect(email.limit).toBe(320);
      expect(email.nullable).toBe(false);
      const body = items!.columns.find((c) => c.name === 'body')!;
      expect(body.type).toBe('text');
      const age = items!.columns.find((c) => c.name === 'age')!;
      expect(age.type).toBe('integer');
      expect(age.nullable).toBe(true);
      // SQLite has no native BOOLEAN — booleans are stored as INTEGER 0/1,
      // so reflection rebuilds them as `integer` columns (with the default
      // surfaced as the underlying numeric value).
      const active = items!.columns.find((c) => c.name === 'active')!;
      expect(active.type).toBe('integer');
      expect(active.default).toBe(1);
      const rating = items!.columns.find((c) => c.name === 'rating')!;
      expect(rating.type).toBe('float');
      const price = items!.columns.find((c) => c.name === 'price')!;
      expect(price.type).toBe('decimal');
      expect(price.precision).toBe(12);
      expect(price.scale).toBe(4);
    } finally {
      local.destroy();
    }
  });

  it('captures string limit when declared as VARCHAR(N)', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('events', (t) => {
        t.string('slug', { limit: 64, null: false });
      });
      const tables = await local.reflectSchema!();
      const slug = tables[0].columns.find((c) => c.name === 'slug')!;
      expect(slug.limit).toBe(64);
    } finally {
      local.destroy();
    }
  });

  it('captures explicit indexes (skipping pk / unique auto-indexes)', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('logs', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.integer('userId');
        t.index(['userId'], { name: 'idx_logs_user_id' });
        t.index(['userId', 'id'], { unique: true, name: 'idx_logs_user_id_id' });
      });
      const tables = await local.reflectSchema!();
      const logs = tables.find((t) => t.name === 'logs')!;
      const names = logs.indexes.map((i) => i.name).sort();
      expect(names).toContain('idx_logs_user_id');
      expect(names).toContain('idx_logs_user_id_id');
      const single = logs.indexes.find((i) => i.name === 'idx_logs_user_id')!;
      expect(single.columns).toEqual(['userId']);
      expect(single.unique).toBe(false);
      const compound = logs.indexes.find((i) => i.name === 'idx_logs_user_id_id')!;
      expect(compound.columns).toEqual(['userId', 'id']);
      expect(compound.unique).toBe(true);
    } finally {
      local.destroy();
    }
  });

  it('decodes string / number / null / currentTimestamp defaults', async () => {
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('settings', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('kind', { default: 'api', null: false });
        t.integer('count', { default: 0, null: false });
        t.timestamp('seenAt', { default: 'currentTimestamp', null: false });
        t.json('payload', { default: null });
      });
      const tables = await local.reflectSchema!();
      const settings = tables.find((t) => t.name === 'settings')!;
      const byName = (n: string) => settings.columns.find((c) => c.name === n)!;
      expect(byName('kind').default).toBe('api');
      expect(byName('count').default).toBe(0);
      expect(byName('seenAt').default).toBe('currentTimestamp');
      expect(byName('payload').default).toBe(null);
    } finally {
      local.destroy();
    }
  });

  it('round-trips into generateSchemaSource', async () => {
    const { generateSchemaSource } = await import('@next-model/core');
    const local = new SqliteConnector(':memory:');
    try {
      await local.createTable('users', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('email', { limit: 320, null: false });
      });
      const reflected = await local.reflectSchema!();
      const source = generateSchemaSource(reflected);
      expect(source).toContain('export const usersSchema = defineSchema({');
      expect(source).toContain('email: { type: "string"');
      expect(source).toContain('id: { type: "integer", primary: true, autoIncrement: true');
    } finally {
      local.destroy();
    }
  });
});

runModelConformance({
  name: 'SqliteConnector',
  makeConnector: () => connector,
});
