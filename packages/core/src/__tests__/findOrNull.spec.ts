import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
    },
  },
});

describe('Model.findOrNull', () => {
  let storage: Storage = {};
  const makePost = () =>
    Model({
      tableName: 'posts',
      connector: new MemoryConnector({ storage }, { schema }),
    });

  beforeEach(() => {
    storage = {
      posts: [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('returns the instance when the id exists', async () => {
    const Post = makePost();
    const post = (await Post.findOrNull(1)) as any;
    expect(post).toBeDefined();
    expect(post.title).toBe('A');
  });

  it('returns null when the id does not exist', async () => {
    const Post = makePost();
    const post = await Post.findOrNull(99999);
    expect(post).toBeNull();
  });

  it('does not throw for missing rows (unlike find)', async () => {
    const Post = makePost();
    await expect(Post.findOrNull(99999)).resolves.toBeNull();
    await expect(Post.find(99999)).rejects.toThrow();
  });

  it('returns the same instance shape as find for matching rows', async () => {
    const Post = makePost();
    const viaFind: any = await Post.find(2);
    const viaFindOrNull: any = await Post.findOrNull(2);
    expect(viaFindOrNull?.id).toBe(viaFind.id);
    expect(viaFindOrNull?.title).toBe(viaFind.title);
  });

  it('is chainable like other terminal kinds (PromiseLike)', async () => {
    const Post = makePost();
    const result = await Post.findOrNull(1);
    expect(result).toBeDefined();
  });
});
