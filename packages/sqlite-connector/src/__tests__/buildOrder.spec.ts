import { defineSchema, SortDirection } from '@next-model/core';
import { afterEach, describe, expect, it } from 'vitest';

import { SqliteConnector } from '../index.js';

const schema = defineSchema({
  items: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      label: { type: 'string', null: false },
      createdAt: { type: 'integer', null: false },
    },
  },
});

describe('SqliteConnector buildOrder', () => {
  let connector: SqliteConnector<typeof schema> | undefined;

  afterEach(() => {
    connector?.destroy();
    connector = undefined;
  });

  async function seed() {
    const c = new SqliteConnector(':memory:', { schema });
    connector = c;
    await c.ensureSchema();
    await c.batchInsert('items', { id: 1 } as any, [
      { label: 'b', createdAt: 200 },
      { label: 'a', createdAt: 300 },
      { label: 'c', createdAt: 100 },
    ]);
    return c;
  }

  it('orders ascending with strict { key, dir: Asc }', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ key: 'createdAt', dir: SortDirection.Asc }],
    });
    expect(rows.map((r) => r.label)).toEqual(['c', 'b', 'a']);
  });

  it('orders descending with strict { key, dir: Desc }', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ key: 'createdAt', dir: SortDirection.Desc }],
    });
    expect(rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('defaults to ascending when strict { key } has no dir', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ key: 'createdAt' }],
    });
    expect(rows.map((r) => r.label)).toEqual(['c', 'b', 'a']);
  });

  it('accepts conventional { [col]: "asc" } shape', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      // Loose shape — typed elsewhere as any, common ORM convention.
      order: [{ createdAt: 'asc' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['c', 'b', 'a']);
  });

  it('accepts conventional { [col]: "desc" } shape', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ createdAt: 'desc' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('accepts uppercase DESC in either shape', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ createdAt: 'DESC' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('accepts string dir on the strict shape', async () => {
    const c = await seed();
    const rows = await c.query({
      tableName: 'items',
      order: [{ key: 'createdAt', dir: 'desc' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('supports multiple order entries in mixed shapes', async () => {
    const c = await seed();
    await c.batchInsert('items', { id: 1 } as any, [{ label: 'a', createdAt: 50 }]);
    const rows = await c.query({
      tableName: 'items',
      order: [{ label: 'asc' } as any, { key: 'createdAt', dir: SortDirection.Desc }],
    });
    // labels grouped a, a, b, c; within label 'a' the createdAt 300 comes first then 50
    expect(rows.map((r) => `${r.label}/${r.createdAt}`)).toEqual([
      'a/300',
      'a/50',
      'b/200',
      'c/100',
    ]);
  });
});
