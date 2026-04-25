import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Model } from '../Model.js';
import { type Connector, KeyType } from '../types.js';

export interface ConformanceOptions {
  name: string;
  makeConnector: () => Connector | Promise<Connector>;
  /** Optional teardown after the whole suite (e.g. `connector.knex.destroy()`). */
  teardown?: (connector: Connector) => Promise<void>;
  /** Skip transaction tests when the connector doesn't support real transactions. */
  skipTransactions?: boolean;
}

interface CatProps {
  name: string;
  age: number;
}

export function runModelConformance(opts: ConformanceOptions): void {
  describe(`Model conformance — ${opts.name}`, () => {
    let connector: Connector;
    let Cat: ReturnType<typeof makeCat>;
    const tableName = 'conformance_cats';

    function makeCat(c: Connector) {
      return class extends Model({
        tableName,
        connector: c,
        timestamps: false,
        init: (props: CatProps) => props,
      }) {};
    }

    beforeEach(async () => {
      connector = await opts.makeConnector();
      Cat = makeCat(connector);
      if (await connector.hasTable(tableName)) {
        await connector.dropTable(tableName);
      }
      await connector.createTable(tableName, (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('name');
        t.integer('age');
      });
    });

    afterAll(async () => {
      if (opts.teardown) await opts.teardown(connector);
    });

    describe('CRUD', () => {
      it('creates a row and assigns an id', async () => {
        const cat = await Cat.create({ name: 'Whiskers', age: 5 });
        expect(cat.id).toBeDefined();
        expect(cat.name).toBe('Whiskers');
        expect(cat.age).toBe(5);
      });

      it('finds an existing row by id', async () => {
        const created = await Cat.create({ name: 'Mittens', age: 3 });
        const found = await Cat.find(created.id);
        expect(found?.name).toBe('Mittens');
      });

      it('returns undefined via findBy for a missing id', async () => {
        expect(await Cat.findBy({ id: 99999 })).toBeUndefined();
      });

      it('updates an instance', async () => {
        const cat = await Cat.create({ name: 'Tom', age: 4 });
        await cat.update({ age: 5 });
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(5);
      });

      it('deletes an instance', async () => {
        const cat = await Cat.create({ name: 'Goner', age: 9 });
        const id = cat.id;
        await cat.delete();
        expect(await Cat.findBy({ id })).toBeUndefined();
      });

      it('createMany inserts a batch and returns instances', async () => {
        const cats = await Cat.createMany([
          { name: 'a', age: 1 },
          { name: 'b', age: 2 },
        ]);
        expect(cats).toHaveLength(2);
        expect(cats.every((c) => typeof c.id === 'number')).toBe(true);
      });

      it('reload pulls fresh state from the connector', async () => {
        const cat = await Cat.create({ name: 'Stale', age: 1 });
        await Cat.filterBy({ id: cat.id }).updateAll({ age: 99 });
        await cat.reload();
        expect(cat.age).toBe(99);
      });

      it('updateAll bulk-updates matching rows', async () => {
        await Cat.create({ name: 'a', age: 1 });
        await Cat.create({ name: 'b', age: 2 });
        await Cat.filterBy({ $gt: { age: 0 } }).updateAll({ age: 10 });
        const ages = (await Cat.all()).map((c) => c.age);
        expect(ages.every((a) => a === 10)).toBe(true);
      });

      it('deleteAll bulk-deletes matching rows', async () => {
        await Cat.create({ name: 'a', age: 1 });
        await Cat.create({ name: 'b', age: 2 });
        await Cat.filterBy({ $gt: { age: 1 } }).deleteAll();
        expect(await Cat.count()).toBe(1);
      });
    });

    describe('atomicUpdate', () => {
      it('declares supportsAtomicUpdate when the method exists', () => {
        if (typeof connector.atomicUpdate === 'function') {
          expect(connector.supportsAtomicUpdate).toBe(true);
        } else {
          expect(connector.supportsAtomicUpdate).toBeFalsy();
        }
      });

      it('applies a positive delta atomically', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'inc', age: 5 });
        const affected = await connector.atomicUpdate({
          tableName,
          filter: { id: cat.id },
          deltas: [{ column: 'age', by: 3 }],
        });
        expect(affected).toBe(1);
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(8);
      });

      it('applies a negative delta atomically', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'dec', age: 10 });
        const affected = await connector.atomicUpdate({
          tableName,
          filter: { id: cat.id },
          deltas: [{ column: 'age', by: -4 }],
        });
        expect(affected).toBe(1);
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(6);
      });

      it('applies multiple deltas in one call', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        if (await connector.hasTable('conformance_atomic_multi')) {
          await connector.dropTable('conformance_atomic_multi');
        }
        await connector.createTable('conformance_atomic_multi', (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.integer('a');
          t.integer('b');
        });
        const [row] = await connector.batchInsert(
          'conformance_atomic_multi',
          { id: KeyType.number },
          [{ a: 1, b: 10 }],
        );
        const affected = await connector.atomicUpdate({
          tableName: 'conformance_atomic_multi',
          filter: { id: row.id },
          deltas: [
            { column: 'a', by: 5 },
            { column: 'b', by: -2 },
          ],
        });
        expect(affected).toBe(1);
        const after = (await connector.query({ tableName: 'conformance_atomic_multi' }))[0];
        expect(after.a).toBe(6);
        expect(after.b).toBe(8);
        await connector.dropTable('conformance_atomic_multi');
      });

      it('honours the filter and only updates matching rows', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const a = await Cat.create({ name: 'matched', age: 1 });
        const b = await Cat.create({ name: 'untouched', age: 1 });
        const affected = await connector.atomicUpdate({
          tableName,
          filter: { id: a.id },
          deltas: [{ column: 'age', by: 7 }],
        });
        expect(affected).toBe(1);
        expect((await Cat.find(a.id))?.age).toBe(8);
        expect((await Cat.find(b.id))?.age).toBe(1);
      });

      it('returns 0 when no rows match', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const affected = await connector.atomicUpdate({
          tableName,
          filter: { id: 999_999 },
          deltas: [{ column: 'age', by: 1 }],
        });
        expect(affected).toBe(0);
      });

      it('applies absolute set fields alongside deltas', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'orig', age: 1 });
        const affected = await connector.atomicUpdate({
          tableName,
          filter: { id: cat.id },
          deltas: [{ column: 'age', by: 2 }],
          set: { name: 'renamed' },
        });
        expect(affected).toBe(1);
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(3);
        expect(reloaded?.name).toBe('renamed');
      });

      it('1000 concurrent increments converge to the correct value', async (ctx) => {
        if (!connector.supportsAtomicUpdate || !connector.atomicUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'race', age: 0 });
        const N = 1000;
        await Promise.all(
          Array.from({ length: N }, () =>
            connector.atomicUpdate!({
              tableName,
              filter: { id: cat.id },
              deltas: [{ column: 'age', by: 1 }],
            }),
          ),
        );
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(N);
      }, 30_000);
    });

    describe('Query', () => {
      beforeEach(async () => {
        await Cat.create({ name: 'a', age: 1 });
        await Cat.create({ name: 'b', age: 2 });
        await Cat.create({ name: 'c', age: 3 });
      });

      it('counts rows', async () => {
        expect(await Cat.count()).toBe(3);
      });

      it('filters by equality', async () => {
        const cats = await Cat.filterBy({ age: 2 }).all();
        expect(cats.map((c) => c.name)).toEqual(['b']);
      });

      it('orders rows by a column', async () => {
        const cats = await Cat.orderBy({ key: 'age' }).all();
        expect(cats.map((c) => c.age)).toEqual([1, 2, 3]);
      });

      it('limits and skips', async () => {
        const cats = await Cat.orderBy({ key: 'age' }).limitBy(1).skipBy(1).all();
        expect(cats.map((c) => c.age)).toEqual([2]);
      });

      it('aggregates sum/min/max/avg', async () => {
        expect(await Cat.sum('age')).toBe(6);
        expect(await Cat.min('age')).toBe(1);
        expect(await Cat.max('age')).toBe(3);
        expect(await Cat.avg('age')).toBe(2);
      });

      it('first / last respect order', async () => {
        const first = await Cat.orderBy({ key: 'age' }).first();
        const last = await Cat.orderBy({ key: 'age' }).last();
        expect(first?.age).toBe(1);
        expect(last?.age).toBe(3);
      });

      it('exists / exists(filter)', async () => {
        expect(await Cat.exists()).toBe(true);
        expect(await Cat.exists({ age: 2 })).toBe(true);
        expect(await Cat.exists({ age: 999 })).toBe(false);
      });

      it('pluck / pluckUnique / ids', async () => {
        const names = await Cat.orderBy({ key: 'age' }).pluck('name');
        expect(names).toEqual(['a', 'b', 'c']);
        const ids = await Cat.ids();
        expect(ids).toHaveLength(3);
        await Cat.create({ name: 'a', age: 4 });
        const unique = await Cat.pluckUnique('name');
        expect(new Set(unique)).toEqual(new Set(['a', 'b', 'c']));
      });

      it('paginate returns page metadata', async () => {
        const page = await Cat.orderBy({ key: 'age' }).paginate(1, 2);
        expect(page.items).toHaveLength(2);
        expect(page.total).toBe(3);
        expect(page.page).toBe(1);
        expect(page.perPage).toBe(2);
        expect(page.totalPages).toBe(2);
        expect(page.hasNext).toBe(true);
        expect(page.hasPrev).toBe(false);
      });

      it('paginateCursor walks forward via nextCursor', async () => {
        const first = await Cat.paginateCursor({ limit: 2 });
        expect(first.items.map((c) => c.age)).toEqual([1, 2]);
        expect(first.hasMore).toBe(true);
        expect(first.nextCursor).toBeDefined();

        const second = await Cat.paginateCursor({ after: first.nextCursor, limit: 2 });
        expect(second.items.map((c) => c.age)).toEqual([3]);
        expect(second.hasMore).toBe(false);
        expect(second.nextCursor).toBeUndefined();
      });

      it('paginateCursor walks backward via before', async () => {
        const all = await Cat.orderBy({ key: 'id' }).all();
        const lastId = all[all.length - 1].id;
        const prev = await Cat.paginateCursor({
          before: Buffer.from(JSON.stringify({ id: lastId }), 'utf8').toString('base64url'),
          limit: 2,
        });
        // The two rows immediately before lastId.
        expect(prev.items.map((c) => c.id)).toEqual([all[0].id, all[1].id]);
      });

      it('inBatchesOf yields all rows in chunks', async () => {
        const collected: number[] = [];
        for await (const batch of Cat.orderBy({ key: 'age' }).inBatchesOf(2)) {
          collected.push(...batch.map((c) => c.age));
        }
        expect(collected).toEqual([1, 2, 3]);
      });

      it('findEach yields each row', async () => {
        const collected: number[] = [];
        for await (const cat of Cat.orderBy({ key: 'age' }).findEach()) {
          collected.push(cat.age);
        }
        expect(collected).toEqual([1, 2, 3]);
      });

      it('countBy returns a Map of counts', async () => {
        await Cat.create({ name: 'b', age: 2 });
        const counts = await Cat.countBy('name');
        expect(counts.get('b')).toBe(2);
        expect(counts.get('a')).toBe(1);
      });

      it('groupBy returns a Map of instances', async () => {
        await Cat.create({ name: 'b', age: 99 });
        const groups = await Cat.groupBy('name');
        expect(groups.get('b')).toHaveLength(2);
        expect(groups.get('a')).toHaveLength(1);
      });
    });

    describe('Find variants', () => {
      it('findOrFail throws NotFoundError on miss', async () => {
        await expect(Cat.findOrFail({ id: 99999 })).rejects.toThrow(/not found/i);
      });

      it('findOrBuild returns unsaved draft on miss', async () => {
        const cat = await Cat.findOrBuild({ name: 'ghost' }, { name: 'ghost', age: 0 });
        expect(cat.isNew()).toBe(true);
      });

      it('firstOrCreate persists when missing', async () => {
        const cat = await Cat.firstOrCreate({ name: 'newbie' }, { name: 'newbie', age: 1 });
        expect(cat.id).toBeDefined();
        expect(await Cat.count()).toBe(1);
      });

      it('updateOrCreate updates when present', async () => {
        const original = await Cat.create({ name: 'updated', age: 1 });
        const cat = await Cat.updateOrCreate({ id: original.id }, { name: 'updated', age: 99 });
        expect(cat.id).toBe(original.id);
        expect(cat.age).toBe(99);
      });
    });

    if (!opts.skipTransactions) {
      describe('Transactions', () => {
        it('commits on success', async () => {
          await connector.transaction(async () => {
            await Cat.create({ name: 'tx-a', age: 10 });
            await Cat.create({ name: 'tx-b', age: 11 });
          });
          expect(await Cat.count()).toBe(2);
        });

        it('rolls back on throw', async () => {
          await expect(
            connector.transaction(async () => {
              await Cat.create({ name: 'doomed', age: 99 });
              throw new Error('boom');
            }),
          ).rejects.toThrow('boom');
          expect(await Cat.count()).toBe(0);
        });

        it('nests by joining the outer transaction', async () => {
          await expect(
            connector.transaction(async () => {
              await Cat.create({ name: 'outer', age: 1 });
              await connector.transaction(async () => {
                await Cat.create({ name: 'inner', age: 2 });
                throw new Error('inner');
              });
            }),
          ).rejects.toThrow('inner');
          expect(await Cat.count()).toBe(0);
        });
      });
    }

    describe('Schema DSL', () => {
      it('reports hasTable for existing table and false after drop', async () => {
        expect(await connector.hasTable(tableName)).toBe(true);
        await connector.dropTable(tableName);
        expect(await connector.hasTable(tableName)).toBe(false);
      });
    });

    describe('Dirty tracking', () => {
      it('tracks pending changes before save', async () => {
        const cat = await Cat.create({ name: 'orig', age: 1 });
        cat.assign({ name: 'changed' });
        expect(cat.isChanged()).toBe(true);
        expect(cat.isChangedBy('name')).toBe(true);
        expect(cat.isChangedBy('age')).toBe(false);
        const changes = cat.changes();
        expect(changes.name).toEqual({ from: 'orig', to: 'changed' });
      });

      it('revertChange / revertChanges undo pending edits', async () => {
        const cat = await Cat.create({ name: 'orig', age: 1 });
        cat.assign({ name: 'changed', age: 99 });
        cat.revertChange('name');
        expect(cat.name).toBe('orig');
        expect(cat.age).toBe(99);
        cat.revertChanges();
        expect(cat.age).toBe(1);
      });

      it('records savedChanges after a successful save', async () => {
        const cat = await Cat.create({ name: 'orig', age: 1 });
        await cat.update({ age: 5 });
        expect(cat.wasChanged()).toBe(true);
        expect(cat.savedChanges().age).toEqual({ from: 1, to: 5 });
      });
    });

    describe('Validators + lifecycle callbacks', () => {
      const tableName = 'conformance_validated';
      type Props = { name: string };

      beforeEach(async () => {
        if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
        await connector.createTable(tableName, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('name');
        });
      });

      it('rejects save when a validator returns false', async () => {
        class Strict extends Model({
          tableName,
          connector,
          timestamps: false,
          init: (props: Props) => props,
          validators: [(instance: { name: string }) => instance.name.length > 0],
        }) {}
        await expect(Strict.create({ name: '' })).rejects.toThrow(/validation/i);
        expect(await Strict.count()).toBe(0);
      });

      it('runs lifecycle callbacks in declared order', async () => {
        const events: string[] = [];
        class Tracked extends Model({
          tableName,
          connector,
          timestamps: false,
          init: (props: Props) => props,
          callbacks: {
            beforeCreate: [() => events.push('beforeCreate')],
            afterCreate: [() => events.push('afterCreate')],
            beforeSave: [() => events.push('beforeSave')],
            afterSave: [() => events.push('afterSave')],
          },
        }) {}
        await Tracked.create({ name: 'hooks' });
        expect(events).toEqual(['beforeSave', 'beforeCreate', 'afterCreate', 'afterSave']);
      });

      it('on() subscribes a callback at runtime', async () => {
        const seen: string[] = [];
        class Live extends Model({
          tableName,
          connector,
          timestamps: false,
          init: (props: Props) => props,
        }) {}
        const off = Live.on('afterCreate', (instance: any) => seen.push(instance.name));
        await Live.create({ name: 'first' });
        off();
        await Live.create({ name: 'after-off' });
        expect(seen).toEqual(['first']);
      });
    });

    describe('Soft delete', () => {
      const tableName = 'conformance_soft';
      type Props = { label: string };
      let Doc: any;

      beforeEach(async () => {
        if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
        await connector.createTable(tableName, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('label');
          t.timestamp('discardedAt');
        });
        Doc = class extends (
          Model({
            tableName,
            connector,
            timestamps: false,
            softDelete: true,
            init: (props: Props) => props,
          })
        ) {};
      });

      it('discard hides the row from the default scope', async () => {
        const doc = await Doc.create({ label: 'a' });
        await doc.discard();
        expect(await Doc.count()).toBe(0);
        expect(await Doc.withDiscarded().count()).toBe(1);
        expect(await Doc.onlyDiscarded().count()).toBe(1);
      });

      it('restore un-hides the row', async () => {
        const doc = await Doc.create({ label: 'a' });
        await doc.discard();
        await doc.restore();
        expect(await Doc.count()).toBe(1);
        expect(await Doc.onlyDiscarded().count()).toBe(0);
      });

      it('isDiscarded reflects current state', async () => {
        const doc = await Doc.create({ label: 'a' });
        expect(doc.isDiscarded()).toBe(false);
        await doc.discard();
        expect(doc.isDiscarded()).toBe(true);
      });
    });

    describe('Named scopes', () => {
      it('exposes scopes as chainable static methods', async () => {
        class Scoped extends Model({
          tableName,
          connector,
          timestamps: false,
          init: (props: CatProps) => props,
          scopes: {
            adults: (self: any) => self.filterBy({ $gte: { age: 3 } }),
            named: (self: any, name: string) => self.filterBy({ name }),
          },
        }) {}
        await Scoped.create({ name: 'kit', age: 1 });
        await Scoped.create({ name: 'mature', age: 5 });
        await Scoped.create({ name: 'mature', age: 7 });
        expect(await (Scoped as any).adults().count()).toBe(2);
        expect(await (Scoped as any).adults().named('mature').count()).toBe(2);
      });
    });

    describe('Associations', () => {
      const postsTable = 'conformance_posts';
      type AuthorProps = { name: string };
      type PostProps = { title: string; authorId: number };
      let Author: any;
      let Post: any;

      beforeEach(async () => {
        if (await connector.hasTable(postsTable)) await connector.dropTable(postsTable);
        await connector.createTable(postsTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('title');
          t.integer('authorId');
        });
        Author = class extends (
          Model({
            tableName,
            connector,
            timestamps: false,
            init: (props: AuthorProps) => ({ ...props, age: 0 }) as CatProps,
          })
        ) {};
        Post = class extends (
          Model({
            tableName: postsTable,
            connector,
            timestamps: false,
            init: (props: PostProps) => props,
          })
        ) {};
      });

      it('belongsTo / hasMany resolve cross-table relations', async () => {
        const author = await Author.create({ name: 'ada' });
        await Post.create({ title: 'first', authorId: author.id });
        await Post.create({ title: 'second', authorId: author.id });

        const posts = await author.hasMany(Post, { foreignKey: 'authorId' }).all();
        expect(posts).toHaveLength(2);

        const post = (await Post.all())[0];
        const back = await post.belongsTo(Author, { foreignKey: 'authorId' });
        expect(back?.name).toBe('ada');
      });
    });
  });
}
