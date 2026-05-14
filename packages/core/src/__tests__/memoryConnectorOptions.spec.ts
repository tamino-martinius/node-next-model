import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector } from '../index.js';

const schema = defineSchema({
  widgets: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string', null: false },
    },
  },
});

describe('MemoryConnector constructor shapes', () => {
  it('accepts a single-arg { schema } and exposes the schema', () => {
    const c = new MemoryConnector({ schema });
    expect(c.schema).toBe(schema);
  });

  it('still accepts the legacy two-arg shape (props, extras)', () => {
    const storage = {};
    const lastIds = {};
    const c = new MemoryConnector({ storage, lastIds }, { schema });
    expect(c.schema).toBe(schema);
  });

  it('accepts the unified single-arg { storage, lastIds, schema }', () => {
    const storage = {};
    const lastIds = {};
    const c = new MemoryConnector({ storage, lastIds, schema });
    expect(c.schema).toBe(schema);
  });

  it('uses the schema-only form to drive ensureSchema()', async () => {
    const c = new MemoryConnector({ schema });
    const result = await c.ensureSchema();
    expect(result.created).toEqual(['widgets']);
    expect(await c.hasTable('widgets')).toBe(true);
  });

  it('still works with no args at all', () => {
    const c = new MemoryConnector();
    expect(c.schema).toBeUndefined();
  });
});
