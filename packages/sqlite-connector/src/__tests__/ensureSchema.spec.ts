import { defineSchema } from '@next-model/core';
import { afterEach, describe, expect, it } from 'vitest';

import { SqliteConnector } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string', null: false, unique: true, limit: 320 },
      name: { type: 'string', null: true },
      createdAt: { type: 'timestamp', default: 'currentTimestamp', null: false },
    },
    indexes: [{ columns: ['email'], unique: true, name: 'idx_users_email' }],
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer', null: false },
      title: { type: 'string', null: false },
      body: { type: 'text', null: true },
    },
    indexes: [{ columns: ['userId'], unique: false }],
  },
  tags: {
    columns: {
      slug: { type: 'string', primary: true },
    },
  },
});

describe('SqliteConnector#ensureSchema', () => {
  let connector: SqliteConnector<typeof schema>;

  afterEach(() => {
    connector?.destroy();
  });

  it('creates every table declared on the attached schema', async () => {
    connector = new SqliteConnector(':memory:', { schema });
    const result = await connector.ensureSchema();
    expect(result.created.sort()).toEqual(['posts', 'tags', 'users']);
    expect(result.existing).toEqual([]);
    expect(await connector.hasTable('users')).toBe(true);
    expect(await connector.hasTable('posts')).toBe(true);
    expect(await connector.hasTable('tags')).toBe(true);
  });

  it('is idempotent on a second call', async () => {
    connector = new SqliteConnector(':memory:', { schema });
    await connector.ensureSchema();
    const result = await connector.ensureSchema();
    expect(result.created).toEqual([]);
    expect(result.existing.sort()).toEqual(['posts', 'tags', 'users']);
  });

  it('only creates missing tables when some already exist', async () => {
    connector = new SqliteConnector(':memory:', { schema });
    await connector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true });
    });
    const result = await connector.ensureSchema();
    expect(result.existing).toEqual(['users']);
    expect(result.created.sort()).toEqual(['posts', 'tags']);
  });

  it('produces a usable table — round-trip insert + select', async () => {
    connector = new SqliteConnector(':memory:', { schema });
    await connector.ensureSchema();
    const [inserted] = await connector.batchInsert('users', { id: 1 } as any, [
      { email: 'a@example.com', name: 'Alice' },
    ]);
    expect(inserted.id).toBeDefined();
    expect(inserted.email).toBe('a@example.com');
    const rows = await connector.query({ tableName: 'users' });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('a@example.com');
  });

  it('honours the unique index from the schema', async () => {
    connector = new SqliteConnector(':memory:', { schema });
    await connector.ensureSchema();
    await connector.batchInsert('users', { id: 1 } as any, [{ email: 'dup@example.com' }]);
    await expect(
      connector.batchInsert('users', { id: 1 } as any, [{ email: 'dup@example.com' }]),
    ).rejects.toThrow();
  });

  it('throws when no schema is attached', async () => {
    connector = new SqliteConnector(':memory:') as SqliteConnector<typeof schema>;
    await expect(connector.ensureSchema()).rejects.toThrow(/no schema is attached/);
  });
});
