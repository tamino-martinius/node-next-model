import { describe, expect, it } from 'vitest';

import { MemoryConnector, Model } from '../index.js';

interface Row {
  id?: number;
  name: string;
  age: number;
  active: boolean;
  note: string;
}

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} });
}

function buildUser(connector: MemoryConnector) {
  return class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
    init: (props: Row) => props,
  }) {};
}

async function seed(User: ReturnType<typeof buildUser>) {
  await User.createMany([
    { name: 'Ada', age: 36, active: true, note: 'secret a' },
    { name: 'Linus', age: 12, active: true, note: 'secret b' },
    { name: 'Old', age: 99, active: false, note: 'secret c' },
  ]);
}

describe('Model.fields chainable', () => {
  it('restricts all() to the listed columns (plus the primary key)', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const rows = await User.fields('name').all();
    for (const row of rows) {
      const attrs = row.attributes as Record<string, unknown>;
      expect(attrs.id).toBeDefined(); // primary key always included
      expect(attrs.name).toBeDefined();
      expect(attrs.age).toBeUndefined();
      expect(attrs.note).toBeUndefined();
    }
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['Ada', 'Linus', 'Old']);
  });

  it('composes with filterBy + orderBy', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const rows = await User.filterBy({ active: true })
      .orderBy({ key: 'age', dir: -1 })
      .fields('name', 'age')
      .all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['Ada', 'Linus']);
    const sample = rows[0].attributes as Record<string, unknown>;
    expect(sample.note).toBeUndefined();
  });

  it('first() and last() respect the chain', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const first = await User.fields('name').first();
    expect(first).toBeDefined();
    const firstAttrs = first!.attributes as Record<string, unknown>;
    expect(firstAttrs.name).toBe('Ada');
    expect(firstAttrs.note).toBeUndefined();

    const last = await User.fields('name').last();
    expect((last!.attributes as Row).name).toBe('Old');
  });

  it('find() honours the chain', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const row = await User.fields('name').find(2);
    const attrs = row.attributes as Record<string, unknown>;
    expect(attrs.id).toBe(2);
    expect(attrs.name).toBe('Linus');
    expect(attrs.note).toBeUndefined();
  });

  it('primary key is included even when not listed', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const rows = await User.fields('name').all();
    for (const row of rows) {
      expect((row.attributes as Row).id).toBeDefined();
    }
  });

  it('allFields() resets back to the full fetch', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const partial = User.fields('name');
    const full = partial.allFields();
    const row = (await full.first())!.attributes as Row;
    expect(row.age).toBe(36);
    expect(row.note).toBe('secret a');
  });

  it('unscoped() also clears the field selection', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const partial = User.fields('name');
    const reset = partial.unscoped();
    const row = (await reset.first())!.attributes as Row;
    expect(row.age).toBe(36);
    expect(row.note).toBe('secret a');
  });
});
