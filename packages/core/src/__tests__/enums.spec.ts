import { defineSchema, MemoryConnector, Model, type Storage, ValidationError } from '../index.js';
import { CollectionQuery } from '../query/CollectionQuery.js';

const schema = defineSchema({
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      status: { type: 'string' },
      visibility: { type: 'string' },
    },
  },
  items: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      state: { type: 'string' },
    },
  },
});

describe('enums', () => {
  let storage: Storage = {};
  const tableName = 'posts';
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makePost() {
    return Model({
      tableName,
      connector: connector(),
      enums: {
        status: ['draft', 'published', 'archived'] as const,
        visibility: ['public', 'private'] as const,
      },
    });
  }

  beforeEach(() => {
    storage = {
      [tableName]: [
        { id: 1, title: 'A', status: 'draft', visibility: 'public' },
        { id: 2, title: 'B', status: 'published', visibility: 'public' },
        { id: 3, title: 'C', status: 'archived', visibility: 'private' },
        { id: 4, title: 'D', status: 'published', visibility: 'private' },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('exposes the value list as `<column>Values`', () => {
    const Post = makePost() as any;
    expect(Post.statusValues).toEqual(['draft', 'published', 'archived']);
    expect(Post.visibilityValues).toEqual(['public', 'private']);
  });

  it('generates a chainable class scope per value', async () => {
    const Post = makePost() as any;
    const drafts = await Post.draft().all();
    expect(drafts.map((p: any) => p.id)).toEqual([1]);
    const published = await Post.published().all();
    expect(published.map((p: any) => p.id)).toEqual([2, 4]);
  });

  it('enum class scope returns a CollectionQuery exposing the filter', () => {
    const Post = makePost() as any;
    const q = Post.draft();
    expect(q).toBeInstanceOf(CollectionQuery);
    expect(q.state.filter).toEqual({ status: 'draft' });
  });

  it('class scopes compose with other chainables', async () => {
    const Post = makePost() as any;
    const items = await Post.published().filterBy({ visibility: 'public' }).all();
    expect(items.map((i: any) => i.id)).toEqual([2]);
  });

  it('generates an instance predicate per value', async () => {
    const Post = makePost() as any;
    const post = await Post.find(1);
    expect(post.isDraft()).toBe(true);
    expect(post.isPublished()).toBe(false);
    post.status = 'published';
    expect(post.isPublished()).toBe(true);
    expect(post.isDraft()).toBe(false);
  });

  it('handles snake_case values via camelCase scopes / PascalCase predicates', async () => {
    const Item = Model({
      tableName: 'items',
      connector: new MemoryConnector(
        { storage: { items: [{ id: 1, state: 'in_review' }] } },
        { schema },
      ),
      enums: { state: ['pending', 'in_review', 'approved'] as const },
    }) as any;
    expect(typeof Item.inReview).toBe('function');
    const items = await Item.inReview().all();
    expect(items[0].id).toBe(1);
    expect(items[0].isInReview()).toBe(true);
    expect(items[0].isPending()).toBe(false);
  });

  it('rejects out-of-range values via isValid()', async () => {
    const Post = makePost();
    const post = (await Post.find(1)) as any;
    post.status = 'bogus';
    expect(await post.isValid()).toBe(false);
    await expect(post.save()).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows null/undefined enum values (presence is a separate concern)', async () => {
    const Post = makePost();
    const post = (await Post.find(1)) as any;
    post.status = null;
    expect(await post.isValid()).toBe(true);
  });

  it('throws at factory construction when an enum value collides with an existing static method', () => {
    const collidingSchema = defineSchema({
      posts: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          status: { type: 'string' },
        },
      },
    });
    expect(() =>
      Model({
        tableName: 'posts',
        connector: new MemoryConnector({ storage: {} }, { schema: collidingSchema }),
        enums: { status: ['all'] as const },
      }),
    ).toThrowError(/collides with existing static method 'all'/);
  });
});
