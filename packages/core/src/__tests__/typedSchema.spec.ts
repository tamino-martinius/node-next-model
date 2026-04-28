import { describe, expect, expectTypeOf, it } from 'vitest';
import type { TableDefinition } from '../index.js';
import {
  defineSchema,
  defineTable,
  generateSchemaSource,
  KeyType,
  MemoryConnector,
  Model,
} from '../index.js';

describe('defineSchema', () => {
  it('produces a TypedSchema with a runtime TableDefinition', () => {
    const schema = defineSchema({
      tableName: 'users',
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        email: { type: 'string' },
        archivedAt: { type: 'timestamp', null: true },
      },
    });
    expect(schema.tableName).toBe('users');
    expect(schema.tableDefinition.name).toBe('users');
    expect(schema.tableDefinition.columns).toHaveLength(3);
    expect(schema.tableDefinition.primaryKey).toBe('id');
    expect(schema.tableDefinition.columns[2].nullable).toBe(true);
  });

  it('derives correct primary key column', () => {
    const schema = defineSchema({
      tableName: 'sessions',
      columns: {
        token: { type: 'string', primary: true },
        userId: { type: 'integer' },
      },
    });
    expect(schema.tableDefinition.primaryKey).toBe('token');
  });

  it('forwards autoIncrement / unique / default flags into the TableDefinition', () => {
    const schema = defineSchema({
      tableName: 'tokens',
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        slug: { type: 'string', unique: true },
        kind: { type: 'string', default: 'api' },
      },
    });
    const cols = schema.tableDefinition.columns;
    expect(cols.find((c) => c.name === 'id')?.autoIncrement).toBe(true);
    expect(cols.find((c) => c.name === 'slug')?.unique).toBe(true);
    expect(cols.find((c) => c.name === 'kind')?.default).toBe('api');
  });

  it('preserves indexes passed to the spec', () => {
    const schema = defineSchema({
      tableName: 'logs',
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        userId: { type: 'integer' },
      },
      indexes: [{ columns: ['userId'], unique: false }],
    });
    expect(schema.tableDefinition.indexes).toEqual([{ columns: ['userId'], unique: false }]);
  });
});

