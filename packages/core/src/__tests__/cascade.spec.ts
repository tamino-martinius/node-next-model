import { defineSchema, MemoryConnector, Model, PersistenceError, type Storage } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer', null: true },
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

describe('cascade (dependent: destroy / deleteAll / nullify / restrict)', () => {
  let storage: Storage = {};
  const sharedConnector = () => new MemoryConnector({ storage }, { schema });

  function makeModels(action: 'destroy' | 'deleteAll' | 'nullify' | 'restrict') {
    const Post = Model({
      tableName: 'posts',
      connector: sharedConnector(),
    });
    const Profile = Model({
      tableName: 'profiles',
      connector: sharedConnector(),
    });
    const User = Model({
      tableName: 'users',
      connector: sharedConnector(),
      cascade: {
        posts: { hasMany: Post, foreignKey: 'userId', dependent: action },
        profile: { hasOne: Profile, foreignKey: 'userId', dependent: action },
      },
    });
    return { User, Post, Profile };
  }

  beforeEach(() => {
    storage = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      posts: [
        { id: 1, userId: 1, title: 'A1' },
        { id: 2, userId: 1, title: 'A2' },
        { id: 3, userId: 2, title: 'B1' },
      ],
      profiles: [
        { id: 1, userId: 1, bio: 'Alice bio' },
        { id: 2, userId: 2, bio: 'Bob bio' },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  describe('destroy', () => {
    it('deletes child rows via .delete() (callbacks fire)', async () => {
      const { User, Post } = makeModels('destroy');
      let postCallbackCount = 0;
      Post.on('beforeDelete', () => {
        postCallbackCount++;
      });
      const alice = await User.find(1);
      await alice!.delete();
      expect(storage.users).toHaveLength(1);
      expect(storage.posts.filter((p) => p.userId === 1)).toEqual([]);
      expect(storage.profiles.filter((p) => p.userId === 1)).toEqual([]);
      // 2 posts + 1 profile cascaded → 3 child callbacks
      expect(postCallbackCount).toBe(2);
    });

    it('does not affect siblings', async () => {
      const { User } = makeModels('destroy');
      const alice = await User.find(1);
      await alice!.delete();
      expect(storage.posts.filter((p) => p.userId === 2)).toHaveLength(1);
      expect(storage.profiles.filter((p) => p.userId === 2)).toHaveLength(1);
    });
  });

  describe('deleteAll', () => {
    it('bulk-deletes children without firing their callbacks', async () => {
      const { User, Post } = makeModels('deleteAll');
      let postCallbackCount = 0;
      Post.on('beforeDelete', () => {
        postCallbackCount++;
      });
      const alice = await User.find(1);
      await alice!.delete();
      expect(storage.posts.filter((p) => p.userId === 1)).toEqual([]);
      expect(postCallbackCount).toBe(0);
    });
  });

  describe('nullify', () => {
    it('sets the foreign key on children to null', async () => {
      const { User } = makeModels('nullify');
      const alice = await User.find(1);
      await alice!.delete();
      expect(storage.users).toHaveLength(1);
      // Posts still exist but with userId = null
      const remainingPosts = storage.posts.filter((p) => p.title === 'A1' || p.title === 'A2');
      expect(remainingPosts).toHaveLength(2);
      expect(remainingPosts.every((p) => p.userId === null)).toBe(true);
    });
  });

  describe('restrict', () => {
    it('throws PersistenceError when any child exists; parent stays intact', async () => {
      const { User } = makeModels('restrict');
      const alice = await User.find(1);
      await expect(alice!.delete()).rejects.toBeInstanceOf(PersistenceError);
      expect(storage.users.find((u) => u.id === 1)).toBeDefined();
      expect(storage.posts.filter((p) => p.userId === 1)).toHaveLength(2);
    });

    it('allows delete when no children exist', async () => {
      const { User } = makeModels('restrict');
      storage.posts = storage.posts.filter((p) => p.userId !== 2);
      storage.profiles = storage.profiles.filter((p) => p.userId !== 2);
      const bob = await User.find(2);
      await bob!.delete();
      expect(storage.users.find((u) => u.id === 2)).toBeUndefined();
    });
  });

  // LEGACY: removed in Plan 3 — thunk support in cascade is a legacy-only feature
  describe('lazy model references', () => {
    it('accepts a thunk so circular imports work', async () => {
      let Post: any;
      const User = Model({
        tableName: 'users',
        connector: sharedConnector(),
        cascade: {
          posts: { hasMany: () => Post, foreignKey: 'userId', dependent: 'deleteAll' },
        },
      });
      Post = Model({
        tableName: 'posts',
        connector: sharedConnector(),
      });
      const alice = await User.find(1);
      await alice!.delete();
      expect(storage.posts.filter((p) => p.userId === 1)).toEqual([]);
    });
  });

  describe('Models without cascade are unaffected', () => {
    it('delete() proceeds without touching children', async () => {
      const Post = Model({
        tableName: 'posts',
        connector: sharedConnector(),
      });
      const User = Model({
        tableName: 'users',
        connector: sharedConnector(),
      });
      const alice = await User.find(1);
      await alice!.delete();
      // Posts left untouched
      expect(storage.posts.filter((p) => p.userId === 1)).toHaveLength(2);
      void Post;
    });
  });
});
