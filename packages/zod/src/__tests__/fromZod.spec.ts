import { defineSchema, MemoryConnector, Model, ValidationError } from '@next-model/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fromZod } from '../fromZod.js';

describe('fromZod - column derivation', () => {
  it('derives column kinds from zod primitives', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int(),
      score: z.number(),
      active: z.boolean(),
      createdAt: z.date(),
      tags: z.array(z.string()),
      metadata: z.object({ source: z.string() }),
      code: z.enum(['a', 'b']),
    });
    const bridge = fromZod(schema);
    const byName = Object.fromEntries(bridge.describeColumns().map((c) => [c.name, c]));
    expect(byName.name.kind).toBe('string');
    expect(byName.age.kind).toBe('integer');
    expect(byName.score.kind).toBe('float');
    expect(byName.active.kind).toBe('boolean');
    expect(byName.createdAt.kind).toBe('datetime');
    expect(byName.tags.kind).toBe('json');
    expect(byName.metadata.kind).toBe('json');
    expect(byName.code.kind).toBe('string');
  });

  it('marks required fields not-null and optional/default nullable', () => {
    const schema = z.object({
      required: z.string(),
      opt: z.string().optional(),
      nullable: z.string().nullable(),
      withDefault: z.string().default('hi'),
    });
    const cols = Object.fromEntries(
      fromZod(schema)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(cols.required.options.null).toBe(false);
    expect(cols.opt.options.null).toBe(true);
    expect(cols.nullable.options.null).toBe(true);
    expect(cols.withDefault.options.null).toBe(true);
    expect(cols.withDefault.options.default).toBe('hi');
  });
});

describe('fromZod - init + validators', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().nonnegative(),
  });

  it('init returns parsed data on success', () => {
    const { init } = fromZod(schema);
    expect(init({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
  });

  it('init throws ValidationError with a formatted issue list', () => {
    const { init } = fromZod(schema);
    try {
      init({ name: 'A', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as Error).message).toContain('name');
      expect((err as Error).message).toContain('age');
      return;
    }
    throw new Error('expected init to throw');
  });

  it('validator returns true/false for save() / isValid()', () => {
    const { validators } = fromZod(schema);
    expect(validators[0]({ attributes: { name: 'Ada', age: 36 } })).toBe(true);
    expect(validators[0]({ attributes: { name: 'A', age: -1 } })).toBe(false);
  });
});

describe('fromZod - end-to-end with Model', () => {
  it('can drive Model init + validators from a single schema', async () => {
    const UserSchema = z.object({
      name: z.string().min(2),
      age: z.number().int().nonnegative(),
    });
    const bridge = fromZod(UserSchema);
    const schema = defineSchema({
      users: { columns: bridge.toTypedColumns() },
    });
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
    class User extends Model({
      connector,
      tableName: 'users',
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

describe('fromZod — toTypedColumns', () => {
  it('produces a column map that defineSchema accepts', () => {
    const UserSchema = z.object({
      id: z.number().int(),
      email: z.string(),
      name: z.string(),
      age: z.number().int().optional(),
    });
    const bridge = fromZod(UserSchema);

    const cols = bridge.toTypedColumns();
    // Required fields → null: false; optional fields → null: true.
    expect(cols).toEqual({
      id: { type: 'integer', null: false },
      email: { type: 'string', null: false },
      name: { type: 'string', null: false },
      age: { type: 'integer', null: true },
    });
  });

  it('the column map round-trips through defineSchema + Model end-to-end', async () => {
    const UserSchema = z.object({
      id: z.number().int(),
      email: z.string(),
      name: z.string(),
    });
    const bridge = fromZod(UserSchema);

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

  it('preserves default values from zod .default() into the typed column', () => {
    const Schema = z.object({
      published: z.boolean().default(false),
      count: z.number().int().default(0),
    });
    const cols = fromZod(Schema).toTypedColumns();
    expect(cols.published.default).toBe(false);
    expect(cols.count.default).toBe(0);
    // Optional via .default() → null: true
    expect(cols.published.null).toBe(true);
    expect(cols.count.null).toBe(true);
  });
});
