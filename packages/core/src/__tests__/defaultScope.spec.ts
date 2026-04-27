import { describe, expect, it } from 'vitest';
import { MemoryConnector } from '../MemoryConnector.js';
import { Model } from '../Model.js';

const makeConnector = () => new MemoryConnector({ storage: {} });

describe('defaultScope', () => {
  const buildPost = () => {
    const connector = makeConnector();
    return class Post extends Model({
      tableName: 'posts',
      init: (p: { title: string; archivedAt: Date | null }) => p,
      defaultScope: { $null: 'archivedAt' },
      timestamps: false,
      connector,
    }) {};
  };

  it('applies defaultScope to all() automatically', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.all();
    expect(posts.map((p) => p.attributes.title)).toEqual(['live']);
  });

  it('applies defaultScope to count()', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    expect(await Post.count()).toBe(1);
  });

  it('combines defaultScope with filterBy as AND', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live a', archivedAt: null });
    await Post.create({ title: 'live b', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.filterBy({ title: 'live a' }).all();
    expect(posts.map((p) => p.attributes.title)).toEqual(['live a']);
  });

  it('unscope(key) removes the matching defaultScope clause', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.unscope('archivedAt').all();
    expect(posts.map((p) => p.attributes.title).sort()).toEqual(['gone', 'live']);
  });

  it('unscoped() bypasses defaultScope entirely', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.unscoped().all();
    expect(posts).toHaveLength(2);
  });

  it('unfiltered() does NOT clear defaultScope (sticky)', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.filterBy({ title: 'gone' }).unfiltered().all();
    // defaultScope still in effect → only 'live' returned
    expect(posts.map((p) => p.attributes.title)).toEqual(['live']);
  });

  it('unscope works with column-keyed defaultScope', async () => {
    const connector = makeConnector();
    class Item extends Model({
      tableName: 'items',
      init: (p: { active: boolean; name: string }) => p,
      defaultScope: { active: true },
      timestamps: false,
      connector,
    }) {}
    await Item.create({ active: true, name: 'live' });
    await Item.create({ active: false, name: 'dead' });
    const all = await Item.unscope('active').all();
    expect(all.map((i) => i.attributes.name).sort()).toEqual(['dead', 'live']);
  });

  it('unscope accepts multiple keys', async () => {
    const connector = makeConnector();
    class Item extends Model({
      tableName: 'items',
      init: (p: { active: boolean; archivedAt: Date | null; name: string }) => p,
      defaultScope: { $and: [{ active: true }, { $null: 'archivedAt' }] },
      timestamps: false,
      connector,
    }) {}
    await Item.create({ active: true, archivedAt: null, name: 'live' });
    await Item.create({ active: false, archivedAt: null, name: 'inactive' });
    await Item.create({ active: true, archivedAt: new Date(), name: 'archived' });
    const all = await Item.unscope('active', 'archivedAt').all();
    expect(all.map((i) => i.attributes.name).sort()).toEqual(['archived', 'inactive', 'live']);
  });

  it('subsequent chain methods compose with the de-scoped state', async () => {
    const Post = buildPost();
    await Post.create({ title: 'live', archivedAt: null });
    await Post.create({ title: 'gone', archivedAt: new Date() });
    const posts = await Post.unscope('archivedAt').filterBy({ title: 'gone' }).all();
    expect(posts.map((p) => p.attributes.title)).toEqual(['gone']);
  });
});
