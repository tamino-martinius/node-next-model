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
  }) {}
  class Post extends Model({
    tableName: 'posts',
    connector,
    timestamps: false,
    init: (p: PostRow) => p,
  }) {}
  class Comment extends Model({
    tableName: 'comments',
    connector,
    timestamps: false,
    init: (p: CommentRow) => p,
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
    const { User, Post } = buildModels(connector);
    await seed({ User, Post, Comment: buildModels(connector).Comment });

    const posts = (await Post.includes({
      user: { belongsTo: User, foreignKey: 'userId' },
    }).all()) as Array<InstanceType<typeof Post> & { user?: InstanceType<typeof User> }>;

    expect(posts).toHaveLength(3);
    expect(posts[0].user).toBeDefined();
    expect((posts[0].user?.attributes() as UserRow).name).toBe('Ada');
    expect((posts[2].user?.attributes() as UserRow).name).toBe('Linus');
  });

  it('eager-loads a hasMany association', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const users = (await User.includes({
      posts: { hasMany: Post, foreignKey: 'userId' },
    }).all()) as Array<InstanceType<typeof User> & { posts?: InstanceType<typeof Post>[] }>;

    expect(users[0].posts?.map((p) => (p.attributes() as PostRow).title)).toEqual(['P1', 'P2']);
    expect(users[1].posts?.map((p) => (p.attributes() as PostRow).title)).toEqual(['P3']);
  });

  it('composes multiple associations at once', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post, Comment } = models;

    const posts = (await Post.includes({
      user: { belongsTo: User, foreignKey: 'userId' },
      comments: { hasMany: Comment, foreignKey: 'postId' },
    }).all()) as Array<
      InstanceType<typeof Post> & {
        user?: InstanceType<typeof User>;
        comments?: InstanceType<typeof Comment>[];
      }
    >;

    expect(posts[0].user).toBeDefined();
    expect(posts[0].comments?.map((c) => (c.attributes() as CommentRow).body)).toEqual([
      'C1',
      'C2',
    ]);
    expect(posts[1].comments?.map((c) => (c.attributes() as CommentRow).body)).toEqual(['C3']);
    expect(posts[2].comments).toEqual([]);
  });

  it('first() and last() pick up includes from the chain', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const first = (await Post.includes({
      user: { belongsTo: User, foreignKey: 'userId' },
    }).first()) as (InstanceType<typeof Post> & { user?: InstanceType<typeof User> }) | undefined;
    expect((first?.user?.attributes() as UserRow).name).toBe('Ada');
  });

  it('find() preserves the eager-loaded association', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const p = (await Post.includes({
      user: { belongsTo: User, foreignKey: 'userId' },
    }).find(3)) as InstanceType<typeof Post> & { user?: InstanceType<typeof User> };
    expect((p.user?.attributes() as UserRow).name).toBe('Linus');
  });

  it('consecutive includes() calls merge', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post, Comment } = models;

    const chain = Post.includes({
      user: { belongsTo: User, foreignKey: 'userId' },
    }).includes({
      comments: { hasMany: Comment, foreignKey: 'postId' },
    });
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
    const { User, Post } = models;

    const chain = Post.includes({ user: { belongsTo: User, foreignKey: 'userId' } });
    const withoutUser = chain.withoutIncludes();
    const rows = (await withoutUser.all()) as Array<
      InstanceType<typeof Post> & { user?: InstanceType<typeof User> }
    >;
    expect(rows[0].user).toBeUndefined();
  });

  it('unscoped() also clears includes', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const chain = Post.includes({ user: { belongsTo: User, foreignKey: 'userId' } });
    const rows = (await chain.unscoped().all()) as Array<
      InstanceType<typeof Post> & { user?: InstanceType<typeof User> }
    >;
    expect(rows[0].user).toBeUndefined();
  });

  it('instance-level .belongsTo / .hasMany still return a Promise (lazy)', async () => {
    const connector = freshConnector();
    const models = buildModels(connector);
    await seed(models);
    const { User, Post } = models;

    const post = (await Post.find(1)) as unknown as {
      belongsTo: (
        M: typeof User,
        opts?: { foreignKey?: string },
      ) => Promise<InstanceType<typeof User> | undefined>;
    };
    const lazy = post.belongsTo(User, { foreignKey: 'userId' });
    expect(lazy).toBeInstanceOf(Promise);
    const resolved = await lazy;
    expect((resolved?.attributes() as UserRow).name).toBe('Ada');
  });
});
