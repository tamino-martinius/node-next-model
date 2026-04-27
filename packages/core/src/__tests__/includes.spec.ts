import { describe, expect, it } from 'vitest';

import { MemoryConnector, Model } from '../index.js';

interface UserRow {
  id?: number;
  name: string;
}

interface PostRow {
  id?: number;
  title: string;
  userId: number;
}

interface CommentRow {
  id?: number;
  postId: number;
  body: string;
}

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} });
}

function buildModels(connector: MemoryConnector) {
  class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
    init: (p: UserRow) => p,
    associations: {
      posts: { hasMany: () => Post, foreignKey: 'userId' },
    },
  }) {}
  class Post extends Model({
    tableName: 'posts',
    connector,
    timestamps: false,
    init: (p: PostRow) => p,
    associations: {
      user: { belongsTo: () => User, foreignKey: 'userId' },
      comments: { hasMany: () => Comment, foreignKey: 'postId' },
    },
  }) {}
  class Comment extends Model({
    tableName: 'comments',
    connector,
    timestamps: false,
    init: (p: CommentRow) => p,
    associations: {
      post: { belongsTo: () => Post, foreignKey: 'postId' },
    },
  }) {}
  return { User, Post, Comment };
}

async function seed(models: ReturnType<typeof buildModels>) {
  const { User, Post, Comment } = models;
  await User.createMany([{ name: 'Ada' }, { name: 'Linus' }]);
  await Post.createMany([
    { title: 'P1', userId: 1 },
    { title: 'P2', userId: 1 },
    { title: 'P3', userId: 2 },
  ]);
  await Comment.createMany([
    { postId: 1, body: 'C1' },
    { postId: 1, body: 'C2' },
    { postId: 2, body: 'C3' },
  ]);
}

