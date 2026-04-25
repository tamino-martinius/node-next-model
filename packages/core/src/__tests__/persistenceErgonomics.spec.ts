import { KeyType, MemoryConnector, Model, type Storage } from '../index.js';

describe('persistence ergonomics', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage });

  function makePost() {
    return Model({
      tableName: 'posts',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { title?: string }) => ({ title: p.title ?? '' }),
    });
  }

  beforeEach(() => {
    storage = {
      posts: [
        { id: 1, title: 'A', createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') },
        { id: 2, title: 'B', createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') },
        { id: 3, title: 'C', createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01') },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  describe('#delete({ skipCallbacks })', () => {
    it('skips beforeDelete / afterDelete when set', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('beforeDelete', () => calls.push('before'));
      Post.on('afterDelete', () => calls.push('after'));
      const p = (await Post.find(1)) as any;
      await p.delete({ skipCallbacks: true });
      expect(calls).toEqual([]);
      expect(storage.posts.find((r) => r.id === 1)).toBeUndefined();
    });

    it('runs callbacks by default (regression)', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('beforeDelete', () => calls.push('before'));
      Post.on('afterDelete', () => calls.push('after'));
      const p = (await Post.find(1)) as any;
      await p.delete();
      expect(calls).toEqual(['before', 'after']);
    });
  });

  describe('#touch({ time, columns })', () => {
    it('uses the provided time instead of "now"', async () => {
      const Post = makePost();
      const p = (await Post.find(1)) as any;
      const explicit = new Date('2099-12-31T23:59:59Z');
      await p.touch({ time: explicit });
      expect(storage.posts.find((r) => r.id === 1)?.updatedAt).toEqual(explicit);
    });

    it('touches multiple columns at once', async () => {
      const Stamped = Model({
        tableName: 'posts',
        connector: connector(),
        keys: { id: KeyType.number },
        init: (p: { title?: string }) => ({
          title: p.title ?? '',
          lastSeenAt: null as Date | null,
        }),
      });
      storage.posts = [
        {
          id: 1,
          title: 'A',
          updatedAt: new Date('2020-01-01'),
          lastSeenAt: null,
        },
      ];
      const explicit = new Date('2099-12-31T23:59:59Z');
      const p = (await Stamped.find(1)) as any;
      await p.touch({ time: explicit, columns: ['updatedAt', 'lastSeenAt'] });
      expect(storage.posts[0].updatedAt).toEqual(explicit);
      expect(storage.posts[0].lastSeenAt).toEqual(explicit);
    });

    it('throws when no updatedAt column AND no columns option', async () => {
      const NoTimestamps = Model({
        tableName: 'posts',
        connector: connector(),
        keys: { id: KeyType.number },
        init: (p: { title?: string }) => ({ title: p.title ?? '' }),
        timestamps: false,
      });
      storage.posts = [{ id: 1, title: 'A' }];
      const p = (await NoTimestamps.find(1)) as any;
      await expect(p.touch()).rejects.toThrowError(/no updatedAt column/);
    });

    it('honours an explicit `columns` even when updatedAt is disabled', async () => {
      const NoTimestamps = Model({
        tableName: 'posts',
        connector: connector(),
        keys: { id: KeyType.number },
        init: (p: { title?: string; lastSeenAt?: Date | null }) => ({
          title: p.title ?? '',
          lastSeenAt: p.lastSeenAt ?? null,
        }),
        timestamps: false,
      });
      storage.posts = [{ id: 1, title: 'A', lastSeenAt: null }];
      const explicit = new Date('2099-01-01');
      const p = (await NoTimestamps.find(1)) as any;
      await p.touch({ time: explicit, columns: ['lastSeenAt'] });
      expect(storage.posts[0].lastSeenAt).toEqual(explicit);
    });
  });

  describe('#destroyAll', () => {
    it('loads each row and calls .delete() on it (callbacks fire per row)', async () => {
      const Post = makePost();
      const deleted: number[] = [];
      // Note: by the time afterDelete fires, `record.keys` is already cleared,
      // but the previous id has been merged into persistentProps via attributes().
      Post.on('afterDelete', (record: any) => {
        deleted.push(record.attributes().id);
      });
      const records = await Post.destroyAll();
      expect(records).toHaveLength(3);
      expect(deleted.sort()).toEqual([1, 2, 3]);
      expect(storage.posts).toEqual([]);
    });

    it('respects the chained scope', async () => {
      const Post = makePost();
      await Post.filterBy({ title: 'B' }).destroyAll();
      expect(storage.posts.map((r) => r.title).sort()).toEqual(['A', 'C']);
    });

    it('returns [] for an empty scope without firing callbacks', async () => {
      const Post = makePost();
      const calls: number[] = [];
      Post.on('afterDelete', () => calls.push(1));
      const records = await Post.filterBy({ title: 'NOT THERE' }).destroyAll();
      expect(records).toEqual([]);
      expect(calls).toEqual([]);
    });
  });
});
