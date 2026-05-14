import { defineSchema } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { MemoryLocalStorage } from '../__mocks__/MemoryLocalStorage.js';
import { LocalStorageConnector } from '../LocalStorageConnector.js';

const schema = defineSchema({
  widgets: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string', null: false },
    },
  },
});

describe('LocalStorageConnector constructor shapes', () => {
  it('accepts schema on the single-arg options object', () => {
    const storage = new MemoryLocalStorage();
    const c = new LocalStorageConnector({ localStorage: storage, schema });
    expect(c.schema).toBe(schema);
  });

  it('still accepts schema via the legacy extras arg', () => {
    const storage = new MemoryLocalStorage();
    const c = new LocalStorageConnector({ localStorage: storage }, { schema });
    expect(c.schema).toBe(schema);
  });

  it('uses single-arg schema to drive ensureSchema()', async () => {
    const storage = new MemoryLocalStorage();
    const c = new LocalStorageConnector({ localStorage: storage, schema });
    const result = await c.ensureSchema();
    expect(result.created).toEqual(['widgets']);
    expect(await c.hasTable('widgets')).toBe(true);
  });
});
