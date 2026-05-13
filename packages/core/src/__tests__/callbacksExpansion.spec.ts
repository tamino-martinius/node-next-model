import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
    },
  },
});

describe('lifecycle callback expansion', () => {
  let storage: Storage = {};
  const tableName = 'posts';
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makePost() {
    return Model({
      tableName,
      connector: connector(),
    });
  }

  beforeEach(() => {
    storage = { [tableName]: [{ id: 1, title: 'Hello' }] };
  });

  afterEach(() => {
    storage = {};
  });

  describe('#afterInitialize', () => {
    it('fires on build()', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterInitialize', (r: any) => {
        calls.push(`init:${r.title}`);
      });
      Post.build({ title: 'x' });
      expect(calls).toEqual(['init:x']);
    });

    it('fires on hydration from queries', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterInitialize', (r: any) => {
        calls.push(`init:${r.title}`);
      });
      await Post.find(1);
      expect(calls).toEqual(['init:Hello']);
    });
  });

  describe('#afterFind', () => {
    it('fires on hydration', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterFind', (r: any) => {
        calls.push(`find:${r.title}`);
      });
      await Post.find(1);
      expect(calls).toEqual(['find:Hello']);
    });

    it('does NOT fire on build()', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('afterFind', () => {
        calls.push('find');
      });
      Post.build({ title: 'x' });
      expect(calls).toEqual([]);
    });
  });

  describe('#beforeValidation / #afterValidation', () => {
    it('fires before and after validators', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('beforeValidation', (r: any) => {
        calls.push(`before:${r.title}`);
      });
      Post.on('afterValidation', (r: any) => {
        calls.push(`after:${r.title}`);
      });
      const post = Post.build({ title: 'x' });
      await post.isValid();
      expect(calls).toEqual(['before:x', 'after:x']);
    });

    it('beforeValidation mutations propagate to validators', async () => {
      const Post = Model({
        tableName,
        connector: connector(),
        validators: [(r: any) => r.title.startsWith('NORMALIZED')],
      });
      Post.on('beforeValidation', (r: any) => {
        r.title = `NORMALIZED:${r.title}`;
      });
      const post = Post.build({ title: 'x' });
      expect(await post.isValid()).toBe(true);
    });
  });

  describe('#aroundSave / #aroundCreate / #aroundUpdate / #aroundDelete', () => {
    it('aroundSave wraps the operation', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('aroundSave', async (_r: any, next: () => Promise<void>) => {
        calls.push('before');
        await next();
        calls.push('after');
      });
      const post = Post.build({ title: 'x' });
      await post.save();
      expect(calls).toEqual(['before', 'after']);
    });

    it('multiple around handlers compose LIFO (outer first)', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('aroundSave', async (_r: any, next: () => Promise<void>) => {
        calls.push('outer:before');
        await next();
        calls.push('outer:after');
      });
      Post.on('aroundSave', async (_r: any, next: () => Promise<void>) => {
        calls.push('inner:before');
        await next();
        calls.push('inner:after');
      });
      const post = Post.build({ title: 'x' });
      await post.save();
      expect(calls).toEqual(['outer:before', 'inner:before', 'inner:after', 'outer:after']);
    });

    it('an around handler that does not call next() skips the body', async () => {
      const Post = makePost();
      Post.on('aroundSave', async () => {
        /* intentionally never calls next() */
      });
      const post = Post.build({ title: 'x' });
      await post.save();
      expect(post.isNew()).toBe(true);
    });

    it('aroundCreate fires on inserts, not updates', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('aroundCreate', async (_r: any, next: () => Promise<void>) => {
        calls.push('create');
        await next();
      });
      Post.on('aroundUpdate', async (_r: any, next: () => Promise<void>) => {
        calls.push('update');
        await next();
      });
      const post = Post.build({ title: 'x' });
      await post.save();
      post.title = 'y';
      await post.save();
      expect(calls).toEqual(['create', 'update']);
    });

    it('aroundDelete wraps delete()', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('aroundDelete', async (_r: any, next: () => Promise<void>) => {
        calls.push('before');
        await next();
        calls.push('after');
      });
      const post = await Post.find(1);
      await post!.delete();
      expect(calls).toEqual(['before', 'after']);
    });
  });

  describe('#skipCallbacks', () => {
    it('suppresses the listed events during the callback', async () => {
      const Post = makePost();
      let afterCreateCalls = 0;
      Post.on('afterCreate', () => {
        afterCreateCalls++;
      });
      await Post.skipCallbacks(['afterCreate'], async () => {
        await Post.create({ title: 'x' });
      });
      expect(afterCreateCalls).toBe(0);
      await Post.create({ title: 'y' });
      expect(afterCreateCalls).toBe(1);
    });

    it('restores callbacks even when fn throws', async () => {
      const Post = makePost();
      let beforeSaveCalls = 0;
      Post.on('beforeSave', () => {
        beforeSaveCalls++;
      });
      await expect(
        Post.skipCallbacks(['beforeSave'], async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      const post = Post.build({ title: 'x' });
      await post.save();
      expect(beforeSaveCalls).toBe(1);
    });
  });

  describe('existing callback surface is preserved', () => {
    it('beforeSave / afterSave / beforeCreate / afterCreate still fire', async () => {
      const Post = makePost();
      const calls: string[] = [];
      Post.on('beforeSave', () => calls.push('beforeSave'));
      Post.on('beforeCreate', () => calls.push('beforeCreate'));
      Post.on('afterCreate', () => calls.push('afterCreate'));
      Post.on('afterSave', () => calls.push('afterSave'));
      const post = Post.build({ title: 'x' });
      await post.save();
      expect(calls).toEqual(['beforeSave', 'beforeCreate', 'afterCreate', 'afterSave']);
    });
  });
});
