import { defineSchema, MemoryConnector, Model, ValidationError } from '@next-model/core';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { fromArkType } from '../fromArkType.js';

describe('fromArkType — column derivation', () => {
  it('maps arktype primitives to schema-DSL kinds', () => {
    const t = type({
      name: 'string',
      age: 'number.integer',
      score: 'number',
      active: 'boolean',
      tags: 'string[]',
      metadata: { source: 'string' },
    });
    const byName = Object.fromEntries(
      fromArkType(t)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(byName.name.kind).toBe('string');
    expect(byName.age.kind).toBe('integer');
    expect(byName.score.kind).toBe('float');
    expect(byName.active.kind).toBe('boolean');
    expect(byName.tags.kind).toBe('json');
    expect(byName.metadata.kind).toBe('json');
  });

  it('detects single-unit literal columns (boolean/string/number)', () => {
    const t = type({
      flag: 'true',
      label: "'admin'",
      ten: '10',
    });
    const byName = Object.fromEntries(
      fromArkType(t)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(byName.flag.kind).toBe('boolean');
    expect(byName.label.kind).toBe('string');
    expect(byName.ten.kind).toBe('integer');
  });

  it('treats literal string unions (enum-ish) as string columns', () => {
    const t = type({
      role: "'admin'|'member'|'guest'",
    });
    expect(fromArkType(t).describeColumns()[0]?.kind).toBe('string');
  });

  it('handles unknown / free-form unions as text', () => {
    const t = type({
      mystery: 'string|number',
    });
    expect(fromArkType(t).describeColumns()[0]?.kind).toBe('text');
  });

  it('marks nullable unions (`string|null`) as nullable', () => {
    const t = type({
      maybe: 'string|null',
    });
    expect(fromArkType(t).describeColumns()[0]?.options.null).toBe(true);
  });

  it('returns an empty column list when the type has no introspectable keys', () => {
    const t = type('string');
    expect(fromArkType(t).describeColumns()).toEqual([]);
  });

  it('treats optional (`?` suffix) props as nullable', () => {
    const t = type({
      required: 'string',
      'nickname?': 'string',
    });
    const cols = Object.fromEntries(
      fromArkType(t)
        .describeColumns()
        .map((c) => [c.name, c]),
    );
    expect(cols.required.options.null).toBe(false);
    expect(cols.nickname.options.null).toBe(true);
  });
});

describe('fromArkType — init + validators', () => {
  const t = type({
    name: 'string>=2',
    age: 'number.integer>=0',
  });

  it('init returns parsed data on success', () => {
    const { init } = fromArkType(t);
    expect(init({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
  });

  it("init throws ValidationError with arktype's summary", () => {
    const { init } = fromArkType(t);
    try {
      init({ name: 'A', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as Error).message.length).toBeGreaterThan(0);
      return;
    }
    throw new Error('expected init to throw');
  });

  it('validator returns true/false', () => {
    const { validators } = fromArkType(t);
    expect(validators[0]({ attributes: { name: 'Ada', age: 36 } })).toBe(true);
    expect(validators[0]({ attributes: { name: 'A', age: -1 } })).toBe(false);
  });
});

describe('fromArkType — end-to-end with Model', () => {
  it('can drive Model init + validators from a single arktype', async () => {
    const UserType = type({
      name: 'string>=2',
      age: 'number.integer>=0',
    });
    const bridge = fromArkType(UserType);
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

describe('fromArkType — toTypedColumns', () => {
  it('produces a column map that defineSchema accepts', () => {
    const UserType = type({
      id: 'number.integer',
      email: 'string',
      name: 'string',
      'age?': 'number.integer',
    });
    const bridge = fromArkType(UserType);

    const cols = bridge.toTypedColumns();
    expect(cols).toEqual({
      id: { type: 'integer', null: false },
      email: { type: 'string', null: false },
      name: { type: 'string', null: false },
      age: { type: 'integer', null: true },
    });
  });

  it('the column map round-trips through defineSchema + Model end-to-end', async () => {
    const UserType = type({
      id: 'number.integer',
      email: 'string',
      name: 'string',
    });
    const bridge = fromArkType(UserType);

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
});
