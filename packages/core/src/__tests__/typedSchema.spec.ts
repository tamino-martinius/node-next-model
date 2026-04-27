import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineSchema, KeyType, MemoryConnector, Model } from '../index.js';

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
