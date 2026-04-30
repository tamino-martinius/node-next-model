import { beforeEach, describe, expect, it } from 'vitest';
import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  delta_widgets: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      count: { type: 'integer', default: 0 },
      group: { type: 'string', default: 'a' },
    },
  },
  race_posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      commentsCount: { type: 'integer', default: 0 },
    },
  },
  race_comments: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      postId: { type: 'integer', default: 0 },
    },
  },
  cb_posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      commentsCount: { type: 'integer', default: 0 },
    },
  },
  cb_comments: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      postId: { type: 'integer', default: 0 },
    },
  },
});

describe('delta increment / decrement', () => {
  let storage: Storage = {};
  const tableName = 'delta_widgets';
  const connector = () => new MemoryConnector({ storage }, { schema });

  beforeEach(() => {
    storage = { [tableName]: [] };
  });

  describe('record.increment via deltaUpdate', () => {
    it('skips validation', async () => {
      let validatorCalls = 0;
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
        validators: [
          () => {
            validatorCalls++;
            return false;
          },
        ],
      });
      const record = await Klass.build({ count: 1 })
        .save()
        .catch(() => null);
      // Cannot create through validators — seed directly to bypass create-time validation.
      storage[tableName] = [{ id: 1, count: 1 }];
      const seeded = (await Klass.find(1))!;
      validatorCalls = 0;
      await seeded.increment('count', 5);
      expect(validatorCalls).toBe(0);
      expect((seeded.attributes as any).count).toBe(6);
      void record;
    });

    it('bumps updatedAt when the model has an updatedAt column', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: true,
      });
      const record = await Klass.create({ count: 0 });
      const before = (record.attributes as any).updatedAt as Date;
      await new Promise((r) => setTimeout(r, 5));
      await record.increment('count');
      const after = (record.attributes as any).updatedAt as Date;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it('fires afterUpdate callback', async () => {
      const events: string[] = [];
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
        callbacks: {
          afterUpdate: [() => events.push('afterUpdate')],
          beforeSave: [() => events.push('beforeSave')],
          afterSave: [() => events.push('afterSave')],
          beforeUpdate: [() => events.push('beforeUpdate')],
        },
      });
      const record = await Klass.create({ count: 0 });
      events.length = 0;
      await record.increment('count');
      expect(events).toContain('afterUpdate');
      // update_columns semantics: full save callbacks NOT fired
      expect(events).not.toContain('beforeSave');
      expect(events).not.toContain('afterSave');
      expect(events).not.toContain('beforeUpdate');
    });

    it('records dirty savedChanges for the incremented column', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
      });
      const record = await Klass.create({ count: 5 });
      await record.increment('count', 3);
      expect((record as any).savedChangeBy('count')).toEqual({ from: 5, to: 8 });
    });

    it('throws when the record has been deleted', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
      });
      const record = await Klass.create({ count: 1 });
      // wipe row so the WHERE matches nothing
      storage[tableName] = [];
      await expect(record.increment('count')).rejects.toThrow();
    });
  });

  describe('Model.where(...).increment(col, by)', () => {
    it('returns the number of affected rows', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
      });
      await Klass.create({ count: 1, group: 'a' });
      await Klass.create({ count: 1, group: 'a' });
      await Klass.create({ count: 1, group: 'b' });
      const affected = await (Klass.filterBy({ group: 'a' }) as any).increment('count', 5);
      expect(affected).toBe(2);
      const cs = (await Klass.all()).map((r: any) => r.count).sort();
      expect(cs).toEqual([1, 6, 6]);
    });

    it('decrement is the negation of increment', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: false,
      });
      const r = await Klass.create({ count: 10 });
      const affected = await (Klass.filterBy({ id: r.id }) as any).decrement('count', 3);
      expect(affected).toBe(1);
      expect(((await Klass.find(r.id)) as any).count).toBe(7);
    });

    it('bumps updatedAt for each affected row when the model has updatedAt', async () => {
      const Klass = Model({
        tableName,
        connector: connector(),
        timestamps: true,
      });
      const a = await Klass.create({ count: 0 });
      const before = (a.attributes as any).updatedAt as Date;
      await new Promise((r) => setTimeout(r, 5));
      await (Klass.filterBy({ id: a.id }) as any).increment('count');
      const reloaded = (await Klass.find(a.id)) as any;
      expect((reloaded.updatedAt as Date).getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('counterCaches use deltaUpdate', () => {
    it('1000 concurrent child creates land a race-free counter', async () => {
      const shared = connector();
      const Post = Model({
        tableName: 'race_posts',
        connector: shared,
        timestamps: false,
      });
      const Comment = Model({
        tableName: 'race_comments',
        connector: shared,
        timestamps: false,
        counterCaches: [{ belongsTo: Post, foreignKey: 'postId', column: 'commentsCount' }],
      });
      storage.race_posts = [{ id: 1, commentsCount: 0 }];
      storage.race_comments = [];
      const N = 1000;
      await Promise.all(
        Array.from({ length: N }, (_, i) => Comment.create({ postId: 1, id: i + 1 } as any)),
      );
      const post = (await Post.find(1)) as any;
      expect(post.commentsCount).toBe(N);
    });

    it('does not trigger parent save / validation callbacks', async () => {
      const events: string[] = [];
      const shared = connector();
      const Post = Model({
        tableName: 'cb_posts',
        connector: shared,
        timestamps: false,
        callbacks: {
          beforeSave: [() => events.push('post.beforeSave')],
          afterSave: [() => events.push('post.afterSave')],
          beforeUpdate: [() => events.push('post.beforeUpdate')],
          afterUpdate: [() => events.push('post.afterUpdate')],
        },
        validators: [
          () => {
            events.push('post.validate');
            return true;
          },
        ],
      });
      const Comment = Model({
        tableName: 'cb_comments',
        connector: shared,
        timestamps: false,
        counterCaches: [{ belongsTo: Post, foreignKey: 'postId', column: 'commentsCount' }],
      });
      storage.cb_posts = [{ id: 1, commentsCount: 0 }];
      storage.cb_comments = [];
      events.length = 0;
      await Comment.create({ postId: 1 });
      // counter cache must not fire parent's full save callback chain
      expect(events).not.toContain('post.beforeSave');
      expect(events).not.toContain('post.afterSave');
      expect(events).not.toContain('post.beforeUpdate');
      expect(events).not.toContain('post.validate');
      // verify the counter actually moved
      const post = (await Post.find(1)) as any;
      expect(post.commentsCount).toBe(1);
    });
  });
});