describe('Model with schema', () => {
  const usersSchema = defineSchema({
    tableName: 'users',
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string' },
      name: { type: 'string' },
      age: { type: 'integer' },
      archivedAt: { type: 'timestamp', null: true },
    },
  });

  it('works without explicit init / tableName / keys', async () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}

    const u = await User.create({
      email: 'a@b',
      name: 'Ada',
      age: 30,
      archivedAt: null,
    });
    expect(u.email).toBe('a@b');
    expect(u.age).toBe(30);
    expect(u.archivedAt).toBeNull();
    expect(typeof u.id).toBe('number');
  });

  it('infers prop types from the schema', async () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}

    const u = await User.create({
      email: 'a@b',
      name: 'A',
      age: 30,
      archivedAt: null,
    });
    expectTypeOf(u.email).toBeString();
    expectTypeOf(u.age).toBeNumber();
    expectTypeOf(u.archivedAt).toEqualTypeOf<Date | null>();
  });

  it('derives tableName from the schema', () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(User.tableName).toBe('users');
  });

  it('derives keys from the schema (numeric primary → KeyType.number)', () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(User.keys).toEqual({ id: KeyType.number });
  });

  it('allows optional explicit init for transformation', async () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
      init: (p) => ({ ...p, email: p.email.toLowerCase() }),
    }) {}

    const u = await User.create({ email: 'A@B', name: 'A', age: 30, archivedAt: null });
    expect(u.email).toBe('a@b');
  });

  it('allows tableName override', () => {
    class User extends Model({
      schema: usersSchema,
      tableName: 'staff',
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(User.tableName).toBe('staff');
  });

  it('schema with string primary key derives KeyType.uuid', async () => {
    const sessionsSchema = defineSchema({
      tableName: 'sessions',
      columns: {
        token: { type: 'string', primary: true },
        userId: { type: 'integer' },
      },
    });
    class Session extends Model({
      schema: sessionsSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(Session.keys).toEqual({ token: KeyType.uuid });
  });

  it('falls back to {id: KeyType.number} when no primary column is declared', () => {
    const orphanSchema = defineSchema({
      tableName: 'orphan',
      columns: {
        name: { type: 'string' },
      },
    });
    class Orphan extends Model({
      schema: orphanSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(Orphan.keys).toEqual({ id: KeyType.number });
  });

  it('honours an explicit keys override', () => {
    class User extends Model({
      schema: usersSchema,
      keys: { id: KeyType.uuid },
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    expect(User.keys).toEqual({ id: KeyType.uuid });
  });

  it('chainable methods work through the schema-driven Model', async () => {
    class User extends Model({
      schema: usersSchema,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    await User.create({ email: 'a@b', name: 'A', age: 30, archivedAt: null });
    await User.create({ email: 'b@c', name: 'B', age: 25, archivedAt: null });
    const adults = await User.filterBy({ $gte: { age: 28 } }).all();
    expect(adults).toHaveLength(1);
    expect(adults[0].name).toBe('A');
  });
});

describe('Legacy form still works', () => {
  it('Model with explicit init/tableName works unchanged', async () => {
    class Post extends Model({
      tableName: 'posts',
      init: (p: { title: string; views: number }) => p,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    const p = await Post.create({ title: 'Hi', views: 5 });
    expect(p.title).toBe('Hi');
    expect(p.views).toBe(5);
  });

  it('legacy form still infers types from init parameter', async () => {
    class Post extends Model({
      tableName: 'posts',
      init: (p: { title: string; views: number }) => p,
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}
    const p = await Post.create({ title: 'Hi', views: 5 });
    expectTypeOf(p.title).toBeString();
    expectTypeOf(p.views).toBeNumber();
  });
});

describe('Interface-generic form (Model<Props>({...}) without init)', () => {
  interface UserProps {
    email: string;
    name: string;
    archivedAt: Date | null;
  }

  it('typechecks and round-trips create/update without an init callback', async () => {
    class User extends Model<UserProps>({
      tableName: 'users',
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}

    const u = await User.create({ email: 'a@b', name: 'Ada', archivedAt: null });
    expect(u.email).toBe('a@b');
    expect(u.name).toBe('Ada');
    expect(u.archivedAt).toBeNull();
    expect(typeof u.id).toBe('number');

    await u.update({ name: 'Ada Lovelace' });
    expect(u.name).toBe('Ada Lovelace');
    const reloaded = await User.find(u.id);
    expect(reloaded.name).toBe('Ada Lovelace');
  });

  it('infers prop types from the generic argument', async () => {
    class User extends Model<UserProps>({
      tableName: 'users',
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
    }) {}

    const u = await User.create({ email: 'a@b', name: 'Ada', archivedAt: null });
    expectTypeOf(u.email).toBeString();
    expectTypeOf(u.name).toBeString();
    expectTypeOf(u.archivedAt).toEqualTypeOf<Date | null>();
  });

  it('still accepts a custom init that transforms — generic types its parameter', async () => {
    class User extends Model<UserProps>({
      tableName: 'users',
      connector: new MemoryConnector({ storage: {} }),
      timestamps: false,
      init: (p) => {
        // The generic types `p` as UserProps without per-field annotations.
        expectTypeOf(p).toEqualTypeOf<UserProps>();
        return { ...p, email: p.email.toLowerCase() };
      },
    }) {}

    const u = await User.create({ email: 'A@B', name: 'A', archivedAt: null });
    expect(u.email).toBe('a@b');
    expectTypeOf(u.email).toBeString();
  });
});

/**
 * Round-trip helper: evaluate the generated source in a `node:vm` sandbox
 * with `defineSchema` injected. The generator emits standard ES-module syntax
 * (`import { defineSchema } ...; export const userSchema = defineSchema(...)`)
 * which we rewrite into top-level statements before running them in the
 * sandbox so we can collect the resulting schemas. `vm` is the standard
 * Node-supplied sandbox for evaluating untrusted source.
 */
async function evalGeneratedSource(source: string): Promise<Record<string, any>> {
  const vm = await import('node:vm');
  const stripped = source
    .split('\n')
    .filter((line) => !line.startsWith('//'))
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .replace(/^export const /gm, 'const ');
  const names = Array.from(stripped.matchAll(/const (\w+) = defineSchema/g)).map((m) => m[1]);
  const program = `${stripped}\n__exports = { ${names.join(', ')} };`;
  const sandbox: Record<string, any> = { defineSchema, __exports: undefined, Date };
  const context = vm.createContext(sandbox);
  vm.runInContext(program, context);
  return sandbox.__exports;
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
    expect(source).toContain('export const usersSchema = defineSchema({');
    expect(source).toContain('tableName: "users"');

    const mod = await evalGeneratedSource(source);
    expect(mod.usersSchema.tableName).toBe('users');
    expect(mod.usersSchema.tableDefinition).toEqual(usersTable);
  });

  it('camelCases multi-word table names into <camelCase>Schema consts', () => {
    const projectsTable = defineTable('user_profile_avatars', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
    });
    const source = generateSchemaSource([projectsTable]);
    expect(source).toContain('export const userProfileAvatarsSchema = defineSchema({');
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
    const { eventsSchema } = await evalGeneratedSource(source);
    expect(eventsSchema.tableDefinition.columns[0].nullable).toBe(true);
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
    const { usersSchema } = await evalGeneratedSource(source);
    expect(usersSchema.tableDefinition).toEqual(t);
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
    const { settingsSchema } = await evalGeneratedSource(source);
    expect(settingsSchema.tableDefinition).toEqual(t);
  });

  it("emits 'currentTimestamp' literal verbatim for timestamp defaults", async () => {
    const t = defineTable('logs', (tbl) => {
      tbl.timestamp('seenAt', { default: 'currentTimestamp', null: false });
    });
    const source = generateSchemaSource([t]);
    expect(source).toContain("default: 'currentTimestamp'");
    const { logsSchema } = await evalGeneratedSource(source);
    expect(logsSchema.tableDefinition).toEqual(t);
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
    const { auditsSchema } = await evalGeneratedSource(source);
    const col = auditsSchema.tableDefinition.columns[0];
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

    const { logsSchema, plainSchema } = await evalGeneratedSource(source);
    expect(logsSchema.tableDefinition).toEqual(withIdx);
    expect(plainSchema.tableDefinition).toEqual(noIdx);
    // The "plain" block should NOT carry an indexes: [] line because the
    // emitter omits it when the array is empty.
    const plainBlock = source.split('export const plainSchema')[1] ?? '';
    expect(plainBlock).not.toContain('indexes: [');
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
    const evaluated = await evalGeneratedSource(source);
    expect(evaluated.usersSchema.tableDefinition).toEqual(usersTable);
    expect(evaluated.postsSchema.tableDefinition).toEqual(postsTable);
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
});
