import { describe, expect, it } from 'vitest';
import { Model } from '../Model.js';
import { defineSchema } from '../typedSchema.js';
import { MemoryConnector } from '../MemoryConnector.js';

describe('schema-driven default init', () => {
  const schema = defineSchema({
    posts: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        title: { type: 'string' },
        published: { type: 'boolean', default: false },
        views: { type: 'integer', default: 0 },
        publishedAt: { type: 'datetime', default: 'currentTimestamp' },
      },
    },
  });

  it('applies static defaults at build() time', () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class Post extends Model({ connector, tableName: 'posts', timestamps: false }) {}

    const p = Post.build({ title: 'hi' });
    expect(p.published).toBe(false);
    expect(p.views).toBe(0);
    expect(p.title).toBe('hi');
  });

  it("applies 'currentTimestamp' as a fresh Date at build() time", () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class Post extends Model({ connector, tableName: 'posts', timestamps: false }) {}

    const before = Date.now();
    const p = Post.build({ title: 'hi' });
    const after = Date.now();
    expect(p.publishedAt).toBeInstanceOf(Date);
    expect((p.publishedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((p.publishedAt as Date).getTime()).toBeLessThanOrEqual(after);
  });

  it('caller-supplied props win over schema defaults', () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class Post extends Model({ connector, tableName: 'posts', timestamps: false }) {}

    const p = Post.build({ title: 'hi', published: true, views: 42 });
    expect(p.published).toBe(true);
    expect(p.views).toBe(42);
  });

  it('does not auto-fill autoIncrement primary keys', () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class Post extends Model({ connector, tableName: 'posts', timestamps: false }) {}

    const p = Post.build({ title: 'hi' });
    // `id` stays absent until insert
    expect((p as unknown as { id?: number }).id).toBeUndefined();
  });

  it('explicit init replaces the schema default builder entirely', () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class Post extends Model({
      connector,
      tableName: 'posts',
      timestamps: false,
      init: (p) => ({ ...p, title: p.title.toUpperCase() }),
    }) {}

    const p = Post.build({ title: 'hi' });
    expect(p.title).toBe('HI');
    // Without our default builder, schema defaults are not applied
    expect(p.published).toBeUndefined();
    expect(p.views).toBeUndefined();
  });
});
