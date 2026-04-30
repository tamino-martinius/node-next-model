import { describe, expect, expectTypeOf, it } from 'vitest';
import type { TableDefinition } from '../index.js';
import {
  defineSchema,
  defineTable,
  generateSchemaSource,
  MemoryConnector,
  Model,
} from '../index.js';

describe('defineSchema', () => {
  it('produces a DatabaseSchema with per-table runtime TableDefinitions', () => {
    const schema = defineSchema({
      users: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          email: { type: 'string' },
          archivedAt: { type: 'timestamp', null: true },
        },
      },
      posts: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          userId: { type: 'integer' },
          title: { type: 'string' },
        },
      },
    });
    expect(Object.keys(schema.tables).sort()).toEqual(['posts', 'users']);
    expect(schema.tableDefinitions.users.name).toBe('users');
    expect(schema.tableDefinitions.users.columns).toHaveLength(3);
    expect(schema.tableDefinitions.users.primaryKey).toBe('id');
    expect(schema.tableDefinitions.users.columns[2].nullable).toBe(true);

    expect(schema.tableDefinitions.posts.name).toBe('posts');
    expect(schema.tableDefinitions.posts.columns).toHaveLength(3);
    expect(schema.tableDefinitions.posts.primaryKey).toBe('id');
  });

  it('derives correct primary key column for each table', () => {
    const schema = defineSchema({
      sessions: {
        columns: {
          token: { type: 'string', primary: true },
          userId: { type: 'integer' },
        },
      },
    });
    expect(schema.tableDefinitions.sessions.primaryKey).toBe('token');
  });

  it('forwards autoIncrement / unique / default flags into the TableDefinition', () => {
    const schema = defineSchema({
      tokens: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          slug: { type: 'string', unique: true },
          kind: { type: 'string', default: 'api' },
        },
      },
    });
    const cols = schema.tableDefinitions.tokens.columns;
    expect(cols.find((c) => c.name === 'id')?.autoIncrement).toBe(true);
    expect(cols.find((c) => c.name === 'slug')?.unique).toBe(true);
    expect(cols.find((c) => c.name === 'kind')?.default).toBe('api');
  });

  it('preserves indexes passed to the spec', () => {
    const schema = defineSchema({
      logs: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          userId: { type: 'integer' },
        },
        indexes: [{ columns: ['userId'], unique: false }],
      },
    });
    expect(schema.tableDefinitions.logs.indexes).toEqual([{ columns: ['userId'], unique: false }]);
  });
});

describe('Model with connector-attached schema', () => {
  const dbSchema = defineSchema({
    users: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        email: { type: 'string' },
        name: { type: 'string' },
        archivedAt: { type: 'timestamp', null: true },
      },
    },
    posts: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        userId: { type: 'integer' },
        title: { type: 'string' },
      },
    },
  });

  it('infers props from the connector.schema for the named table', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: dbSchema });
    class User extends Model({ connector, tableName: 'users', timestamps: false }) {}

    const u = await User.create({
      email: 'a@b',
      name: 'Ada',
      archivedAt: null,
    });
    expect(u.email).toBe('a@b');
    expectTypeOf(u.email).toBeString();
    expectTypeOf(u.archivedAt).toEqualTypeOf<Date | null>();
    expect(typeof u.id).toBe('number');
  });

  it('multiple Models can attach to one connector by tableName', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: dbSchema });
    class User extends Model({ connector, tableName: 'users', timestamps: false }) {}
    class Post extends Model({ connector, tableName: 'posts', timestamps: false }) {}

    const u = await User.create({ email: 'a@b', name: 'Ada', archivedAt: null });
    const p = await Post.create({ userId: u.id, title: 'Hi' });

    expect(User.tableName).toBe('users');
    expect(Post.tableName).toBe('posts');
    expect(p.userId).toBe(u.id);
    expectTypeOf(p.title).toBeString();
    expectTypeOf(p.userId).toBeNumber();
  });

  it('throws at construction time when tableName is not on connector.schema', () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: dbSchema });
    expect(() => {
      class _Bad extends Model({
        connector,
        // @ts-expect-error — intentionally typing an unknown table name
        tableName: 'unknown',
        timestamps: false,
      }) {}
    }).toThrow(/tableName 'unknown' is not declared/);
  });

});

