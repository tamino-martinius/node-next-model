import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../errors.js';
import { MemoryConnector } from '../MemoryConnector.js';
import {
  type AlterTableSpec,
  applyAlterOps,
  defineAlter,
  defineTable,
  foreignKeyName,
} from '../schema.js';

describe('defineAlter', () => {
  it('produces an AlterTableSpec via the chainable builder', () => {
    const spec = defineAlter('users', (a) => {
      a.addColumn('email', 'string', { null: false });
      a.addIndex('email', { unique: true });
      a.removeColumn('legacy');
      a.renameColumn('first_name', 'firstName');
      a.changeColumn('age', 'integer', { null: false });
      a.renameIndex('idx_users_legacy', 'idx_users_email');
      a.removeIndex('idx_users_email');
      a.removeIndex(['email']);
      a.addForeignKey('teams', { onDelete: 'cascade' });
      a.removeForeignKey('teams');
      a.addCheckConstraint('age >= 0', { name: 'chk_age' });
      a.removeCheckConstraint('chk_age');
    });
    expect(spec.tableName).toBe('users');
    expect(spec.ops.map((o) => o.op)).toEqual([
      'addColumn',
      'addIndex',
      'removeColumn',
      'renameColumn',
      'changeColumn',
      'renameIndex',
      'removeIndex',
      'removeIndex',
      'addForeignKey',
      'removeForeignKey',
      'addCheckConstraint',
      'removeCheckConstraint',
    ]);
  });

  it('addReference is sugar for column + index + optional foreign key', () => {
    const spec = defineAlter('comments', (a) => {
      a.addReference('post', { foreignKey: { onDelete: 'cascade' } });
    });
    expect(spec.ops.map((o) => o.op)).toEqual(['addColumn', 'addIndex', 'addForeignKey']);
    const addColumn = spec.ops[0];
    expect(addColumn).toMatchObject({ op: 'addColumn', name: 'postId', type: 'integer' });
    const addIndex = spec.ops[1];
    expect(addIndex).toMatchObject({ op: 'addIndex', columns: ['postId'] });
    const addForeignKey = spec.ops[2];
    expect(addForeignKey).toMatchObject({ op: 'addForeignKey', toTable: 'post', column: 'postId' });
  });

  it('addReference omits the foreign-key op by default', () => {
    const spec = defineAlter('comments', (a) => a.addReference('post'));
    expect(spec.ops.map((o) => o.op)).toEqual(['addColumn', 'addIndex']);
  });

  it('removeReference emits removeForeignKey + removeColumn', () => {
    const spec = defineAlter('comments', (a) => a.removeReference('post'));
    expect(spec.ops.map((o) => o.op)).toEqual(['removeForeignKey', 'removeColumn']);
  });

  it('foreignKeyName produces a stable default constraint name', () => {
    expect(foreignKeyName('comments', 'posts')).toBe('fk_comments_posts');
  });
});

