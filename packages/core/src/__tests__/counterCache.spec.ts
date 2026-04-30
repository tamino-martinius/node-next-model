import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string', default: '' },
      commentsCount: { type: 'integer', default: 0 },
    },
  },
  comments: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      postId: { type: 'integer', null: true },
      body: { type: 'string', default: '' },
    },
  },
});

describe('counter caches', () => {
  let storage: Storage = {};
  const sharedConnector = () => new MemoryConnector({ storage }, { schema });

  function makeModels() {
    const Post = Model({
      tableName: 'posts',
      connector: sharedConnector(),
    });
    const Comment = Model({
      tableName: 'comments',
      connector: sharedConnector(),
      counterCaches: [{ belongsTo: Post, foreignKey: 'postId', column: 'commentsCount' }],
    });
    return { Post, Comment };
  }

  beforeEach(() => {
    storage = {
      posts: [
        { id: 1, title: 'A', commentsCount: 0 },
        { id: 2, title: 'B', commentsCount: 0 },
      ],
      comments: [],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('increments the parent counter on create', async () => {
    const { Post, Comment } = makeModels();
    await Comment.create({ postId: 1, body: 'first' });
    await Comment.create({ postId: 1, body: 'second' });
    const post = (await Post.find(1)) as any;
    expect(post.commentsCount).toBe(2);
  });

  it('decrements the parent counter on delete', async () => {
    const { Post, Comment } = makeModels();
    const a = (await Comment.create({ postId: 1, body: 'a' })) as any;
    await Comment.create({ postId: 1, body: 'b' });
    expect(((await Post.find(1)) as any).commentsCount).toBe(2);
    await a.delete();
    expect(((await Post.find(1)) as any).commentsCount).toBe(1);
  });

  it('reassigns counters when the foreign key changes', async () => {
    const { Post, Comment } = makeModels();
    const c = (await Comment.create({ postId: 1, body: 'a' })) as any;
    expect(((await Post.find(1)) as any).commentsCount).toBe(1);
    expect(((await Post.find(2)) as any).commentsCount).toBe(0);
    c.postId = 2;
    await c.save();
    expect(((await Post.find(1)) as any).commentsCount).toBe(0);
    expect(((await Post.find(2)) as any).commentsCount).toBe(1);
  });

  it('skips when the foreign key is null', async () => {
    const { Post, Comment } = makeModels();
    await Comment.create({ postId: null, body: 'orphan' });
    expect(((await Post.find(1)) as any).commentsCount).toBe(0);
    expect(((await Post.find(2)) as any).commentsCount).toBe(0);
  });

  it('skips silently when the parent has been deleted', async () => {
    const { Comment } = makeModels();
    const ghost = (await Comment.create({ postId: 1, body: 'a' })) as any;
    storage.posts = storage.posts.filter((p) => p.id !== 1);
    // Should not throw — just no parent to update.
    await expect(ghost.delete()).resolves.toBeDefined();
  });

  // LEGACY: removed in Plan 3
  it('lazy belongsTo thunk works for circular refs', async () => {
    let Post: any;
    const Comment = Model({
      tableName: 'comments',
      connector: sharedConnector(),
      counterCaches: [{ belongsTo: () => Post, foreignKey: 'postId', column: 'commentsCount' }],
    });
    Post = Model({
      tableName: 'posts',
      connector: sharedConnector(),
    });
    await Comment.create({ postId: 1, body: 'lazy' });
    expect(((await Post.find(1)) as any).commentsCount).toBe(1);
  });

  it('Models without counterCaches behave normally', async () => {
    const Comment = Model({
      tableName: 'comments',
      connector: sharedConnector(),
    });
    await Comment.create({ postId: 1, body: 'x' });
    // No counter, no parent mutation.
    expect(storage.posts.find((p) => p.id === 1)?.commentsCount).toBe(0);
  });
});
