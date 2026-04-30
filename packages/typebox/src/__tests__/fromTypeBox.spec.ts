import { defineSchema, MemoryConnector, Model, ValidationError } from '@next-model/core';
import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';

import { fromTypeBox } from '../fromTypeBox.js';

describe('fromTypeBox — column derivation', () => {
  it('maps TypeBox primitives to schema-DSL kinds', () => {
    const schema = Type.Object({
      name: Type.String(),
      age: Type.Integer(),
      score: Type.Number(),
      active: Type.Boolean(),
      createdAt: Type.String({ format: 'date-time' }),
      tags: Type.Array(Type.String()),
      metadata: Type.Object({ source: Type.String() }),
      role: Type.Union([Type.Literal('admin'), Type.Literal('member')]),
    });
    const byName = Object.fromEntries(
      fromTypeBox(schema)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(byName.name.kind).toBe('string');
    expect(byName.age.kind).toBe('integer');
    expect(byName.score.kind).toBe('float');
    expect(byName.active.kind).toBe('boolean');
    expect(byName.createdAt.kind).toBe('datetime');
    expect(byName.tags.kind).toBe('json');
    expect(byName.metadata.kind).toBe('json');
  });

  it('marks fields not in `required` as nullable', () => {
    const schema = Type.Object({
      required: Type.String(),
      opt: Type.Optional(Type.String()),
      withDefault: Type.String({ default: 'hi' }),
      nullable: Type.Union([Type.String(), Type.Null()]),
    });
    const cols = Object.fromEntries(
      fromTypeBox(schema)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(cols.required.options.null).toBe(false);
    expect(cols.opt.options.null).toBe(true);
    expect(cols.withDefault.options.null).toBe(true);
    expect(cols.withDefault.options.default).toBe('hi');
    expect(cols.nullable.options.null).toBe(true);
  });
});

describe('fromTypeBox — init + validators', () => {
  const schema = Type.Object({
    name: Type.String({ minLength: 2 }),
    age: Type.Integer({ minimum: 0 }),
  });

  it('init returns parsed data on success', () => {
    const { init } = fromTypeBox(schema);
    expect(init({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
  });

  it('init throws ValidationError with a formatted issue list', () => {
    const { init } = fromTypeBox(schema);
    try {
      init({ name: 'A', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as Error).message.length).toBeGreaterThan(0);
      return;
    }
    throw new Error('expected init to throw');
  });

  it('init fills in schema defaults', () => {
    const s = Type.Object({
      name: Type.String(),
      active: Type.Boolean({ default: true }),
    });
    const { init } = fromTypeBox(s);
    expect(init({ name: 'Ada' })).toEqual({ name: 'Ada', active: true });
  });

  it('validator returns true/false', () => {
    const { validators } = fromTypeBox(schema);
    expect(validators[0]({ attributes: { name: 'Ada', age: 36 } })).toBe(true);
    expect(validators[0]({ attributes: { name: 'A', age: -1 } })).toBe(false);
  });
});

describe('fromTypeBox — end-to-end with Model', () => {
  it('can drive Model init + validators from a single schema', async () => {
    const UserSchema = Type.Object({
      name: Type.String({ minLength: 2 }),
      age: Type.Integer({ minimum: 0 }),
    });
    const bridge = fromTypeBox(UserSchema);
    const connector = new MemoryConnector({ storage: {}, lastIds: {} });
    class User extends Model({
      tableName: 'users',
      connector,
      timestamps: false,
      init: bridge.init,
      validators: bridge.validators,
    }) {}

    const ada = await User.create({ name: 'Ada', age: 36 });
    expect((ada.attributes as { name: string }).name).toBe('Ada');

    await expect(User.create({ name: 'A', age: -1 } as any)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('fromTypeBox — toTypedColumns', () => {
  it('produces a column map that defineSchema accepts', () => {
    const UserSchema = Type.Object({
      id: Type.Integer(),
      email: Type.String(),
      name: Type.String(),
      age: Type.Optional(Type.Integer()),
    });
    const bridge = fromTypeBox(UserSchema);

    const cols = bridge.toTypedColumns();
    expect(cols).toEqual({
      id: { type: 'integer', null: false },
      email: { type: 'string', null: false },
      name: { type: 'string', null: false },
      age: { type: 'integer', null: true },
    });
  });

  it('the column map round-trips through defineSchema + Model end-to-end', async () => {
    const UserSchema = Type.Object({
      id: Type.Integer(),
      email: Type.String(),
      name: Type.String(),
    });
    const bridge = fromTypeBox(UserSchema);

    const schema = defineSchema({
      users: { columns: bridge.toTypedColumns() },
    });
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class User extends Model({
      connector,
      tableName: 'users',
      init: bridge.init,
      validators: bridge.validators,
      timestamps: false,
    }) {}

    const u = await User.create({ id: 1, email: 'a@b', name: 'Ada' });
    expect(u.email).toBe('a@b');
    expect(u.name).toBe('Ada');
  });

  it('preserves default values from TypeBox into the typed column', () => {
    // TypeBox's default goes via the schema's `default` keyword.
    const Schema = Type.Object({
      published: Type.Optional(Type.Boolean({ default: false })),
      count: Type.Optional(Type.Integer({ default: 0 })),
    });
    const cols = fromTypeBox(Schema).toTypedColumns();
    expect(cols.published.default).toBe(false);
    expect(cols.count.default).toBe(0);
    expect(cols.published.null).toBe(true);
    expect(cols.count.null).toBe(true);
  });
});
