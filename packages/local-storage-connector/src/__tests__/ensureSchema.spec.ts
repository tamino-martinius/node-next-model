import { defineSchema } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { MemoryLocalStorage } from '../__mocks__/MemoryLocalStorage.js';
import { LocalStorageConnector } from '../LocalStorageConnector.js';

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

describe('LocalStorageConnector#ensureSchema', () => {
  it('creates every table declared on the attached schema', async () => {
    const storage = new MemoryLocalStorage();
    const connector = new LocalStorageConnector({ localStorage: storage }, { schema });
    const result = await connector.ensureSchema();
    expect(result.created.sort()).toEqual(['posts', 'tags', 'users']);
    expect(result.existing).toEqual([]);
    expect(await connector.hasTable('users')).toBe(true);
    expect(await connector.hasTable('posts')).toBe(true);
    expect(await connector.hasTable('tags')).toBe(true);
    // Each table should have a (possibly empty) JSON entry persisted.
    expect(storage.getItem('users')).not.toBeNull();
    expect(storage.getItem('posts')).not.toBeNull();
    expect(storage.getItem('tags')).not.toBeNull();
  });

  it('is idempotent on a second call', async () => {
    const storage = new MemoryLocalStorage();
    const connector = new LocalStorageConnector({ localStorage: storage }, { schema });
    await connector.ensureSchema();
    const result = await connector.ensureSchema();
    expect(result.created).toEqual([]);
    expect(result.existing.sort()).toEqual(['posts', 'tags', 'users']);
  });

  it('rehydrates and recognises previously persisted tables', async () => {
    const storage = new MemoryLocalStorage();
    const first = new LocalStorageConnector({ localStorage: storage }, { schema });
    await first.ensureSchema();
    // A fresh connector pointed at the same storage should see existing tables.
    const second = new LocalStorageConnector({ localStorage: storage }, { schema });
    const result = await second.ensureSchema();
    expect(result.created).toEqual([]);
    expect(result.existing.sort()).toEqual(['posts', 'tags', 'users']);
  });

  it('throws when no schema is attached', async () => {
    const connector = new LocalStorageConnector({ localStorage: new MemoryLocalStorage() });
    await expect(connector.ensureSchema()).rejects.toThrow(/no schema is attached/);
  });
});
