import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string', null: false, unique: true },
      name: { type: 'string', null: true },
    },
    indexes: [{ columns: ['email'], unique: true }],
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string', null: false },
    },
  },
  tags: {
    columns: {
      slug: { type: 'string', primary: true },
    },
  },
});

describe('MemoryConnector#ensureSchema', () => {
  it('creates every table declared on the attached schema', async () => {
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
    const result = await connector.ensureSchema();
    expect(result.created.sort()).toEqual(['posts', 'tags', 'users']);
    expect(result.existing).toEqual([]);
    expect(await connector.hasTable('users')).toBe(true);
    expect(await connector.hasTable('posts')).toBe(true);
    expect(await connector.hasTable('tags')).toBe(true);
  });

  it('is idempotent on a second call', async () => {
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
    await connector.ensureSchema();
    const result = await connector.ensureSchema();
    expect(result.created).toEqual([]);
    expect(result.existing.sort()).toEqual(['posts', 'tags', 'users']);
  });

  it('only creates missing tables when some already exist', async () => {
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
    // Pre-create one of the tables manually.
    await connector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    const result = await connector.ensureSchema();
    expect(result.existing).toEqual(['users']);
    expect(result.created.sort()).toEqual(['posts', 'tags']);
  });

  it('throws when no schema is attached', async () => {
    const connector = new MemoryConnector({ storage: {}, lastIds: {} });
    await expect(connector.ensureSchema()).rejects.toThrow(/no schema is attached/);
  });
});
