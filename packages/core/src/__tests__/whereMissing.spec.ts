import { KeyType, MemoryConnector, Model, type Storage } from '../index.js';

describe('whereMissing', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage });

  function makeModels() {
    const Post = Model({
      tableName: 'posts',
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ userId: 0, title: '' as string }),
    });
    const Profile = Model({
      tableName: 'profiles',
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ userId: 0, bio: '' as string }),
    });
    const User = Model({
      tableName: 'users',
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ name: '' as string, active: true as boolean }),
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
    const { Post, User } = makeModels();
    const items = await User.whereMissing({ hasMany: Post, foreignKey: 'userId' }).all();
    expect(items.map((u: any) => u.id).sort()).toEqual([3, 4]);
  });

  it('returns parents with zero matching has-one child', async () => {
    const { Profile, User } = makeModels();
    const items = await User.whereMissing({ hasOne: Profile, foreignKey: 'userId' }).all();
    expect(items.map((u: any) => u.id).sort()).toEqual([1, 3, 4]);
  });

  it('returns ALL parents when the child table is empty', async () => {
    const { Post, User } = makeModels();
    storage.posts = [];
    const items = await User.whereMissing({ hasMany: Post, foreignKey: 'userId' }).all();
    expect(items.map((u: any) => u.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it('composes with filterBy', async () => {
    const { Post, User } = makeModels();
    const items = await User.whereMissing({ hasMany: Post, foreignKey: 'userId' })
      .filterBy({ active: true })
      .all();
    expect(items.map((u: any) => u.id).sort()).toEqual([4]);
  });

  it('multiple whereMissing calls AND together', async () => {
    const { Post, Profile, User } = makeModels();
    const items = await User.whereMissing({ hasMany: Post, foreignKey: 'userId' })
      .whereMissing({ hasOne: Profile, foreignKey: 'userId' })
      .all();
    expect(items.map((u: any) => u.id).sort()).toEqual([3, 4]);
  });

  it('respects a custom primaryKey', async () => {
    const Tag = Model({
      tableName: 'tags',
      connector: new MemoryConnector({
        storage: {
          tags: [
            { slug: 'js', name: 'JS' },
            { slug: 'go', name: 'Go' },
          ],
        },
      }),
      keys: { slug: KeyType.manual },
      init: () => ({ name: '' as string }),
    });
    const Article = Model({
      tableName: 'articles',
      connector: new MemoryConnector({
        storage: { articles: [{ id: 1, tagSlug: 'js' }] },
      }),
      keys: { id: KeyType.number },
      init: () => ({ tagSlug: '' as string }),
    });
    const result = await Tag.whereMissing({
      hasMany: Article,
      foreignKey: 'tagSlug',
      primaryKey: 'slug',
    }).all();
    expect(result.map((t: any) => t.slug)).toEqual(['go']);
  });
});
