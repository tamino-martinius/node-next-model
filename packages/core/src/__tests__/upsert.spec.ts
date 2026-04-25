import { KeyType, MemoryConnector, Model, type Storage } from '../index.js';

describe('upsert / upsertAll', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage });

  function makePost() {
    return Model({
      tableName: 'posts',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { id?: number; title?: string; views?: number }) => ({
        title: p.title ?? '',
        views: p.views ?? 0,
      }),
    });
  }

  beforeEach(() => {
    storage = {
      posts: [
        { id: 1, title: 'A', views: 10 },
        { id: 2, title: 'B', views: 20 },
      ],
    };
  });

  afterEach(() => {
    storage = {};
  });

  describe('#upsert', () => {
    it('inserts when no row matches the primary key', async () => {
      const Post = makePost();
      const result = (await Post.upsert({ id: 99, title: 'New', views: 1 })) as any;
      expect(result.title).toBe('New');
      expect(result.isPersistent()).toBe(true);
      expect(storage.posts.find((r) => r.title === 'New')).toBeDefined();
      expect(storage.posts.find((r) => r.id === 1)?.title).toBe('A');
    });

    it('updates when a row matches the primary key', async () => {
      const Post = makePost();
      const result = (await Post.upsert({ id: 1, title: 'Updated', views: 11 })) as any;
      expect(result.title).toBe('Updated');
      expect(result.views).toBe(11);
      expect(storage.posts.find((r) => r.id === 1)?.title).toBe('Updated');
      expect(storage.posts.find((r) => r.id === 1)?.views).toBe(11);
    });

    it('respects an explicit onConflict column', async () => {
      const Tag = Model({
        tableName: 'tags',
        connector: new MemoryConnector({
          storage: {
            tags: [{ id: 1, slug: 'js', name: 'JavaScript' }],
          },
        }),
        keys: { id: KeyType.number },
        init: (p: { slug?: string; name?: string }) => ({ slug: p.slug ?? '', name: p.name ?? '' }),
      });
      const result = (await Tag.upsert({ slug: 'js', name: 'JS' }, { onConflict: 'slug' })) as any;
      expect(result.id).toBe(1);
      expect(result.name).toBe('JS');
    });

    it('respects a multi-column onConflict tuple', async () => {
      const Slot = Model({
        tableName: 'slots',
        connector: new MemoryConnector({
          storage: {
            slots: [{ id: 1, tenantId: 1, key: 'home', value: 'old' }],
          },
          lastIds: { slots: 1 },
        }),
        keys: { id: KeyType.number },
        init: (p: { tenantId?: number; key?: string; value?: string }) => ({
          tenantId: p.tenantId ?? 0,
          key: p.key ?? '',
          value: p.value ?? '',
        }),
      });
      const updated = (await Slot.upsert(
        { tenantId: 1, key: 'home', value: 'new' },
        { onConflict: ['tenantId', 'key'] },
      )) as any;
      expect(updated.id).toBe(1);
      expect(updated.value).toBe('new');
      const fresh = (await Slot.upsert(
        { tenantId: 2, key: 'home', value: 'fresh' },
        { onConflict: ['tenantId', 'key'] },
      )) as any;
      expect(fresh.id).not.toBe(1);
      expect(fresh.value).toBe('fresh');
      expect(await Slot.count()).toBe(2);
    });

    it('throws when a conflict column is missing', async () => {
      const Post = makePost();
      await expect(Post.upsert({ title: 'No id' } as any)).rejects.toThrowError(
        /upsert requires 'id'/,
      );
    });

    it('returns the existing row unchanged when only the conflict column is supplied', async () => {
      const Post = makePost();
      const result = (await Post.upsert({ id: 1 })) as any;
      expect(result.title).toBe('A');
    });
  });

  describe('#upsertAll', () => {
    it('partitions inserts and updates and returns instances in input order', async () => {
      const Post = makePost();
      const results = (await Post.upsertAll([
        { id: 1, title: 'A2' },
        { id: 99, title: 'New' },
        { id: 2, title: 'B2' },
      ])) as any[];
      expect(results.map((r) => r.attributes().title)).toEqual(['A2', 'New', 'B2']);
      expect(storage.posts.find((r) => r.id === 1)?.title).toBe('A2');
      expect(storage.posts.find((r) => r.id === 2)?.title).toBe('B2');
      expect(storage.posts.find((r) => r.title === 'New')).toBeDefined();
      expect(storage.posts).toHaveLength(3);
    });

    it('handles a fully-insert batch', async () => {
      const Post = makePost();
      const results = (await Post.upsertAll([
        { id: 100, title: 'X' },
        { id: 101, title: 'Y' },
      ])) as any[];
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.attributes().title)).toEqual(['X', 'Y']);
      expect(storage.posts).toHaveLength(4);
    });

    it('handles a fully-update batch with one bulk SELECT', async () => {
      const Post = makePost();
      const results = (await Post.upsertAll([
        { id: 1, title: 'A2' },
        { id: 2, title: 'B2' },
      ])) as any[];
      expect(results.map((r) => r.attributes().title)).toEqual(['A2', 'B2']);
      expect(storage.posts).toHaveLength(2);
    });

    it('returns [] for an empty list without hitting the connector', async () => {
      const Post = makePost();
      const spy = vi.spyOn(Post.connector, 'query');
      const results = await Post.upsertAll([]);
      expect(results).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('respects multi-column onConflict', async () => {
      const Slot = Model({
        tableName: 'slots',
        connector: new MemoryConnector({
          storage: {
            slots: [
              { id: 1, tenantId: 1, key: 'home', value: 'old1' },
              { id: 2, tenantId: 2, key: 'home', value: 'old2' },
            ],
          },
          lastIds: { slots: 2 },
        }),
        keys: { id: KeyType.number },
        init: (p: { tenantId?: number; key?: string; value?: string }) => ({
          tenantId: p.tenantId ?? 0,
          key: p.key ?? '',
          value: p.value ?? '',
        }),
      });
      const results = (await Slot.upsertAll(
        [
          { tenantId: 1, key: 'home', value: 'new1' },
          { tenantId: 3, key: 'home', value: 'fresh' },
        ],
        { onConflict: ['tenantId', 'key'] },
      )) as any[];
      expect(results[0].id).toBe(1);
      expect(results[0].attributes().value).toBe('new1');
      expect(results[1].id).not.toBe(1);
      expect(results[1].id).not.toBe(2);
      expect(results[1].attributes().value).toBe('fresh');
      expect(await Slot.count()).toBe(3);
    });

    it('throws when a conflict column is missing on any row', async () => {
      const Post = makePost();
      await expect(Post.upsertAll([{ title: 'No id' } as any])).rejects.toThrowError(
        /upsertAll requires 'id'/,
      );
    });
  });
});
