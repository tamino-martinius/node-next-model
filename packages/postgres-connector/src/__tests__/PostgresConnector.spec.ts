import { runModelConformance } from '@next-model/conformance';
import { defineAlter, KeyType } from '@next-model/core';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('renders every supported column kind in createTable', async () => {
    const tableName = 'pg_kinds';
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
      t.index(['email'], { name: 'idx_pg_kinds_email' });
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
    const tableName = 'pg_async_guard';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    await expect(
      connector.query({ tableName, filter: { $async: Promise.resolve({}) } as any }),
    ).rejects.toThrow(/\$async/);
    await connector.dropTable(tableName);
  });

  it('execute() accepts a single binding (not just arrays)', async () => {
    const rows = await connector.execute('SELECT $1::int AS n', 7 as any);
    expect(rows[0].n).toBe(7);
  });
});

describe('PostgresConnector.alterTable', () => {
  async function setupUsers(tableName: string): Promise<void> {
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name', { null: false });
    });
    await connector.batchInsert(tableName, { id: 1 } as any, [{ name: 'Ada' }, { name: 'Linus' }]);
  }

  it('addColumn / removeColumn / renameColumn', async () => {
    const tableName = 'pg_alter_cols';
    await setupUsers(tableName);
    await connector.alterTable(
      defineAlter(tableName, (a) => {
        a.addColumn('role', 'string', { default: 'member' });
        a.renameColumn('name', 'fullName');
      }),
    );
    let rows = await connector.query({ tableName });
    expect(rows[0].role).toBe('member');
    expect(typeof rows[0].fullName).toBe('string');
    await connector.alterTable(defineAlter(tableName, (a) => a.removeColumn('role')));
    rows = await connector.query({ tableName });
    expect('role' in rows[0]).toBe(false);
    await connector.dropTable(tableName);
  });

  it('changeColumn updates type, nullability, and default', async () => {
    const tableName = 'pg_alter_change';
    if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
    await connector.createTable(tableName, (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.text('label');
    });
    await connector.alterTable(
      defineAlter(tableName, (a) =>
        a.changeColumn('label', 'string', { null: false, limit: 64, default: 'unknown' }),
      ),
    );
    await connector.batchInsert(tableName, { id: 1 } as any, [{}]);
    const rows = await connector.query({ tableName });
    expect(rows[0].label).toBe('unknown');
    // and back the other way — drop the default + relax nullability
    await connector.alterTable(
      defineAlter(tableName, (a) => a.changeColumn('label', 'string', { null: true })),
    );
    await connector.dropTable(tableName);
  });

  it('addIndex / removeIndex / renameIndex round-trip', async () => {
    const tableName = 'pg_alter_idx';
    await setupUsers(tableName);
    await connector.alterTable(
      defineAlter(tableName, (a) => a.addIndex('name', { name: 'idx_pg_alter_idx_name' })),
    );
    const before = (await connector.execute(
      'SELECT indexname FROM pg_indexes WHERE tablename = $1',
      [tableName] as any,
    )) as { indexname: string }[];
    expect(before.map((r) => r.indexname)).toContain('idx_pg_alter_idx_name');

    await connector.alterTable(
      defineAlter(tableName, (a) =>
        a.renameIndex('idx_pg_alter_idx_name', 'idx_pg_alter_idx_renamed'),
      ),
    );
    await connector.alterTable(
      defineAlter(tableName, (a) => a.removeIndex('idx_pg_alter_idx_renamed')),
    );
    await connector.alterTable(defineAlter(tableName, (a) => a.addIndex(['name'])));
    await connector.alterTable(defineAlter(tableName, (a) => a.removeIndex(['name'])));
    await connector.dropTable(tableName);
  });

  it('addForeignKey + removeForeignKey with stable default name', async () => {
    const parent = 'pg_alter_parent';
    const child = 'pg_alter_child';
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
        a.addForeignKey(parent, { column: 'parentId', onDelete: 'cascade', onUpdate: 'noAction' }),
      ),
    );
    await connector.alterTable(defineAlter(child, (a) => a.removeForeignKey(parent)));
    await connector.dropTable(child);
    await connector.dropTable(parent);
  });

  it('addCheckConstraint / removeCheckConstraint enforce predicates', async () => {
    const tableName = 'pg_alter_check';
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

describe('PostgresConnector#queryScoped', () => {
  const usersTable = 'pg_qs_users';
  const todosTable = 'pg_qs_todos';
  const ordersTable = 'pg_qs_orders';

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

runModelConformance({
  name: 'PostgresConnector',
  makeConnector: () => connector,
});