/**
 * Round-trip helper: evaluate the generated source in a `node:vm` sandbox
 * with `defineSchema` injected. The generator emits standard ES-module syntax
 * (`import { defineSchema } ...; export const schema = defineSchema(...)`)
 * which we rewrite into top-level statements before running them in the
 * sandbox so we can collect the resulting schema. `vm` is the standard
 * Node-supplied sandbox for evaluating untrusted source.
 */
async function evalGeneratedSource(
  source: string,
  exportName = 'schema',
): Promise<Record<string, any>> {
  const vm = await import('node:vm');
  const stripped = source
    .split('\n')
    .filter((line) => !line.startsWith('//'))
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .replace(/^export const /gm, 'const ');
  const program = `${stripped}\n__export = ${exportName};`;
  const sandbox: Record<string, any> = { defineSchema, __export: undefined, Date };
  const context = vm.createContext(sandbox);
  vm.runInContext(program, context);
  return sandbox.__export;
}

describe('generateSchemaSource', () => {
  it('emits a parseable module that round-trips through defineSchema', async () => {
    const usersTable = defineTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('email', { null: false, unique: true });
      t.string('name', { null: false });
      t.integer('age');
      t.timestamp('archivedAt', { null: true });
    });
    const source = generateSchemaSource([usersTable]);
    expect(source).toContain("import { defineSchema } from '@next-model/core';");
    expect(source).toContain('export const schema = defineSchema({');
    expect(source).toContain('users: {');

    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.users).toEqual(usersTable);
  });

  it('preserves table names verbatim (no camelCasing)', () => {
    const projectsTable = defineTable('user_profile_avatars', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const source = generateSchemaSource([projectsTable]);
    expect(source).toContain('user_profile_avatars: {');
  });

  it('drops default-valued options from emission (null: false, primary/unique/autoIncrement: false)', () => {
    const t = defineTable('tokens', (tbl) => {
      tbl.string('token', { null: false });
    });
    const source = generateSchemaSource([t]);
    expect(source).not.toContain('primary: false');
    expect(source).not.toContain('unique: false');
    expect(source).not.toContain('autoIncrement: false');
    expect(source).not.toContain('null: false');
    // sanity: still has the correct shape
    expect(source).toContain('token: { type: "string" }');
  });

  it('emits null: true for nullable columns', async () => {
    const t = defineTable('events', (tbl) => {
      tbl.string('payload', { null: true });
    });
    const source = generateSchemaSource([t]);
    expect(source).toContain('null: true');
    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.events.columns[0].nullable).toBe(true);
  });

  it('emits primary, unique, autoIncrement when explicitly true', async () => {
    const t = defineTable('users', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
      tbl.string('email', { unique: true, null: false });
    });
    const source = generateSchemaSource([t]);
    expect(source).toContain('primary: true');
    expect(source).toContain('autoIncrement: true');
    expect(source).toContain('unique: true');
    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.users).toEqual(t);
  });

  it('emits string defaults quoted, number / boolean as literals', async () => {
    const t = defineTable('settings', (tbl) => {
      tbl.string('kind', { default: 'api', null: false });
      tbl.integer('count', { default: 0, null: false });
      tbl.boolean('active', { default: true, null: false });
    });
    const source = generateSchemaSource([t]);
    expect(source).toContain('default: "api"');
    expect(source).toContain('default: 0');
    expect(source).toContain('default: true');
    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.settings).toEqual(t);
  });

  it("emits 'currentTimestamp' literal verbatim for timestamp defaults", async () => {
    const t = defineTable('logs', (tbl) => {
      tbl.timestamp('seenAt', { default: 'currentTimestamp', null: false });
    });
    const source = generateSchemaSource([t]);
    expect(source).toContain("default: 'currentTimestamp'");
    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.logs).toEqual(t);
  });

  it('emits Date defaults as new Date(...)', async () => {
    const epoch = new Date('2026-01-01T00:00:00.000Z');
    const t: TableDefinition = {
      name: 'audits',
      columns: [
        {
          name: 'happenedAt',
          type: 'timestamp',
          nullable: false,
          default: epoch,
          primary: false,
          unique: false,
          autoIncrement: false,
        },
      ],
      indexes: [],
    };
    const source = generateSchemaSource([t]);
    expect(source).toContain('default: new Date("2026-01-01T00:00:00.000Z")');
    const schema = await evalGeneratedSource(source);
    const col = schema.tableDefinitions.audits.columns[0];
    expect(col.default instanceof Date).toBe(true);
    expect((col.default as Date).toISOString()).toBe(epoch.toISOString());
  });

  it('emits indexes when non-empty and skips the indexes key when empty', async () => {
    const withIdx = defineTable('logs', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
      tbl.integer('userId');
      tbl.index(['userId'], { name: 'idx_logs_user' });
      tbl.index(['userId', 'id'], { unique: true });
    });
    const noIdx = defineTable('plain', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const source = generateSchemaSource([withIdx, noIdx]);
    expect(source).toContain('indexes: [');
    expect(source).toContain('columns: ["userId"]');
    expect(source).toContain('name: "idx_logs_user"');
    expect(source).toContain('unique: true');

    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.logs).toEqual(withIdx);
    expect(schema.tableDefinitions.plain).toEqual(noIdx);
    // The "plain" block should NOT carry an indexes: [] line because the
    // emitter omits it when the array is empty.
    const plainBlock = source.split('plain: {')[1] ?? '';
    const plainHeadBlock = plainBlock.split('},')[0] ?? '';
    expect(plainHeadBlock).not.toContain('indexes: [');
  });

  it('honours options.importPath for the defineSchema import', () => {
    const t = defineTable('thing', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const source = generateSchemaSource([t], { importPath: '@my/core-alias' });
    expect(source).toContain("from '@my/core-alias'");
  });

  it('honours options.header (and supports suppressing it via empty string)', () => {
    const t = defineTable('thing', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const customHeader = generateSchemaSource([t], { header: '// custom header line' });
    expect(customHeader.startsWith('// custom header line')).toBe(true);
    const noHeader = generateSchemaSource([t], { header: '' });
    expect(noHeader.startsWith('//')).toBe(false);
    expect(noHeader.startsWith('import ')).toBe(true);
  });

  it('honours options.exportName to override the exported binding', () => {
    const t = defineTable('thing', (tbl) => {
      tbl.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const source = generateSchemaSource([t], { exportName: 'appDatabaseSchema' });
    expect(source).toContain('export const appDatabaseSchema = defineSchema({');
  });

  it('round-trips multiple tables in a single emission', async () => {
    const usersTable = defineTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('email', { null: false });
    });
    const postsTable = defineTable('posts', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('title', { null: false });
      t.integer('userId', { null: false });
      t.index(['userId']);
    });
    const source = generateSchemaSource([usersTable, postsTable]);
    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.users).toEqual(usersTable);
    expect(schema.tableDefinitions.posts).toEqual(postsTable);
  });

  it('quotes non-identifier column names', () => {
    const t: TableDefinition = {
      name: 'events',
      columns: [
        {
          name: 'has-dash',
          type: 'string',
          nullable: false,
          primary: false,
          unique: false,
          autoIncrement: false,
        },
      ],
      indexes: [],
    };
    const source = generateSchemaSource([t]);
    expect(source).toContain('"has-dash":');
  });

  it('emits an empty defineSchema({}) when given no tables', () => {
    const source = generateSchemaSource([]);
    expect(source).toContain('export const schema = defineSchema({});');
  });

  it('round-trips associations through defineSchema', async () => {
    const t: TableDefinition = {
      name: 'users',
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
      primaryKey: 'id',
      associations: {
        tasks: { hasMany: 'tasks', foreignKey: 'userId' },
        profile: { hasOne: 'profiles', foreignKey: 'userId' },
        company: { belongsTo: 'companies', foreignKey: 'companyId' },
        tags: {
          hasManyThrough: 'tags',
          through: 'taggings',
          throughForeignKey: 'userId',
          targetForeignKey: 'tagId',
        },
      },
    };
    const source = generateSchemaSource([t]);
    expect(source).toContain('associations: {');
    expect(source).toContain("tasks: { hasMany: 'tasks'");
    expect(source).toContain("profile: { hasOne: 'profiles'");
    expect(source).toContain("company: { belongsTo: 'companies'");
    expect(source).toContain("tags: { hasManyThrough: 'tags'");
    expect(source).toContain("through: 'taggings'");

    const schema = await evalGeneratedSource(source);
    expect(schema.tableDefinitions.users.associations).toEqual(t.associations);
  });

  it('omits the associations block when the table declares none', () => {
    const t = defineTable('events', (tbl) => {
      tbl.string('payload', { null: true });
    });
    const source = generateSchemaSource([t]);
    expect(source).not.toContain('associations:');
  });
});
