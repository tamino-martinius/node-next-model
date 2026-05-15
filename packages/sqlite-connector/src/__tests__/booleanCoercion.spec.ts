import { defineSchema } from '@next-model/core';
import { afterEach, describe, expect, it } from 'vitest';

import { SqliteConnector } from '../index.js';

const schema = defineSchema({
  toggles: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      isDefault: { type: 'boolean', null: false },
      nullableFlag: { type: 'boolean', null: true },
      label: { type: 'string', null: false },
    },
  },
});

describe('SqliteConnector boolean coercion (read path)', () => {
  let connector: SqliteConnector<typeof schema> | SqliteConnector<undefined>;

  afterEach(() => {
    connector?.destroy();
  });

  it('coerces 0/1 → false/true strictly when a schema is attached', async () => {
    const c = new SqliteConnector(':memory:', { schema });
    connector = c;
    await c.ensureSchema();
    await c.batchInsert('toggles', { id: 1 } as any, [
      { isDefault: true, nullableFlag: false, label: 'a' },
      { isDefault: false, nullableFlag: true, label: 'b' },
    ]);
    const rows = await c.query({ tableName: 'toggles' });
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.label === 'a')!;
    const b = rows.find((r) => r.label === 'b')!;
    expect(a.isDefault).toBe(true);
    expect(a.nullableFlag).toBe(false);
    expect(b.isDefault).toBe(false);
    expect(b.nullableFlag).toBe(true);
    // Strict identity, not just truthy:
    expect(a.isDefault === true).toBe(true);
    expect(b.isDefault === false).toBe(true);
  });

  it('preserves null for nullable boolean columns', async () => {
    const c = new SqliteConnector(':memory:', { schema });
    connector = c;
    await c.ensureSchema();
    await c.batchInsert('toggles', { id: 1 } as any, [
      { isDefault: true, nullableFlag: null, label: 'a' },
    ]);
    const [row] = await c.query({ tableName: 'toggles' });
    expect(row.isDefault).toBe(true);
    expect(row.nullableFlag).toBeNull();
  });

  it('round-trips boolean updates strictly', async () => {
    const c = new SqliteConnector(':memory:', { schema });
    connector = c;
    await c.ensureSchema();
    await c.batchInsert('toggles', { id: 1 } as any, [
      { isDefault: true, nullableFlag: false, label: 'a' },
    ]);
    const [updated] = await c.updateAll({ tableName: 'toggles', filter: { label: 'a' } as any }, {
      isDefault: false,
      nullableFlag: true,
    } as any);
    expect(updated.isDefault).toBe(false);
    expect(updated.nullableFlag).toBe(true);
  });

  it('leaves raw 0/1 untouched when no schema is attached', async () => {
    // Without a schema, the connector cannot tell whether a 0/1 integer
    // column was meant as a boolean. Existing callers may rely on raw
    // numeric reads — preserve that behaviour.
    const c = new SqliteConnector(':memory:');
    connector = c;
    await c.createTable('legacy_toggles', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
      t.boolean('flag');
    });
    await c.batchInsert('legacy_toggles', { id: 1 } as any, [{ flag: true }, { flag: false }]);
    const rows = await c.query({ tableName: 'legacy_toggles' });
    expect(rows.map((r) => r.flag).sort()).toEqual([0, 1]);
  });

  it('coerces booleans on returning databases where ensureSchema sees existing tables', async () => {
    // Simulates the "second boot" path: tables already exist on disk, so
    // ensureSchema hits the skip branch instead of dispatching createTable.
    // The boolean-column tracking Map must still be populated, or hydrateRow
    // passes raw 0/1 INTEGER values through and downstream Zod / boolean
    // validators reject them with "Expected boolean, received number".
    const c = new SqliteConnector(':memory:', { schema });
    connector = c;
    // First "boot" — create the table.
    await c.ensureSchema();
    await c.batchInsert('toggles', { id: 1 } as any, [
      { isDefault: true, nullableFlag: false, label: 'a' },
    ]);
    // Drop the tracking Maps to mimic a fresh connector pointed at the same
    // file: the table exists, but the in-process bookkeeping is empty until
    // ensureSchema repopulates it.
    (c as unknown as { booleanColumns: Map<string, Set<string>> }).booleanColumns.clear();
    (c as unknown as { jsonColumns: Map<string, Set<string>> }).jsonColumns.clear();
    (c as unknown as { tableDefinitions: Map<string, unknown> }).tableDefinitions.clear();
    // Second "boot" — ensureSchema should re-register the tracking entry
    // even though the table is already present.
    const result = await c.ensureSchema();
    expect(result.created).toEqual([]);
    expect(result.existing).toEqual(['toggles']);
    const [row] = await c.query({ tableName: 'toggles' });
    expect(row.isDefault).toBe(true);
    expect(row.nullableFlag).toBe(false);
    expect(row.isDefault === true).toBe(true);
  });

  it('does not touch non-boolean columns even when both kinds coexist', async () => {
    const mixedSchema = defineSchema({
      mixed: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          flag: { type: 'boolean', null: false },
          count: { type: 'integer', null: false },
        },
      },
    });
    const c = new SqliteConnector(':memory:', { schema: mixedSchema });
    connector = c as unknown as typeof connector;
    await c.ensureSchema();
    await c.batchInsert('mixed', { id: 1 } as any, [{ flag: true, count: 1 }]);
    const [row] = await c.query({ tableName: 'mixed' });
    // count is integer, must stay numeric even though 1 looks like a truthy flag.
    expect(row.flag).toBe(true);
    expect(row.count).toBe(1);
    expect(typeof row.count).toBe('number');
  });
});