describe('Model.includes — eager loading', () => {
  it('eager-loads a belongsTo association', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const posts = (await Post.includes('user').all()) as Array<
      InstanceType<typeof Post> & { user?: InstanceType<typeof User> }
    >;

    expect(posts).toHaveLength(3);
    expect(posts[0].user).toBeDefined();
    expect((posts[0].user?.attributes as UserRow).name).toBe('Ada');
    expect((posts[2].user?.attributes as UserRow).name).toBe('Linus');
  });

  it('eager-loads a hasMany association', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const users = (await User.includes('posts').all()) as Array<
      InstanceType<typeof User> & { posts?: InstanceType<typeof Post>[] }
    >;

    expect(users[0].posts?.map((p) => (p.attributes as PostRow).title)).toEqual(['P1', 'P2']);
    expect(users[1].posts?.map((p) => (p.attributes as PostRow).title)).toEqual(['P3']);
  });

  it('composes multiple associations at once', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User, Comment } = models;

    const posts = (await Post.includes('user', 'comments').all()) as Array<
      InstanceType<typeof Post> & {
        user?: InstanceType<typeof User>;
        comments?: InstanceType<typeof Comment>[];
      }
    >;

    expect(posts[0].user).toBeDefined();
    expect(posts[0].comments?.map((c) => (c.attributes as CommentRow).body)).toEqual([
      'C1',
      'C2',
    ]);
    expect(posts[1].comments?.map((c) => (c.attributes as CommentRow).body)).toEqual(['C3']);
    expect(posts[2].comments).toEqual([]);
  });

  it('first() and last() pick up includes from the chain', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const first = (await Post.includes('user').first()) as
      | (InstanceType<typeof Post> & { user?: InstanceType<typeof User> })
      | undefined;
    expect((first?.user?.attributes as UserRow).name).toBe('Ada');
  });

  it('find() preserves the eager-loaded association', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const p = (await Post.includes('user').find(3)) as InstanceType<typeof Post> & {
      user?: InstanceType<typeof User>;
    };
    expect((p.user?.attributes as UserRow).name).toBe('Linus');
  });

  it('consecutive includes() calls merge', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User, Comment } = models;

    const chain = Post.includes('user').includes('comments');
    const posts = (await chain.all()) as Array<
      InstanceType<typeof Post> & {
        user?: InstanceType<typeof User>;
        comments?: InstanceType<typeof Comment>[];
      }
    >;
    expect(posts[0].user).toBeDefined();
    expect(posts[0].comments).toBeDefined();
  });

  it('withoutIncludes clears the eager-load chain', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const chain = Post.includes('user');
    const withoutUser = chain.withoutIncludes();
    const rows = (await withoutUser.all()) as Array<
      InstanceType<typeof Post> & { user?: Promise<InstanceType<typeof User> | undefined> }
    >;
    // Auto-accessor still resolves lazily; await Promise<User | undefined>.
    const lazyUser = await rows[0].user;
    expect((lazyUser?.attributes as UserRow).name).toBe('Ada');
  });

  it('unscoped() also clears includes', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const chain = Post.includes('user');
    const rows = (await chain.unscoped().all()) as Array<
      InstanceType<typeof Post> & { user?: Promise<InstanceType<typeof User> | undefined> }
    >;
    const lazyUser = await rows[0].user;
    expect((lazyUser?.attributes as UserRow).name).toBe('Ada');
  });

  it('auto-defined instance accessor lazy-loads when not eager-loaded', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { Post, User } = models;

    const post = (await Post.find(1)) as InstanceType<typeof Post> & {
      user: Promise<InstanceType<typeof User> | undefined>;
      comments: Promise<InstanceType<typeof Comment>[]>;
    };
    const user = await post.user;
    expect((user?.attributes as UserRow).name).toBe('Ada');
    const comments = await post.comments;
    expect(comments.map((c) => (c.attributes as CommentRow).body)).toEqual(['C1', 'C2']);
  });

  it('instance-level .belongsTo / .hasMany return a chainable query (PromiseLike)', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const post = (await Post.find(1)) as Awaited<ReturnType<typeof Post.find>>;
    const lazy = post.belongsTo(User, { foreignKey: 'userId' });
    // Awaiting the InstanceQuery resolves the lookup; the builder is
    // PromiseLike so existing `await this.belongsTo(...)` keeps working.
    const resolved = await lazy;
    expect((resolved?.attributes as UserRow).name).toBe('Ada');
  });

  it('throws when the Model declares no associations', async () => {
    const connector = freshConnector();
    class Bare extends Model({
      tableName: 'bare',
      connector,
      timestamps: false,
      init: (p: { name: string }) => p,
    }) {}
    expect(() => Bare.includes('posts')).toThrow(/declare 'associations'/);
  });

  it('throws on an unknown association name', async () => {
    const connector = freshConnector();
    const { Post } = buildModels(connector);
    expect(() => Post.includes('audit')).toThrow(/Unknown association/);
  });

  it('rejects an association whose name collides with a primary-key column', () => {
    const connector = freshConnector();
    expect(() =>
      Model({
        tableName: 'rows',
        connector,
        timestamps: false,
        init: (p: { name: string }) => p,
        associations: { id: { hasMany: () => Post, foreignKey: 'rowId' } },
      }),
    ).toThrow(/collides with a primary key column/);
    class Post extends Model({
      tableName: 'posts',
      connector,
      timestamps: false,
      init: (p: PostRow) => p,
    }) {}
    void Post;
  });

  it('rejects an association whose name collides with a built-in instance method', () => {
    const connector = freshConnector();
    expect(() =>
      Model({
        tableName: 'rows',
        connector,
        timestamps: false,
        init: (p: { name: string }) => p,
        associations: {
          save: { hasMany: () => Post, foreignKey: 'rowId' },
        },
      }),
    ).toThrow(/built-in instance method/);
    class Post extends Model({
      tableName: 'posts',
      connector,
      timestamps: false,
      init: (p: PostRow) => p,
    }) {}
    void Post;
  });
});