describe('applyAlterOps', () => {
  const usersTable = defineTable('users', (t) => {
    t.integer('id', { primary: true, autoIncrement: true, null: false });
    t.string('name');
    t.index('name', { name: 'idx_users_name' });
  });

  it('addColumn appends a column definition', () => {
    const next = applyAlterOps(usersTable, [
      { op: 'addColumn', name: 'email', type: 'string', options: { null: false } },
    ]);
    expect(next.columns.map((c) => c.name)).toEqual(['id', 'name', 'email']);
    const email = next.columns.find((c) => c.name === 'email');
    expect(email).toMatchObject({ type: 'string', nullable: false });
  });

  it('removeColumn drops the column and any index it participated in', () => {
    const next = applyAlterOps(usersTable, [{ op: 'removeColumn', name: 'name' }]);
    expect(next.columns.map((c) => c.name)).toEqual(['id']);
    expect(next.indexes).toEqual([]);
  });

  it('renameColumn updates both the column and matching indexes', () => {
    const next = applyAlterOps(usersTable, [{ op: 'renameColumn', from: 'name', to: 'fullName' }]);
    expect(next.columns.map((c) => c.name)).toEqual(['id', 'fullName']);
    expect(next.indexes[0].columns).toEqual(['fullName']);
  });

  it('changeColumn replaces the matching column definition', () => {
    const next = applyAlterOps(usersTable, [
      { op: 'changeColumn', name: 'name', type: 'text', options: { null: false } },
    ]);
    const renamed = next.columns.find((c) => c.name === 'name');
    expect(renamed).toMatchObject({ type: 'text', nullable: false });
  });

  it('addIndex / removeIndex (by name) maintain the indexes array', () => {
    let next = applyAlterOps(usersTable, [
      { op: 'addIndex', columns: ['id', 'name'], unique: true, name: 'idx_users_id_name' },
    ]);
    expect(next.indexes).toHaveLength(2);
    next = applyAlterOps(next, [{ op: 'removeIndex', nameOrColumns: 'idx_users_id_name' }]);
    expect(next.indexes.map((i) => i.name)).toEqual(['idx_users_name']);
  });

  it('removeIndex by columns removes the matching index even when name was not given', () => {
    const noName = defineTable('events', (t) => {
      t.integer('id', { primary: true });
      t.string('user_id');
      t.string('kind');
      t.index(['user_id', 'kind']);
    });
    const next = applyAlterOps(noName, [{ op: 'removeIndex', nameOrColumns: ['user_id', 'kind'] }]);
    expect(next.indexes).toEqual([]);
  });

  it('renameIndex updates the index name', () => {
    const next = applyAlterOps(usersTable, [
      { op: 'renameIndex', from: 'idx_users_name', to: 'idx_users_full_name' },
    ]);
    expect(next.indexes[0].name).toBe('idx_users_full_name');
  });
});

describe('MemoryConnector.alterTable', () => {
  function fresh(): MemoryConnector {
    return new MemoryConnector({ storage: {}, lastIds: {} });
  }

  async function seedUsers(connector: MemoryConnector): Promise<void> {
    await connector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
    });
    await connector.batchInsert('users', { id: 1 } as any, [{ name: 'Ada' }, { name: 'Linus' }]);
  }

  it('addColumn back-fills existing rows with the default value', async () => {
    const c = fresh();
    await seedUsers(c);
    await c.alterTable({
      tableName: 'users',
      ops: [
        {
          op: 'addColumn',
          name: 'role',
          type: 'string',
          options: { default: 'member' },
        },
      ],
    });
    const rows = await c.query({ tableName: 'users' });
    for (const row of rows) expect(row.role).toBe('member');
  });

  it('addColumn back-fills with null when no default is set', async () => {
    const c = fresh();
    await seedUsers(c);
    await c.alterTable({
      tableName: 'users',
      ops: [{ op: 'addColumn', name: 'lastSeenAt', type: 'datetime' }],
    });
    const rows = await c.query({ tableName: 'users' });
    for (const row of rows) expect(row.lastSeenAt).toBeNull();
  });

  it('removeColumn deletes the field from every row', async () => {
    const c = fresh();
    await seedUsers(c);
    await c.alterTable({ tableName: 'users', ops: [{ op: 'removeColumn', name: 'name' }] });
    const rows = await c.query({ tableName: 'users' });
    for (const row of rows) expect('name' in row).toBe(false);
  });

  it('renameColumn moves the value to the new field name', async () => {
    const c = fresh();
    await seedUsers(c);
    await c.alterTable({
      tableName: 'users',
      ops: [{ op: 'renameColumn', from: 'name', to: 'fullName' }],
    });
    const rows = await c.query({ tableName: 'users' });
    for (const row of rows) {
      expect('name' in row).toBe(false);
      expect(typeof row.fullName).toBe('string');
    }
  });

  it('throws UnsupportedOperationError for foreign keys and check constraints', async () => {
    const c = fresh();
    await seedUsers(c);
    const fkSpec: AlterTableSpec = {
      tableName: 'users',
      ops: [{ op: 'addForeignKey', toTable: 'orgs' }],
    };
    await expect(c.alterTable(fkSpec)).rejects.toBeInstanceOf(UnsupportedOperationError);
    const checkSpec: AlterTableSpec = {
      tableName: 'users',
      ops: [{ op: 'addCheckConstraint', expression: 'true' }],
    };
    await expect(c.alterTable(checkSpec)).rejects.toBeInstanceOf(UnsupportedOperationError);
  });
});
