import { describe, expect, it } from 'vitest';
import { MemoryConnector } from '../MemoryConnector.js';
import { Model } from '../Model.js';
import { defineSchema } from '../typedSchema.js';

describe('Property getters install from schema columns, not insert-time keys', () => {
  const schema = defineSchema({
    items: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        name: { type: 'string', null: false },
        archivedAt: { type: 'datetime', null: true },
        dismissedAt: { type: 'datetime', null: true },
        score: { type: 'integer', null: true },
      },
    },
  });

  function makeItem() {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    return class Item extends Model({ connector, tableName: 'items', timestamps: false }) {};
  }

  it('exposes a getter for a nullable column omitted at insert', async () => {
    const Item = makeItem();
    const row = await Item.create({ name: 'first' });
    // archivedAt was never passed to create(); the getter should still exist.
    const desc = Object.getOwnPropertyDescriptor(row, 'archivedAt');
    expect(desc).toBeDefined();
    expect((row as any).archivedAt).toBeUndefined();
  });

  it('reflects update({ col }) on a previously-absent nullable column without re-fetch', async () => {
    const Item = makeItem();
    const row = await Item.create({ name: 'first' });
    const ts = new Date('2026-01-01T00:00:00.000Z');
    await row.update({ archivedAt: ts });
    // The bug: pre-fix, this would read undefined.
    expect((row as any).archivedAt).toEqual(ts);
  });

  it('multiple omitted columns all become readable after update', async () => {
    const Item = makeItem();
    const row = await Item.create({ name: 'first' });
    await row.update({
      archivedAt: new Date('2026-01-02T00:00:00.000Z'),
      dismissedAt: new Date('2026-01-03T00:00:00.000Z'),
      score: 7,
    });
    expect((row as any).archivedAt).toBeInstanceOf(Date);
    expect((row as any).dismissedAt).toBeInstanceOf(Date);
    expect((row as any).score).toBe(7);
  });

  it('columns supplied at insert still read back through the getter', async () => {
    const Item = makeItem();
    const row = await Item.create({
      name: 'second',
      archivedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    expect((row as any).name).toBe('second');
    expect((row as any).archivedAt).toBeInstanceOf(Date);
  });

  it('setter routes through assign() for schema-installed getters', async () => {
    const Item = makeItem();
    const row = await Item.create({ name: 'third' });
    // Even though archivedAt was not present in persistentProps at construction,
    // the getter/setter exposed by the schema column should route through
    // assign() — landing the change in changedProps and making it readable.
    (row as any).archivedAt = new Date('2026-03-01T00:00:00.000Z');
    expect((row as any).archivedAt).toBeInstanceOf(Date);
    expect(row.isChanged()).toBe(true);
    expect(row.isChangedBy('archivedAt')).toBe(true);
  });
});
