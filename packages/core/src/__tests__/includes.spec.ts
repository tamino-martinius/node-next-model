import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model } from '../index.js';

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

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
    associations: {
      posts: { hasMany: 'posts', foreignKey: 'userId' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      userId: { type: 'integer' },
    },
    associations: {
      user: { belongsTo: 'users', foreignKey: 'userId' },
      comments: { hasMany: 'comments', foreignKey: 'postId' },
    },
  },
  comments: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      postId: { type: 'integer' },
      body: { type: 'string' },
    },
    associations: {
      post: { belongsTo: 'posts', foreignKey: 'postId' },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

function buildModels(connector: MemoryConnector) {
  class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
  }) {}
  class Post extends Model({
    tableName: 'posts',
    connector,
    timestamps: false,
  }) {}
  class Comment extends Model({
    tableName: 'comments',
    connector,
    timestamps: false,
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
    expect(posts[0].comments?.map((c) => (c.attributes as CommentRow).body)).toEqual(['C1', 'C2']);
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
    // Use a schema with no associations declared on the table.
    const bareSchema = defineSchema({
      bare: { columns: { id: { type: 'integer', primary: true, autoIncrement: true } } },
    });
    const connector = new MemoryConnector({ storage: {} }, { schema: bareSchema });
    class Bare extends Model({
      tableName: 'bare',
      connector,
      timestamps: false,
    }) {}
    expect(() => Bare.includes('posts')).toThrow(/declare 'associations'/);
  });

  it('throws on an unknown association name', async () => {
    const connector = freshConnector();
    const { Post } = buildModels(connector);
    expect(() => Post.includes('audit')).toThrow(/Unknown association/);
  });

  it('rejects an association whose name collides with a primary-key column', () => {
    const collidingSchema = defineSchema({
      rows: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          name: { type: 'string' },
          rowId: { type: 'integer' },
        },
        associations: {
          id: { hasMany: 'posts', foreignKey: 'rowId' },
        },
      },
      posts: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          rowId: { type: 'integer' },
        },
      },
    });
    expect(() =>
      Model({
        tableName: 'rows',
        connector: new MemoryConnector({ storage: {} }, { schema: collidingSchema }),
        timestamps: false,
      }),
    ).toThrow(/collides with a primary key column/);
  });

  it('rejects an association whose name collides with a built-in instance method', () => {
    const collidingSchema = defineSchema({
      rows: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          name: { type: 'string' },
          rowId: { type: 'integer' },
        },
        associations: {
          save: { hasMany: 'posts', foreignKey: 'rowId' },
        },
      },
      posts: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          rowId: { type: 'integer' },
        },
      },
    });
    expect(() =>
      Model({
        tableName: 'rows',
        connector: new MemoryConnector({ storage: {} }, { schema: collidingSchema }),
        timestamps: false,
      }),
    ).toThrow(/built-in instance method/);
  });
});
