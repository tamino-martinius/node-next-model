import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      active: { type: 'boolean' },
    },
    associations: {
      posts: { hasMany: 'posts', foreignKey: 'userId' },
      profile: { hasOne: 'profiles', foreignKey: 'userId' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      title: { type: 'string' },
    },
  },
  profiles: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      bio: { type: 'string' },
    },
  },
});

describe('whereMissing', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makeModels() {
    const Post = Model({
      tableName: 'posts',
      connector: connector(),
    });
    const Profile = Model({
      tableName: 'profiles',
      connector: connector(),
    });
    const User = Model({
      tableName: 'users',
      connector: connector(),
    });
    return { Post, Profile, User };
  }

  beforeEach(() => {
    storage = {
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: true },
        { id: 3, name: 'Carol', active: false },
        { id: 4, name: 'Dan', active: true },
      ],
      posts: [
        { id: 1, userId: 1, title: 'a' },
        { id: 2, userId: 1, title: 'b' },
        { id: 3, userId: 2, title: 'c' },
      ],
      profiles: [{ id: 1, userId: 2, bio: 'b' }],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('returns parents with zero matching has-many children', async () => {
    const { User } = makeModels();
    const items = await User.whereMissing('posts').all();
    expect(items.map((u: any) => u.id).sort()).toEqual([3, 4]);
  });

  it('returns parents with zero matching has-one child', async () => {
    const { User } = makeModels();
    const items = await User.whereMissing('profile').all();
    expect(items.map((u: any) => u.id).sort()).toEqual([1, 3, 4]);
  });

  it('returns ALL parents when the child table is empty', async () => {
    const { User } = makeModels();
    storage.posts = [];
    const items = await User.whereMissing('posts').all();
    expect(items.map((u: any) => u.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it('composes with filterBy', async () => {
    const { User } = makeModels();
    const items = await User.whereMissing('posts').filterBy({ active: true }).all();
    expect(items.map((u: any) => u.id).sort()).toEqual([4]);
  });

  it('multiple whereMissing calls AND together', async () => {
    const { User } = makeModels();
    const items = await User.whereMissing('posts').whereMissing('profile').all();
    expect(items.map((u: any) => u.id).sort()).toEqual([3, 4]);
  });

  it('respects a custom primaryKey via the association registry', async () => {
    const tagSchema = defineSchema({
      articles: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          tagSlug: { type: 'string' },
        },
      },
      tags: {
        columns: {
          slug: { type: 'string', primary: true },
          name: { type: 'string' },
        },
        associations: {
          articles: { hasMany: 'articles', foreignKey: 'tagSlug', primaryKey: 'slug' },
        },
      },
    });
    const Article = Model({
      tableName: 'articles',
      connector: new MemoryConnector(
        {
          storage: { articles: [{ id: 1, tagSlug: 'js' }] },
        },
        { schema: tagSchema },
      ),
    });
    const Tag = Model({
      tableName: 'tags',
      connector: new MemoryConnector(
        {
          storage: {
            tags: [
              { slug: 'js', name: 'JS' },
              { slug: 'go', name: 'Go' },
            ],
          },
        },
        { schema: tagSchema },
      ),
    });
    void Article;
    const result = await Tag.whereMissing('articles').all();
    expect(result.map((t: any) => t.slug)).toEqual(['go']);
  });

  it('rejects belongsTo associations with a clear error', async () => {
    const btSchema = defineSchema({
      authors: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          name: { type: 'string' },
        },
      },
      books: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          authorId: { type: 'integer' },
        },
        associations: {
          author: { belongsTo: 'authors', foreignKey: 'authorId' },
        },
      },
    });
    const Book = Model({
      tableName: 'books',
      connector: new MemoryConnector(
        { storage: { books: [{ id: 1, authorId: 7 }] } },
        { schema: btSchema },
      ),
    });
    expect(() => Book.whereMissing('author')).toThrow(/only supports hasMany \/ hasOne/);
  });

  it('throws when the Model has no associations declared', async () => {
    const noAssocSchema = defineSchema({
      users: { columns: { id: { type: 'integer', primary: true, autoIncrement: true } } },
    });
    const User = Model({
      tableName: 'users',
      connector: new MemoryConnector({ storage: { users: [] } }, { schema: noAssocSchema }),
    });
    expect(() => User.whereMissing('posts')).toThrow(/declare 'associations'/);
  });

  it('throws on an unknown association name', async () => {
    const { User } = makeModels();
    expect(() => User.whereMissing('comments')).toThrow(/Unknown association/);
  });
});
