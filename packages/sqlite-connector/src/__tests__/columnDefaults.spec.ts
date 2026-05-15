import { afterEach, describe, expect, it } from 'vitest';

import { SqliteConnector } from '../index.js';

describe('SqliteConnector builder column null default', () => {
  let connector: SqliteConnector<undefined> | undefined;

  afterEach(() => {
    connector?.destroy();
    connector = undefined;
  });

  it('produces NOT NULL columns by default (matches schema convention)', async () => {
    const c = new SqliteConnector(':memory:');
    connector = c;
    await c.createTable('cols_default', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
    });
    // Inserting without `name` must fail because the builder no longer
    // silently makes every column nullable.
    await expect(c.batchInsert('cols_default', { id: 1 } as any, [{} as any])).rejects.toThrow(
      /NOT NULL constraint failed/,
    );
  });

  it('respects explicit { null: true } for nullable columns', async () => {
    const c = new SqliteConnector(':memory:');
    connector = c;
    await c.createTable('cols_nullable', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name', { null: true });
    });
    const rows = await c.batchInsert('cols_nullable', { id: 1 } as any, [{} as any]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBeNull();
  });

  it('reflectSchema reports nullable: false for default columns', async () => {
    const c = new SqliteConnector(':memory:');
    connector = c;
    await c.createTable('cols_reflect', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.string('name');
      t.string('description', { null: true });
    });
    const tables = await c.reflectSchema();
    const t = tables.find((d) => d.name === 'cols_reflect');
    expect(t).toBeDefined();
    const name = t!.columns.find((col) => col.name === 'name')!;
    const description = t!.columns.find((col) => col.name === 'description')!;
    expect(name.nullable).toBe(false);
    expect(description.nullable).toBe(true);
  });
});
