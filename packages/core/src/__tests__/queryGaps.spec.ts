import { KeyType, MemoryConnector, Model, SortDirection, type Storage } from '../index.js';

describe('query-builder gaps', () => {
  let storage: Storage = {};
  const tableName = 'posts';
  const connector = () => new MemoryConnector({ storage });

  function makePost() {
    return Model({
      tableName,
      connector: connector(),
      keys: { id: KeyType.number },
      init: () => ({ title: '' as string, userId: 0, status: 'draft' as string }),
    });
  }

  beforeEach(() => {
    storage = {
      [tableName]: [
        { id: 1, title: 'A', userId: 1, status: 'published' },
        { id: 2, title: 'B', userId: 1, status: 'draft' },
        { id: 3, title: 'C', userId: 1, status: 'published' },
        { id: 4, title: 'D', userId: 2, status: 'published' },
        { id: 5, title: 'E', userId: 3, status: 'draft' },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  describe('#none()', () => {
    it('all() returns []', async () => {
      const Post = makePost();
      expect(await Post.none().all()).toEqual([]);
    });

    it('count() returns 0', async () => {
      const Post = makePost();
      expect(await Post.none().count()).toBe(0);
    });

    it('first() / last() return undefined', async () => {
      const Post = makePost();
      expect(await Post.none().first()).toBeUndefined();
      expect(await Post.none().last()).toBeUndefined();
    });

    it('pluck / pluckUnique / ids return []', async () => {
      const Post = makePost();
      expect(await Post.none().pluck('title')).toEqual([]);
      expect(await Post.none().pluckUnique('userId')).toEqual([]);
      expect(await Post.none().ids()).toEqual([]);
    });

    it('does not hit the underlying connector', async () => {
      const Post = makePost();
      const spy = vi.spyOn(Post.connector, 'query');
      await Post.none().all();
      await Post.none().count();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('chainable — composes with filterBy / orderBy / limitBy', async () => {
      const Post = makePost();
      expect(
        await Post.none()
          .filterBy({ userId: 1 })
          .orderBy({ key: 'id', dir: SortDirection.Desc })
          .limitBy(2)
          .all(),
      ).toEqual([]);
    });
  });

  describe('#merge()', () => {
    it('AND-combines filters from another scope', async () => {
      const Post = makePost();
      const userOne = Post.filterBy({ userId: 1 });
      const published = Post.filterBy({ status: 'published' });
      const items = await userOne.merge(published).all();
      expect(items.map((i: any) => i.id)).toEqual([1, 3]);
    });

    it('overrides limit and skip with the merged scope', async () => {
      const Post = makePost();
      const a = Post.limitBy(10);
      const b = Post.limitBy(2).skipBy(1);
      const merged = a.merge(b);
      expect(merged.limit).toBe(2);
      expect(merged.skip).toBe(1);
    });

    it('replaces the order with the merged scope when set', async () => {
      const Post = makePost();
      const a = Post.orderBy({ key: 'title', dir: SortDirection.Asc });
      const b = Post.orderBy({ key: 'id', dir: SortDirection.Desc });
      const merged = a.merge(b);
      expect(merged.order).toEqual([{ key: 'id', dir: SortDirection.Desc }]);
    });

    it('keeps the receiver order when the merged scope has none', async () => {
      const Post = makePost();
      const ordered = Post.orderBy({ key: 'title' });
      const filtered = Post.filterBy({ status: 'draft' });
      const merged = ordered.merge(filtered);
      expect(merged.order.length).toBe(1);
    });
  });

  describe('#having()', () => {
    it('filters countBy result by function predicate', async () => {
      const Post = makePost();
      const result = await Post.having((count) => count > 1).countBy('userId');
      expect([...result.entries()]).toEqual([[1, 3]]);
    });

    it('filters countBy result by operator object', async () => {
      const Post = makePost();
      const result = await Post.having({ count: { $gt: 1 } }).countBy('userId');
      expect([...result.entries()]).toEqual([[1, 3]]);
    });

    it('supports $gte / $lt / $lte / $eq', async () => {
      const Post = makePost();
      expect([...(await Post.having({ count: { $gte: 1 } }).countBy('userId')).entries()]).toEqual([
        [1, 3],
        [2, 1],
        [3, 1],
      ]);
      expect([...(await Post.having({ count: { $lt: 2 } }).countBy('userId')).entries()]).toEqual([
        [2, 1],
        [3, 1],
      ]);
      expect([...(await Post.having({ count: { $lte: 1 } }).countBy('userId')).entries()]).toEqual([
        [2, 1],
        [3, 1],
      ]);
      expect([...(await Post.having({ count: { $eq: 3 } }).countBy('userId')).entries()]).toEqual([
        [1, 3],
      ]);
    });

    it('unscoped() clears having', async () => {
      const Post = makePost();
      const scoped = Post.having({ count: { $gt: 100 } });
      const unscoped = scoped.unscoped();
      expect((unscoped as any).havingPredicate).toBeUndefined();
      expect([...(await unscoped.countBy('userId')).entries()].length).toBe(3);
    });
  });

  describe('multi-column #pluck()', () => {
    it('single column still returns a flat array', async () => {
      const Post = makePost();
      const titles = await Post.orderBy({ key: 'id' }).pluck('title');
      expect(titles).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('returns an array of tuples for multiple columns', async () => {
      const Post = makePost();
      const rows = await Post.orderBy({ key: 'id' }).pluck('id', 'title');
      expect(rows).toEqual([
        [1, 'A'],
        [2, 'B'],
        [3, 'C'],
        [4, 'D'],
        [5, 'E'],
      ]);
    });

    it('preserves the requested column order in tuples', async () => {
      const Post = makePost();
      const rows = await Post.orderBy({ key: 'id' }).limitBy(2).pluck('userId', 'id', 'status');
      expect(rows).toEqual([
        [1, 1, 'published'],
        [1, 2, 'draft'],
      ]);
    });

    it('returns [] when no keys are requested', async () => {
      const Post = makePost();
      expect(await Post.pluck()).toEqual([]);
    });
  });
});
