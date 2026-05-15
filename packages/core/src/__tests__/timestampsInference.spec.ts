import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model } from '../index.js';

// Schema with all four combinations of createdAt / updatedAt presence.
const schema = defineSchema({
  with_both: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      createdAt: { type: 'datetime', null: true },
      updatedAt: { type: 'datetime', null: true },
    },
  },
  only_created: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      createdAt: { type: 'datetime', null: true },
    },
  },
  only_updated: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      updatedAt: { type: 'datetime', null: true },
    },
  },
  neither: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

describe('Model factory — inferred timestamps default', () => {
  it('enables both columns when the schema declares both', async () => {
    class WithBoth extends Model({ tableName: 'with_both', connector: freshConnector() }) {}
    const created = await WithBoth.create({ name: 'a' });
    const attrs = created.attributes as Record<string, unknown>;
    expect(attrs.createdAt).toBeInstanceOf(Date);
    expect(attrs.updatedAt).toBeInstanceOf(Date);
  });

  it('disables updatedAt when only createdAt is declared', async () => {
    class OnlyCreated extends Model({ tableName: 'only_created', connector: freshConnector() }) {}
    const created = await OnlyCreated.create({ name: 'b' });
    const attrs = created.attributes as Record<string, unknown>;
    expect(attrs.createdAt).toBeInstanceOf(Date);
    // The factory must NOT have tried to write an `updatedAt` column the
    // schema does not declare.
    expect('updatedAt' in attrs).toBe(false);
  });

  it('disables createdAt when only updatedAt is declared', async () => {
    class OnlyUpdated extends Model({ tableName: 'only_updated', connector: freshConnector() }) {}
    const created = await OnlyUpdated.create({ name: 'c' });
    const attrs = created.attributes as Record<string, unknown>;
    expect(attrs.updatedAt).toBeInstanceOf(Date);
    expect('createdAt' in attrs).toBe(false);
  });

  it('disables both when the schema declares neither', async () => {
    class Neither extends Model({ tableName: 'neither', connector: freshConnector() }) {}
    const created = await Neither.create({ name: 'd' });
    const attrs = created.attributes as Record<string, unknown>;
    expect('createdAt' in attrs).toBe(false);
    expect('updatedAt' in attrs).toBe(false);
  });

  it('explicit timestamps: false wins even when both columns exist', async () => {
    class WithBothOff extends Model({
      tableName: 'with_both',
      connector: freshConnector(),
      timestamps: false,
    }) {}
    const created = await WithBothOff.create({ name: 'e' });
    const attrs = created.attributes as Record<string, unknown>;
    expect('createdAt' in attrs).toBe(false);
    expect('updatedAt' in attrs).toBe(false);
  });

  it('explicit timestamps: true wins (matches old default) when both columns exist', async () => {
    class WithBothOn extends Model({
      tableName: 'with_both',
      connector: freshConnector(),
      timestamps: true,
    }) {}
    const created = await WithBothOn.create({ name: 'f' });
    const attrs = created.attributes as Record<string, unknown>;
    expect(attrs.createdAt).toBeInstanceOf(Date);
    expect(attrs.updatedAt).toBeInstanceOf(Date);
  });

  it('partial-object timestamps disable inference (createdAt only)', async () => {
    class CustomOnlyCreated extends Model({
      tableName: 'only_created',
      connector: freshConnector(),
      timestamps: { createdAt: true, updatedAt: false },
    }) {}
    const created = await CustomOnlyCreated.create({ name: 'g' });
    const attrs = created.attributes as Record<string, unknown>;
    expect(attrs.createdAt).toBeInstanceOf(Date);
    expect('updatedAt' in attrs).toBe(false);
  });
});
