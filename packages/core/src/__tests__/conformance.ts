import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Model } from '../Model.js';
import type { Connector } from '../types.js';

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
      });
    }

    describe('Schema DSL', () => {
      it('reports hasTable for existing table and false after drop', async () => {
        expect(await connector.hasTable(tableName)).toBe(true);
        await connector.dropTable(tableName);
        expect(await connector.hasTable(tableName)).toBe(false);
      });
    });
  });
}
