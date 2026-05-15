import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Model } from '../Model.js';
import { defineSchema } from '../typedSchema.js';
import { type Connector, KeyType } from '../types.js';

export interface ConformanceOptions {
  name: string;
  makeConnector: () => Connector | Promise<Connector>;
  /** Optional teardown after the whole suite (e.g. `connector.knex.destroy()`). */
  teardown?: (connector: Connector) => Promise<void>;
  /** Skip transaction tests when the connector doesn't support real transactions. */
  skipTransactions?: boolean;
}

// ---------------------------------------------------------------------------
// Schema declaration — shared across all conformance Model call sites.
// Each table used anywhere in this fixture is declared here with its full
// column set (union of all usages across describe blocks).
// ---------------------------------------------------------------------------
export const conformanceSchema = defineSchema({
  // --- Core CRUD table -------------------------------------------------------
  conformance_cats: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
    },
  },
  // --- Upsert table ----------------------------------------------------------
  conformance_upsert: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      slug: { type: 'string' },
      name: { type: 'string' },
    },
  },
  // --- Validators / lifecycle callbacks table --------------------------------
  conformance_validated: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
  // --- Soft delete table -----------------------------------------------------
  conformance_soft: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      label: { type: 'string' },
      discardedAt: { type: 'timestamp', null: true },
    },
  },
  // --- Associations test: posts table ----------------------------------------
  conformance_posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      authorId: { type: 'integer' },
    },
  },
  // --- JOIN capability tables ------------------------------------------------
  conformance_join_users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
    associations: {
      posts: { hasMany: 'conformance_join_posts', foreignKey: 'userId' },
    },
  },
  conformance_join_posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      userId: { type: 'integer' },
      status: { type: 'string' },
    },
  },
  // --- Builder pipeline tables -----------------------------------------------
  conformance_chain_users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      email: { type: 'string' },
      role: { type: 'string', null: true },
      active: { type: 'integer', null: true },
    },
    associations: {
      todos: { hasMany: 'conformance_chain_todos', foreignKey: 'userId' },
    },
  },
  conformance_chain_todos: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer', null: true },
      title: { type: 'string' },
      ownerEmail: { type: 'string', null: true },
    },
  },
  conformance_chain_addresses: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      city: { type: 'string' },
    },
  },
  conformance_chain_customers: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      addressId: { type: 'integer' },
    },
    associations: {
      address: { belongsTo: 'conformance_chain_addresses', foreignKey: 'addressId' },
    },
  },
  conformance_chain_orders: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      total: { type: 'integer' },
      customerId: { type: 'integer', null: true },
    },
    associations: {
      customer: { belongsTo: 'conformance_chain_customers', foreignKey: 'customerId' },
    },
  },
  conformance_chain_order_items: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      orderId: { type: 'integer' },
      amount: { type: 'integer' },
    },
  },
});

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

    describe('deltaUpdate', () => {
      it('applies a positive delta atomically', async (ctx) => {
        if (!connector.deltaUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'inc', age: 5 });
        const affected = await connector.deltaUpdate({
          tableName,
          filter: { id: cat.id },
          deltas: [{ column: 'age', by: 3 }],
        });
        expect(affected).toBe(1);
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(8);
      });

      it('applies a negative delta atomically', async (ctx) => {
        if (!connector.deltaUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'dec', age: 10 });
        const affected = await connector.deltaUpdate({
          tableName,
          filter: { id: cat.id },
          deltas: [{ column: 'age', by: -4 }],
        });
        expect(affected).toBe(1);
        const reloaded = await Cat.find(cat.id);
        expect(reloaded?.age).toBe(6);
      });

      it('applies multiple deltas in one call', async (ctx) => {
        if (!connector.deltaUpdate) return ctx.skip();
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
        const affected = await connector.deltaUpdate({
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
        if (!connector.deltaUpdate) return ctx.skip();
        const a = await Cat.create({ name: 'matched', age: 1 });
        const b = await Cat.create({ name: 'untouched', age: 1 });
        const affected = await connector.deltaUpdate({
          tableName,
          filter: { id: a.id },
          deltas: [{ column: 'age', by: 7 }],
        });
        expect(affected).toBe(1);
        expect((await Cat.find(a.id))?.age).toBe(8);
        expect((await Cat.find(b.id))?.age).toBe(1);
      });

      it('returns 0 when no rows match', async (ctx) => {
        if (!connector.deltaUpdate) return ctx.skip();
        const affected = await connector.deltaUpdate({
          tableName,
          filter: { id: 999_999 },
          deltas: [{ column: 'age', by: 1 }],
        });
        expect(affected).toBe(0);
      });

      it('applies absolute set fields alongside deltas', async (ctx) => {
        if (!connector.deltaUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'orig', age: 1 });
        const affected = await connector.deltaUpdate({
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
        if (!connector.deltaUpdate) return ctx.skip();
        const cat = await Cat.create({ name: 'race', age: 0 });
        const N = 1000;
        await Promise.all(
          Array.from({ length: N }, () =>
            connector.deltaUpdate!({
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

    describe('upsert / upsertAll', () => {
      const upsertTable = 'conformance_upsert';
      let TagModel: any;

      beforeEach(async () => {
        if (await connector.hasTable(upsertTable)) await connector.dropTable(upsertTable);
        await connector.createTable(upsertTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('slug', { unique: true });
          t.string('name');
        });
        TagModel = class extends (
          Model({
            tableName: upsertTable,
            connector,
            timestamps: false,
          })
        ) {};
      });

      it('inserts a fresh row when no conflict', async () => {
        const row = await TagModel.upsert(
          { slug: 'js', name: 'JavaScript' },
          { onConflict: 'slug' },
        );
        expect(row.id).toBeDefined();
        expect(row.name).toBe('JavaScript');
        expect(await TagModel.count()).toBe(1);
      });

      it('updates an existing row on conflict', async () => {
        const original = await TagModel.create({ slug: 'js', name: 'JS' });
        const row = await TagModel.upsert(
          { slug: 'js', name: 'JavaScript' },
          { onConflict: 'slug' },
        );
        expect(row.id).toBe(original.id);
        expect(row.name).toBe('JavaScript');
        expect(await TagModel.count()).toBe(1);
      });

      it('respects ignoreOnly — keeps existing row unchanged', async () => {
        const original = await TagModel.create({ slug: 'js', name: 'JS' });
        const row = await TagModel.upsert(
          { slug: 'js', name: 'OVERWRITTEN' },
          { onConflict: 'slug', ignoreOnly: true },
        );
        expect(row.id).toBe(original.id);
        expect(row.name).toBe('JS');
      });

      it('respects updateColumns — only listed columns get overwritten', async () => {
        await TagModel.create({ slug: 'js', name: 'JS' });
        const row = await TagModel.upsert(
          { slug: 'js', name: 'JavaScript' },
          { onConflict: 'slug', updateColumns: [] },
        );
        expect(row.name).toBe('JS');
      });

      it('upsertAll partitions inserts and updates and preserves input order', async () => {
        await TagModel.create({ slug: 'js', name: 'JS' });
        await TagModel.create({ slug: 'py', name: 'PY' });
        const rows = await TagModel.upsertAll(
          [
            { slug: 'js', name: 'JavaScript' },
            { slug: 'rb', name: 'Ruby' },
            { slug: 'py', name: 'Python' },
          ],
          { onConflict: 'slug' },
        );
        expect(rows.map((r: any) => r.attributes.name)).toEqual(['JavaScript', 'Ruby', 'Python']);
        expect(await TagModel.count()).toBe(3);
      });

      it('upsertAll handles a 100-row mixed batch in one call', async () => {
        await TagModel.createMany(
          Array.from({ length: 50 }, (_, i) => ({ slug: `s-${i}`, name: `old-${i}` })),
        );
        const input = Array.from({ length: 100 }, (_, i) => ({
          slug: `s-${i}`,
          name: `new-${i}`,
        }));
        const rows = await TagModel.upsertAll(input, { onConflict: 'slug' });
        expect(rows).toHaveLength(100);
        expect(rows[0].attributes.name).toBe('new-0');
        expect(rows[99].attributes.name).toBe('new-99');
        expect(await TagModel.count()).toBe(100);
      });

      it('upsertAll returns [] for an empty list', async () => {
        const rows = await TagModel.upsertAll([], { onConflict: 'slug' });
        expect(rows).toEqual([]);
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
      let Doc: any;

      beforeEach(async () => {
        if (await connector.hasTable(tableName)) await connector.dropTable(tableName);
        await connector.createTable(tableName, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('label');
          t.timestamp('discardedAt', { null: true });
        });
        Doc = class extends (
          Model({
            tableName,
            connector,
            timestamps: false,
            softDelete: true,
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
          scopes: {
            adults: { $gte: { age: 3 } },
          },
        }) {
          static named(name: string) {
            return this.filterBy({ name });
          }
        }
        await Scoped.create({ name: 'kit', age: 1 });
        await Scoped.create({ name: 'mature', age: 5 });
        await Scoped.create({ name: 'mature', age: 7 });
        expect(await (Scoped as any).adults().count()).toBe(2);
        expect(await (Scoped as any).adults().named('mature').count()).toBe(2);
      });
    });

    describe('Associations', () => {
      const postsTable = 'conformance_posts';
      let Author: any;
      let Post: any;

      beforeEach(async () => {
        if (await connector.hasTable(postsTable)) await connector.dropTable(postsTable);
        await connector.createTable(postsTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('title');
          t.integer('authorId');
        });
        // KEEP: init transforms AuthorProps → CatProps (adds `age: 0` default)
        Author = class extends (
          Model({
            tableName,
            connector,
            timestamps: false,
            init: (props: { name: string }) => ({ ...props, age: 0 }),
          })
        ) {};
        Post = class extends (
          Model({
            tableName: postsTable,
            connector,
            timestamps: false,
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

    describe('JOIN capability (fast path + fallback parity)', () => {
      const parentTable = 'conformance_join_users';
      const childTable = 'conformance_join_posts';
      let User: any;
      let Post: any;

      beforeEach(async () => {
        for (const t of [parentTable, childTable]) {
          if (await connector.hasTable(t)) await connector.dropTable(t);
        }
        await connector.createTable(parentTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('name');
        });
        await connector.createTable(childTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('title');
          t.integer('userId');
          t.string('status');
        });
        Post = class extends (
          Model({
            tableName: childTable,
            connector,
            timestamps: false,
          })
        ) {};
        User = class extends (
          Model({
            tableName: parentTable,
            connector,
            timestamps: false,
          })
        ) {};
      });

      it('whereMissing returns parents with zero matching children', async () => {
        const alice = await User.create({ name: 'alice' });
        const bob = await User.create({ name: 'bob' });
        await User.create({ name: 'carol' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'draft' });
        await Post.create({ title: 'b1', userId: bob.id, status: 'draft' });
        const result = await User.whereMissing('posts').all();
        expect(result.map((u: any) => u.name).sort()).toEqual(['carol']);
      });

      it('whereMissing composes with filterBy and orderBy', async () => {
        const alice = await User.create({ name: 'alice' });
        await User.create({ name: 'bob' });
        await User.create({ name: 'carol' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'draft' });
        const result = await User.whereMissing('posts')
          .filterBy({ $like: { name: '%o%' } })
          .orderBy({ key: 'name' })
          .all();
        expect(result.map((u: any) => u.name)).toEqual(['bob', 'carol']);
      });

      it('joins(...) keeps parents with at least one matching child', async () => {
        const alice = await User.create({ name: 'alice' });
        await User.create({ name: 'bob' });
        await User.create({ name: 'carol' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'published' });
        const result = await User.joins('posts').all();
        expect(result.map((u: any) => u.name).sort()).toEqual(['alice']);
      });

      it('cross-association filterBy honours the registered associations', async () => {
        const alice = await User.create({ name: 'alice' });
        const bob = await User.create({ name: 'bob' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'published' });
        await Post.create({ title: 'b1', userId: bob.id, status: 'draft' });
        const result = await User.filterBy({
          posts: { status: 'published' },
        } as any).all();
        expect(result.map((u: any) => u.name).sort()).toEqual(['alice']);
      });

      it('includes with strategy: "auto" attaches children on every connector', async () => {
        const alice = await User.create({ name: 'alice' });
        const bob = await User.create({ name: 'bob' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'published' });
        await Post.create({ title: 'a2', userId: alice.id, status: 'draft' });
        await Post.create({ title: 'b1', userId: bob.id, status: 'published' });
        const result = await User.includes('posts', { strategy: 'auto' })
          .orderBy({ key: 'id' })
          .all();
        expect(result.map((u: any) => u.name)).toEqual(['alice', 'bob']);
        expect(result[0].posts.map((p: any) => p.title).sort()).toEqual(['a1', 'a2']);
        expect(result[1].posts.map((p: any) => p.title)).toEqual(['b1']);
      });

      it('whereMissing returns the same count via fast path or fallback', async () => {
        const alice = await User.create({ name: 'alice' });
        await User.create({ name: 'bob' });
        await User.create({ name: 'carol' });
        await Post.create({ title: 'a1', userId: alice.id, status: 'draft' });
        const count = await User.whereMissing('posts').count();
        expect(count).toBe(2);
      });
    });

    describe('Builder pipeline (parent-scope, subqueries, attributes)', () => {
      const usersTable = 'conformance_chain_users';
      const todosTable = 'conformance_chain_todos';
      const ordersTable = 'conformance_chain_orders';
      const orderItemsTable = 'conformance_chain_order_items';
      const customersTable = 'conformance_chain_customers';
      const addressesTable = 'conformance_chain_addresses';

      beforeEach(async () => {
        for (const t of [
          todosTable,
          orderItemsTable,
          ordersTable,
          customersTable,
          addressesTable,
          usersTable,
        ]) {
          if (await connector.hasTable(t)) await connector.dropTable(t);
        }
        await connector.createTable(addressesTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('city', { null: true });
        });
        await connector.createTable(customersTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('name', { null: true });
          t.integer('addressId', { null: true });
        });
        await connector.createTable(ordersTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.integer('total', { null: true });
          t.integer('customerId', { null: true });
        });
        await connector.createTable(orderItemsTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.integer('orderId', { null: true });
          t.integer('amount', { null: true });
        });
        await connector.createTable(usersTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.string('email', { null: true });
          t.string('role', { null: true });
          t.integer('active', { null: true });
        });
        await connector.createTable(todosTable, (t) => {
          t.integer('id', { primary: true, autoIncrement: true, null: false });
          t.integer('userId', { null: true });
          t.string('title', { null: true });
          t.string('ownerEmail', { null: true });
        });
      });

      it('parent-scope traversal: User.findBy({email}).todos returns the user todos', async () => {
        const Todo: any = class extends Model({
          tableName: todosTable,
          connector,
          timestamps: false,
        }) {};
        const User: any = class extends Model({
          tableName: usersTable,
          connector,
          timestamps: false,
        }) {};

        const user = await User.create({ email: 'a@b' });
        const other = await User.create({ email: 'c@d' });
        await Todo.create({ userId: user.id, title: 't1' });
        await Todo.create({ userId: user.id, title: 't2' });
        await Todo.create({ userId: other.id, title: 'other' });

        const todos = (await User.findBy({ email: 'a@b' }).todos) as any[];
        expect(todos).toHaveLength(2);
        expect(todos.map((t: any) => t.attributes.title).sort()).toEqual(['t1', 't2']);
      });

      it('multi-level traversal: Order.first().customer.address resolves through 2 belongsTo hops', async () => {
        const Address: any = class extends Model({
          tableName: addressesTable,
          connector,
          timestamps: false,
        }) {};
        const Customer: any = class extends Model({
          tableName: customersTable,
          connector,
          timestamps: false,
        }) {};
        const Order: any = class extends Model({
          tableName: ordersTable,
          connector,
          timestamps: false,
        }) {};

        const address = await Address.create({ city: 'Berlin' });
        const customer = await Customer.create({ name: 'Ada', addressId: address.id });
        await Order.create({ total: 100, customerId: customer.id });

        const resolved = await Order.first().customer.address;
        expect(resolved).toBeDefined();
        expect(resolved.attributes.city).toBe('Berlin');
      });

      it('Todo.filterBy({userId: User.filterBy({...})}) — subquery as filter value', async () => {
        const User: any = class extends Model({
          tableName: usersTable,
          connector,
          timestamps: false,
        }) {};
        const Todo: any = class extends Model({
          tableName: todosTable,
          connector,
          timestamps: false,
        }) {};

        const active = await User.create({ email: 'a@b', active: 1 });
        const inactive = await User.create({ email: 'c@d', active: 0 });
        await Todo.create({ userId: active.id, title: 'a1' });
        await Todo.create({ userId: active.id, title: 'a2' });
        await Todo.create({ userId: inactive.id, title: 'i1' });

        const todos = (await Todo.filterBy({
          userId: User.filterBy({ active: 1 }),
        })) as any[];
        expect(todos).toHaveLength(2);
        expect(todos.map((t: any) => t.attributes.title).sort()).toEqual(['a1', 'a2']);
      });

      it('Order.filterBy({total: {$gt: OrderItem.filterBy({...}).sum(amount)}}) — aggregate subquery', async () => {
        const Order: any = class extends Model({
          tableName: ordersTable,
          connector,
          timestamps: false,
        }) {};
        const OrderItem: any = class extends Model({
          tableName: orderItemsTable,
          connector,
          timestamps: false,
        }) {};

        await Order.create({ total: 10 });
        await Order.create({ total: 50 });
        await Order.create({ total: 100 });
        // sum of amounts on order 99: 15 + 25 = 40
        await OrderItem.create({ orderId: 99, amount: 15 });
        await OrderItem.create({ orderId: 99, amount: 25 });

        const orders = (await Order.filterBy({
          $gt: { total: OrderItem.filterBy({ orderId: 99 }).sum('amount') },
        } as any)) as any[];
        expect(
          orders.map((o: any) => o.attributes.total).sort((a: number, b: number) => a - b),
        ).toEqual([50, 100]);
      });

      it('Todo.filterBy({ownerEmail: User.filterBy({...}).pluck(email)}) — column subquery', async () => {
        const User: any = class extends Model({
          tableName: usersTable,
          connector,
          timestamps: false,
        }) {};
        const Todo: any = class extends Model({
          tableName: todosTable,
          connector,
          timestamps: false,
        }) {};

        await User.create({ email: 'admin@x', role: 'admin' });
        await User.create({ email: 'user@x', role: 'user' });
        await Todo.create({ title: 'a', ownerEmail: 'admin@x' });
        await Todo.create({ title: 'b', ownerEmail: 'user@x' });
        await Todo.create({ title: 'c', ownerEmail: 'ghost@x' });

        const todos = (await Todo.filterBy({
          ownerEmail: User.filterBy({ role: 'admin' }).pluck('email'),
        })) as any[];
        expect(todos.map((t: any) => t.attributes.title)).toEqual(['a']);
      });

      it('attributes getter on a resolved instance is a JSON-safe POJO', async () => {
        const Todo: any = class extends Model({
          tableName: todosTable,
          connector,
          timestamps: false,
        }) {};
        const User: any = class extends Model({
          tableName: usersTable,
          connector,
          timestamps: false,
        }) {};

        const user = await User.create({ email: 'a@b' });
        await Todo.create({ userId: user.id, title: 't1' });

        const fetched = (await User.first()) as any;
        expect(fetched).toBeDefined();
        const json = JSON.parse(JSON.stringify(fetched.attributes));
        // Persistent fields + key — not the `todos` association accessor
        expect(json.email).toBe('a@b');
        expect(json.id).toBe(user.id);
        expect(json.todos).toBeUndefined();
        // attributes is a getter (not a method)
        expect(typeof fetched.attributes).toBe('object');
        expect(fetched.attributes).not.toBeInstanceOf(Function);
      });
    });
  });
}
