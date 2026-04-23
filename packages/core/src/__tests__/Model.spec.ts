import { context, it } from '.';
import {
  type Dict,
  type Filter,
  type KeyType,
  MemoryConnector,
  Model,
  type Order,
  type Storage,
} from '..';

describe('Model', () => {
  let storage: Storage = {};

  const tableName = 'foo';
  const init = () => ({});
  let skip: number | undefined;
  let limit: number | undefined;
  let filter: Filter<any> | undefined;
  let order: Order<any> | undefined;
  const connector = () => new MemoryConnector({ storage });
  let keys: Dict<KeyType> | undefined;

  const seed = [
    { id: 1, foo: 'bar', bar: 'baz' },
    { id: 2, foo: null, bar: 'baz' },
    { id: 3, foo: 'bar', bar: null },
  ];
  function withSeededData(tests: () => void) {
    context('with seeded data', {
      definitions: () =>
        (storage = {
          [tableName]: seed.map((row) => ({ ...row })),
        }),
      reset: () => (storage = {}),
      tests,
    });
  }

  function itReturnsClass(subject: () => any) {
    it('returns class', () => {
      const Model = subject();
      expect(typeof Model).toEqual('function');
      expect(typeof Model.prototype).toEqual('object');
    });
  }

  const attributesOf = (items: any[]) => items.map((item) => item.attributes() as Dict<any>);

  const CreateModel = () =>
    ///@ts-ignore
    Model({
      tableName,
      init,
      skip,
      limit,
      filter,
      order,
      connector: connector(),
      keys,
    });

  const subject = CreateModel;

  itReturnsClass(subject);

  describe('filter parameter', () => {
    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('without filter', {
          definitions: () => (filter = undefined),
          reset: () => (filter = undefined),
          tests: () => {
            it('promises to return all matching items as model instances', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = undefined),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter((item) => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .filterBy({ bar: 'baz' } as Filter<any>)
                  .all();

              it('uses intersection of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter(
                  (item) => item.foo === 'bar' && item.bar === 'baz',
                );
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.filterBy', () => {
    let filter: Filter<any> = {};

    const subject = () => CreateModel().filterBy(filter);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().filterBy(filter).all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter((item) => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .filterBy(filter)
                  .filterBy({ bar: 'baz' } as Filter<any>)
                  .all();

              it('uses intersection of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter(
                  (item) => item.foo === 'bar' && item.bar === 'baz',
                );
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.orFilterBy', () => {
    let filter: Filter<any> = {};

    const subject = () => CreateModel().orFilterBy(filter);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().orFilterBy(filter).all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { id: 1 }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter((item) => item.id === 1);
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .orFilterBy(filter)
                  .orFilterBy({ id: 2 } as Filter<any>)
                  .all();

              it('uses union of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter((item) => item.id === 1 || item.id === 2);
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.unfiltered', () => {
    const subject = () => CreateModel().unfiltered();

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unfiltered().all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { id: 1 }),
          reset: () => (filter = {}),
          tests: () => {
            it('resets filter', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  describe('.limitBy', () => {
    let limit: number = Number.MAX_SAFE_INTEGER;

    const subject = () => CreateModel().limitBy(limit);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().limitBy(limit).all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter((item) => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            context('limit lower then expected count', {
              definitions: () => (limit = 1),
              reset: () => (limit = Number.MAX_SAFE_INTEGER),
              tests: () => {
                it('limits returned results', async () => {
                  const instances = await subject();
                  const expectedItems = seed.filter((item) => item.foo === 'bar').splice(0, 1);
                  expect(attributesOf(instances)).toEqual(expectedItems);
                });
              },
            });
          },
        });
      });
    });
  });

  describe('.unlimited', () => {
    const subject = () => CreateModel().unlimited();

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unlimited().all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with limit', {
          definitions: () => (limit = 1),
          reset: () => (limit = undefined),
          tests: () => {
            it('resets limit', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  describe('.skipBy', () => {
    let skip = 0;

    const subject = () => CreateModel().skipBy(skip);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().skipBy(skip).all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter((item) => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            context('skip lower then expected count', {
              definitions: () => (skip = 1),
              reset: () => (skip = 1),
              tests: () => {
                it('skips returned results', async () => {
                  const instances = await subject();
                  const expectedItems = seed.filter((item) => item.foo === 'bar').splice(1, 1);
                  expect(attributesOf(instances)).toEqual(expectedItems);
                });
              },
            });
          },
        });
      });
    });
  });

  describe('.unskipped', () => {
    const subject = () => CreateModel().unskipped();

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unskipped().all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with skip', {
          definitions: () => (skip = 1),
          reset: () => (skip = undefined),
          tests: () => {
            it('resets skip', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  describe('.findBy(filter)', () => {
    withSeededData(() => {
      it('returns the first matching record', async () => {
        const record = await CreateModel().findBy({ foo: 'bar' });
        expect(record?.attributes()).toEqual(seed[0]);
      });

      it('returns undefined when no record matches', async () => {
        const record = await CreateModel().findBy({ foo: 'nope' });
        expect(record).toBeUndefined();
      });

      context('when a class-level filter is already set', {
        definitions: () => (filter = { bar: 'baz' }),
        reset: () => (filter = undefined),
        tests: () => {
          it('combines the class-level filter with the argument filter', async () => {
            const record = await CreateModel().findBy({ foo: 'bar' });
            expect(record?.attributes()).toEqual(seed[0]);
          });

          it('returns undefined when the combination has no matches', async () => {
            const record = await CreateModel().findBy({ foo: null });
            expect(record?.attributes()).toEqual(seed[1]);
          });
        },
      });
    });
  });

  describe('.exists(filter?)', () => {
    withSeededData(() => {
      it('returns true when a matching record exists', async () => {
        expect(await CreateModel().exists({ foo: 'bar' })).toBe(true);
      });

      it('returns false when no record matches', async () => {
        expect(await CreateModel().exists({ foo: 'nope' })).toBe(false);
      });

      it('returns true for an empty filter when any record is present', async () => {
        expect(await CreateModel().exists()).toBe(true);
      });

      context('with an empty seed', {
        definitions: () => (storage = { [tableName]: [] }),
        reset: () => (storage = {}),
        tests: () => {
          it('returns false when no records are present', async () => {
            expect(await CreateModel().exists()).toBe(false);
          });
        },
      });
    });
  });

  describe('.deleteAll()', () => {
    withSeededData(() => {
      it('deletes all records in the current scope and returns them', async () => {
        const deleted = await CreateModel().deleteAll();
        expect(deleted).toHaveLength(seed.length);
        expect(await CreateModel().count()).toBe(0);
      });

      context('with a scope filter', {
        definitions: () => (filter = { foo: 'bar' }),
        reset: () => (filter = undefined),
        tests: () => {
          it('only deletes records matching the scope', async () => {
            const deleted = await CreateModel().deleteAll();
            expect(deleted).toHaveLength(2);
            filter = undefined;
            expect(await CreateModel().count()).toBe(1);
          });
        },
      });
    });
  });

  describe('#delete()', () => {
    withSeededData(() => {
      it('deletes the persisted record and clears keys on the instance', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        await record!.delete();
        expect(record!.isPersistent()).toBe(false);
        expect(await CreateModel().count()).toBe(seed.length - 1);
      });

      it('throws NotFoundError when the record was already deleted', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        await CreateModel().filterBy({ id: 1 }).deleteAll();
        await expect(record!.delete()).rejects.toBeInstanceOf(Error);
      });
    });

    it('throws PersistenceError when deleting an unsaved record', async () => {
      const record = CreateModel().build({});
      await expect(record.delete()).rejects.toBeInstanceOf(Error);
    });
  });

  describe('#isChanged()', () => {
    withSeededData(() => {
      it('returns false immediately after build', () => {
        const record = CreateModel().build({ foo: 'bar' });
        expect(record.isChanged()).toBe(false);
      });

      it('returns true after assigning on top of a built record', () => {
        const record = CreateModel().build({ foo: 'bar' });
        record.assign({ foo: 'changed' });
        expect(record.isChanged()).toBe(true);
      });

      it('returns false immediately after findBy', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        expect(record!.isChanged()).toBe(false);
      });

      it('returns true after assigning a different value', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed' });
        expect(record!.isChanged()).toBe(true);
      });

      it('returns false after assigning the same value back', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: record!.attributes().foo });
        expect(record!.isChanged()).toBe(false);
      });

      it('returns false after save clears changed props', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed' });
        await record!.save();
        expect(record!.isChanged()).toBe(false);
      });
    });
  });

  describe('#isChangedBy(key)', () => {
    withSeededData(() => {
      it('returns true for a changed key', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed' });
        expect(record!.isChangedBy('foo')).toBe(true);
      });

      it('returns false for an unchanged key', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed' });
        expect(record!.isChangedBy('bar')).toBe(false);
      });

      it('returns false for a key never present', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        expect(record!.isChangedBy('missing')).toBe(false);
      });
    });
  });

  describe('#changes()', () => {
    withSeededData(() => {
      it('returns empty object for an unchanged record', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        expect(record!.changes()).toEqual({});
      });

      it('returns from/to pairs for each changed key', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed', bar: 'updated' });
        expect(record!.changes()).toEqual({
          foo: { from: 'bar', to: 'changed' },
          bar: { from: 'baz', to: 'updated' },
        });
      });

      it('shows undefined for newly-assigned keys with no prior persistent value', () => {
        const record = CreateModel().build({ foo: 'bar' });
        record.assign({ newKey: 'value' });
        expect(record.changes()).toEqual({ newKey: { from: undefined, to: 'value' } });
      });
    });
  });

  describe('#revertChange(key)', () => {
    withSeededData(() => {
      it('removes the key from changes and returns the instance', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed', bar: 'updated' });
        const returned = record!.revertChange('foo');
        expect(returned).toBe(record);
        expect(record!.changes()).toEqual({ bar: { from: 'baz', to: 'updated' } });
      });

      it('is a no-op when the key was not changed', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed' });
        record!.revertChange('bar');
        expect(record!.changes()).toEqual({ foo: { from: 'bar', to: 'changed' } });
      });
    });
  });

  describe('#revertChanges()', () => {
    withSeededData(() => {
      it('clears all changes and returns the instance', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.assign({ foo: 'changed', bar: 'updated' });
        const returned = record!.revertChanges();
        expect(returned).toBe(record);
        expect(record!.changes()).toEqual({});
        expect(record!.isChanged()).toBe(false);
      });

      it('is a no-op when there are no changes', async () => {
        const record = await CreateModel().findBy({ id: 1 });
        record!.revertChanges();
        expect(record!.isChanged()).toBe(false);
      });
    });
  });

  describe('timestamps', () => {
    it('sets createdAt and updatedAt on insert by default', async () => {
      storage = {};
      const before = Date.now();
      const record = await CreateModel().create({ foo: 'bar' });
      const after = Date.now();
      const attrs = record.attributes();
      expect(attrs.createdAt).toBeInstanceOf(Date);
      expect(attrs.updatedAt).toBeInstanceOf(Date);
      expect(attrs.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(attrs.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(attrs.updatedAt).toEqual(attrs.createdAt);
      storage = {};
    });

    it('updates updatedAt but not createdAt on save after assign', async () => {
      storage = {};
      const record = await CreateModel().create({ foo: 'bar' });
      const created = record.attributes().createdAt;
      await new Promise((resolve) => setTimeout(resolve, 5));
      record.assign({ foo: 'changed' });
      await record.save();
      const attrs = record.attributes();
      expect(attrs.createdAt).toEqual(created);
      expect(attrs.updatedAt.getTime()).toBeGreaterThan(created.getTime());
      storage = {};
    });

    it('preserves user-supplied createdAt/updatedAt on insert', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const createdAt = new Date('2020-01-01');
      const updatedAt = new Date('2021-01-01');
      const record = await Klass.create({ foo: 'bar', createdAt, updatedAt });
      const attrs = record.attributes();
      expect(attrs.createdAt).toEqual(createdAt);
      expect(attrs.updatedAt).toEqual(updatedAt);
      storage = {};
    });

    it('does not write timestamps when opted out', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        timestamps: false,
      });
      const record = await Klass.create({ foo: 'bar' });
      const attrs = record.attributes();
      expect(attrs.createdAt).toBeUndefined();
      expect(attrs.updatedAt).toBeUndefined();
      storage = {};
    });

    it('does not bump updatedAt when opted out, even on update', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        timestamps: false,
      });
      const record = await Klass.create({ foo: 'bar' });
      record.assign({ foo: 'changed' });
      await record.save();
      const attrs = record.attributes();
      expect(attrs.updatedAt).toBeUndefined();
      storage = {};
    });
  });

  describe('validators', () => {
    it('isValid() returns true when no validators are defined', async () => {
      storage = {};
      const record = CreateModel().build({});
      expect(await record.isValid()).toBe(true);
      storage = {};
    });

    it('isValid() returns true when all validators pass', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [(instance: any) => instance.foo === 'bar'],
      });
      const record = Klass.build({ foo: 'bar' });
      expect(await record.isValid()).toBe(true);
      storage = {};
    });

    it('isValid() returns false when any validator fails', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [
          (instance: any) => instance.foo === 'bar',
          (instance: any) => instance.bar === 'baz',
        ],
      });
      const record = Klass.build({ foo: 'bar', bar: 'wrong' });
      expect(await record.isValid()).toBe(false);
      storage = {};
    });

    it('supports async validators', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [async (instance: any) => instance.foo === 'bar'],
      });
      const record = Klass.build({ foo: 'bar' });
      expect(await record.isValid()).toBe(true);
      storage = {};
    });

    it('save() throws ValidationError when invalid', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [() => false],
      });
      const record = Klass.build({ foo: 'bar' });
      await expect(record.save()).rejects.toBeInstanceOf(Error);
      expect(Object.keys(storage[tableName] ?? {})).toHaveLength(0);
      storage = {};
    });

    it('save() proceeds when valid', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [(instance: any) => instance.foo === 'bar'],
      });
      const record = await Klass.create({ foo: 'bar' });
      expect(record.isPersistent()).toBe(true);
      storage = {};
    });

    it('short-circuits on the first failing validator', async () => {
      storage = {};
      let secondCalled = false;
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        validators: [
          () => false,
          () => {
            secondCalled = true;
            return true;
          },
        ],
      });
      expect(await Klass.build({}).isValid()).toBe(false);
      expect(secondCalled).toBe(false);
      storage = {};
    });
  });

  describe('callbacks', () => {
    it('runs beforeSave, beforeCreate, afterCreate, afterSave on insert in order', async () => {
      storage = {};
      const order: string[] = [];
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeSave: [() => void order.push('beforeSave')],
          beforeCreate: [() => void order.push('beforeCreate')],
          beforeUpdate: [() => void order.push('beforeUpdate')],
          afterUpdate: [() => void order.push('afterUpdate')],
          afterCreate: [() => void order.push('afterCreate')],
          afterSave: [() => void order.push('afterSave')],
        },
      });
      await Klass.create({ foo: 'bar' });
      expect(order).toEqual(['beforeSave', 'beforeCreate', 'afterCreate', 'afterSave']);
      storage = {};
    });

    it('runs beforeSave, beforeUpdate, afterUpdate, afterSave on update in order', async () => {
      storage = {};
      const order: string[] = [];
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeSave: [() => void order.push('beforeSave')],
          beforeCreate: [() => void order.push('beforeCreate')],
          beforeUpdate: [() => void order.push('beforeUpdate')],
          afterUpdate: [() => void order.push('afterUpdate')],
          afterCreate: [() => void order.push('afterCreate')],
          afterSave: [() => void order.push('afterSave')],
        },
      });
      const record = await Klass.create({ foo: 'bar' });
      order.length = 0;
      record.assign({ foo: 'changed' });
      await record.save();
      expect(order).toEqual(['beforeSave', 'beforeUpdate', 'afterUpdate', 'afterSave']);
      storage = {};
    });

    it('runs beforeDelete then afterDelete around delete()', async () => {
      storage = {};
      const order: string[] = [];
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeDelete: [() => void order.push('beforeDelete')],
          afterDelete: [() => void order.push('afterDelete')],
        },
      });
      const record = await Klass.create({ foo: 'bar' });
      await record.delete();
      expect(order).toEqual(['beforeDelete', 'afterDelete']);
      storage = {};
    });

    it('awaits async callbacks', async () => {
      storage = {};
      const order: string[] = [];
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeSave: [
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              order.push('beforeSave');
            },
          ],
          afterSave: [() => void order.push('afterSave')],
        },
      });
      await Klass.create({ foo: 'bar' });
      expect(order).toEqual(['beforeSave', 'afterSave']);
      storage = {};
    });

    it('aborts save when a before-callback throws', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeCreate: [
            () => {
              throw new Error('nope');
            },
          ],
        },
      });
      await expect(Klass.create({ foo: 'bar' })).rejects.toBeInstanceOf(Error);
      expect(Object.keys(storage[tableName] ?? {})).toHaveLength(0);
      storage = {};
    });

    it('skips callbacks when no changes trigger a save()', async () => {
      storage = {};
      let calls = 0;
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
        callbacks: {
          beforeSave: [() => void calls++],
          afterSave: [() => void calls++],
        },
      });
      const record = await Klass.create({ foo: 'bar' });
      calls = 0;
      await record.save();
      expect(calls).toBe(2);
      storage = {};
    });
  });

  describe('transactions', () => {
    it('commits writes when the callback resolves', async () => {
      storage = {};
      const Klass = CreateModel();
      await Klass.transaction(async () => {
        await Klass.create({ foo: 'bar' });
        await Klass.create({ foo: 'baz' });
      });
      expect(await Klass.count()).toBe(2);
      storage = {};
    });

    it('rolls back writes when the callback throws', async () => {
      storage = {};
      const Klass = CreateModel();
      await Klass.create({ foo: 'before' });
      await expect(
        Klass.transaction(async () => {
          await Klass.create({ foo: 'inside' });
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(await Klass.count()).toBe(1);
      expect(await Klass.findBy({ foo: 'inside' })).toBeUndefined();
      storage = {};
    });

    it('rolls back updates and deletes on throw', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ foo: 'original' });
      await expect(
        Klass.transaction(async () => {
          record.assign({ foo: 'updated' });
          await record.save();
          const another = await Klass.create({ foo: 'new' });
          await another.delete();
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      const reloaded = await Klass.findBy({ id: record.attributes().id });
      expect(reloaded?.attributes().foo).toBe('original');
      expect(await Klass.count()).toBe(1);
      storage = {};
    });

    it('returns the callback return value on commit', async () => {
      storage = {};
      const Klass = CreateModel();
      const result = await Klass.transaction(async () => {
        await Klass.create({ foo: 'bar' });
        return 42;
      });
      expect(result).toBe(42);
      storage = {};
    });

    it('joins an outer transaction (nested throw rolls back both)', async () => {
      storage = {};
      const Klass = CreateModel();
      await expect(
        Klass.transaction(async () => {
          await Klass.create({ foo: 'outer' });
          await Klass.transaction(async () => {
            await Klass.create({ foo: 'inner' });
            throw new Error('inner-fail');
          });
        }),
      ).rejects.toThrow('inner-fail');
      expect(await Klass.count()).toBe(0);
      storage = {};
    });
  });

  describe('.find', () => {
    it('returns the record by primary key', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ foo: 'a' });
      const found = await Klass.find(record.attributes().id);
      expect(found.attributes().foo).toBe('a');
      storage = {};
    });

    it('throws NotFoundError when the record is absent', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await expect(Klass.find(999)).rejects.toThrow(/not found/);
      storage = {};
    });
  });

  describe('.findOrFail', () => {
    it('returns the matching record', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await Klass.create({ foo: 'match' });
      const found = await Klass.findOrFail({ foo: 'match' });
      expect(found.attributes().foo).toBe('match');
      storage = {};
    });

    it('throws when no record matches', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await expect(Klass.findOrFail({ foo: 'missing' })).rejects.toThrow('Record not found');
      storage = {};
    });
  });

  describe('.findOrBuild', () => {
    it('returns the existing record when found', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await Klass.create({ foo: 'a', bar: 1 });
      const record = await Klass.findOrBuild({ foo: 'a' }, { bar: 99 });
      expect(record.attributes().bar).toBe(1);
      expect(record.isNew()).toBe(false);
      storage = {};
    });

    it('builds an unsaved instance when not found', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.findOrBuild({ foo: 'missing' }, { bar: 42 });
      expect(record.attributes().foo).toBe('missing');
      expect(record.attributes().bar).toBe(42);
      expect(record.isNew()).toBe(true);
      expect(await Klass.count()).toBe(0);
      storage = {};
    });
  });

  describe('.firstOrCreate', () => {
    it('returns the existing record without writing', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await Klass.create({ foo: 'a' });
      const before = await Klass.count();
      const record = await Klass.firstOrCreate({ foo: 'a' }, { bar: 1 });
      expect(record.attributes().foo).toBe('a');
      expect(await Klass.count()).toBe(before);
      storage = {};
    });

    it('creates when no record matches', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.firstOrCreate({ foo: 'new' }, { bar: 42 });
      expect(record.attributes().foo).toBe('new');
      expect(record.attributes().bar).toBe(42);
      expect(record.isPersistent()).toBe(true);
      storage = {};
    });
  });

  describe('.updateOrCreate', () => {
    it('updates the existing record', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const original = await Klass.create({ foo: 'a', bar: 1 });
      const record = await Klass.updateOrCreate({ foo: 'a' }, { bar: 99 });
      expect(record.attributes().id).toBe(original.attributes().id);
      expect(record.attributes().bar).toBe(99);
      expect(await Klass.count()).toBe(1);
      storage = {};
    });

    it('creates when no record matches', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.updateOrCreate({ foo: 'new' }, { bar: 7 });
      expect(record.attributes().foo).toBe('new');
      expect(record.attributes().bar).toBe(7);
      expect(record.isPersistent()).toBe(true);
      storage = {};
    });
  });

  describe('#increment / #decrement', () => {
    it('increments the given field and persists', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ count: 5 });
      await record.increment('count');
      expect(record.attributes().count).toBe(6);
      const reloaded = (await Klass.findBy({ id: record.attributes().id }))!;
      expect(reloaded.attributes().count).toBe(6);
      storage = {};
    });

    it('accepts a custom step', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ count: 10 });
      await record.increment('count', 3);
      expect(record.attributes().count).toBe(13);
      storage = {};
    });

    it('decrements the field', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ count: 5 });
      await record.decrement('count', 2);
      expect(record.attributes().count).toBe(3);
      storage = {};
    });

    it('treats missing values as zero', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({});
      await record.increment('count');
      expect(record.attributes().count).toBe(1);
      storage = {};
    });

    it('throws when the record is unsaved', async () => {
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = Klass.build({ count: 1 });
      await expect(record.increment('count')).rejects.toThrow(
        'Cannot increment a record that has not been saved',
      );
    });
  });

  describe('#update', () => {
    it('assigns and saves in one call', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ foo: 'a' });
      const updated = await record.update({ foo: 'b' });
      expect(updated.attributes().foo).toBe('b');
      const reloaded = await Klass.findBy({ id: record.attributes().id });
      expect(reloaded?.attributes().foo).toBe('b');
      storage = {};
    });
  });

  describe('#reload', () => {
    it('replaces in-memory changes with persisted attributes', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ foo: 'original' });
      record.assign({ foo: 'dirty' });
      expect(record.isChanged()).toBe(true);
      await record.reload();
      expect(record.isChanged()).toBe(false);
      expect(record.attributes().foo).toBe('original');
      storage = {};
    });

    it('picks up changes made through other instances', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const a = await Klass.create({ foo: 'a' });
      const b = (await Klass.findBy({ id: a.attributes().id }))!;
      await a.update({ foo: 'changed' });
      await b.reload();
      expect(b.attributes().foo).toBe('changed');
      storage = {};
    });

    it('throws when the record is unsaved', async () => {
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = Klass.build({ foo: 'x' });
      await expect(record.reload()).rejects.toThrow(
        'Cannot reload a record that has not been saved',
      );
    });
  });

  describe('#touch', () => {
    it('bumps updatedAt without other changes', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = await Klass.create({ foo: 'a' });
      const originalUpdatedAt = record.attributes().updatedAt as Date;
      await new Promise((r) => setTimeout(r, 5));
      await record.touch();
      const newUpdatedAt = record.attributes().updatedAt as Date;
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(record.attributes().foo).toBe('a');
      storage = {};
    });

    it('throws when the record is unsaved', async () => {
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      const record = Klass.build({ foo: 'x' });
      await expect(record.touch()).rejects.toThrow('Cannot touch a record that has not been saved');
    });
  });

  describe('.updateAll', () => {
    it('updates all records in scope', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await Klass.create({ foo: 'a', group: 1 });
      await Klass.create({ foo: 'b', group: 1 });
      await Klass.create({ foo: 'c', group: 2 });
      await Klass.filterBy({ group: 1 }).updateAll({ foo: 'updated' });
      expect(await Klass.filterBy({ foo: 'updated' }).count()).toBe(2);
      expect(await Klass.filterBy({ foo: 'c' }).count()).toBe(1);
      storage = {};
    });

    it('auto-sets updatedAt when timestamps enabled', async () => {
      storage = {};
      const Klass = Model({
        tableName,
        init: (props: any) => props,
        connector: connector(),
      });
      await Klass.create({ foo: 'a' });
      await new Promise((r) => setTimeout(r, 5));
      const before = Date.now();
      await Klass.updateAll({ foo: 'b' });
      const after = Date.now();
      const row = (await Klass.first())!;
      const updatedAt = row.attributes().updatedAt as Date;
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after);
      storage = {};
    });
  });

  describe('associations', () => {
    let assocStorage: Storage = {};
    const assocConnector = () => new MemoryConnector({ storage: assocStorage });

    beforeEach(() => {
      assocStorage = {};
    });

    describe('#belongsTo', () => {
      it('returns the referenced record using tableName convention', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        const post = await PostKlass.create({ userId: user.id, title: 'Hello' });
        const author = await post.belongsTo(UserKlass);
        expect(author?.attributes().name).toBe('Alice');
      });

      it('returns undefined when the foreign key is null', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number | null; title: string }) => props,
          connector: assocConnector(),
        });
        const post = await PostKlass.create({ userId: null, title: 'Orphan' });
        const author = await post.belongsTo(UserKlass);
        expect(author).toBeUndefined();
      });

      it('returns undefined when the referenced record does not exist', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const post = await PostKlass.create({ userId: 999, title: 'Dangling' });
        const author = await post.belongsTo(UserKlass);
        expect(author).toBeUndefined();
      });

      it('accepts an explicit foreignKey', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { authorId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        const post = await PostKlass.create({ authorId: user.id, title: 'Hello' });
        const author = await post.belongsTo(UserKlass, { foreignKey: 'authorId' });
        expect(author?.attributes().name).toBe('Alice');
      });
    });

    describe('#hasMany', () => {
      it('returns a scoped query of related records', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        const other = await UserKlass.create({ name: 'Bob' });
        await PostKlass.create({ userId: user.id, title: 'A' });
        await PostKlass.create({ userId: user.id, title: 'B' });
        await PostKlass.create({ userId: other.id, title: 'C' });
        const userPosts = await user.hasMany(PostKlass).all();
        expect(userPosts).toHaveLength(2);
        expect(userPosts.map((p) => p.attributes().title).sort()).toEqual(['A', 'B']);
      });

      it('supports count on the scoped query', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        await PostKlass.create({ userId: user.id, title: 'A' });
        await PostKlass.create({ userId: user.id, title: 'B' });
        expect(await user.hasMany(PostKlass).count()).toBe(2);
      });

      it('supports further chained scopes on the returned class', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { userId: number; title: string; published: boolean }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        await PostKlass.create({ userId: user.id, title: 'A', published: true });
        await PostKlass.create({ userId: user.id, title: 'B', published: false });
        const published = await user.hasMany(PostKlass).filterBy({ published: true }).all();
        expect(published).toHaveLength(1);
        expect(published[0].attributes().title).toBe('A');
      });

      it('accepts an explicit foreignKey', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { authorId: number; title: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        await PostKlass.create({ authorId: user.id, title: 'A' });
        const posts = await user.hasMany(PostKlass, { foreignKey: 'authorId' }).all();
        expect(posts).toHaveLength(1);
      });
    });

    describe('#hasManyThrough', () => {
      it('returns target records linked via the join table', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { title: string }) => props,
          connector: assocConnector(),
        });
        const AuthorshipKlass = Model({
          tableName: 'authorships',
          init: (props: { userId: number; postId: number }) => props,
          connector: assocConnector(),
        });
        const alice = await UserKlass.create({ name: 'Alice' });
        const bob = await UserKlass.create({ name: 'Bob' });
        const postA = await PostKlass.create({ title: 'A' });
        const postB = await PostKlass.create({ title: 'B' });
        const postC = await PostKlass.create({ title: 'C' });
        await AuthorshipKlass.create({ userId: alice.id, postId: postA.id });
        await AuthorshipKlass.create({ userId: alice.id, postId: postB.id });
        await AuthorshipKlass.create({ userId: bob.id, postId: postC.id });

        const alicePosts = await alice.hasManyThrough(PostKlass, AuthorshipKlass).all();
        expect(alicePosts.map((p) => p.attributes().title).sort()).toEqual(['A', 'B']);
      });

      it('supports further chained scopes on the returned class', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { title: string; published: boolean }) => props,
          connector: assocConnector(),
        });
        const AuthorshipKlass = Model({
          tableName: 'authorships',
          init: (props: { userId: number; postId: number }) => props,
          connector: assocConnector(),
        });
        const alice = await UserKlass.create({ name: 'Alice' });
        const postA = await PostKlass.create({ title: 'A', published: true });
        const postB = await PostKlass.create({ title: 'B', published: false });
        await AuthorshipKlass.create({ userId: alice.id, postId: postA.id });
        await AuthorshipKlass.create({ userId: alice.id, postId: postB.id });

        const published = await alice
          .hasManyThrough(PostKlass, AuthorshipKlass)
          .filterBy({ published: true })
          .all();
        expect(published).toHaveLength(1);
        expect(published[0].attributes().title).toBe('A');
      });

      it('returns an empty result when no join rows match', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { title: string }) => props,
          connector: assocConnector(),
        });
        const AuthorshipKlass = Model({
          tableName: 'authorships',
          init: (props: { userId: number; postId: number }) => props,
          connector: assocConnector(),
        });
        const alice = await UserKlass.create({ name: 'Alice' });
        const posts = await alice.hasManyThrough(PostKlass, AuthorshipKlass).all();
        expect(posts).toHaveLength(0);
      });

      it('honours custom foreignKeys', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const PostKlass = Model({
          tableName: 'posts',
          init: (props: { title: string }) => props,
          connector: assocConnector(),
        });
        const AuthorshipKlass = Model({
          tableName: 'authorships',
          init: (props: { authorId: number; articleId: number }) => props,
          connector: assocConnector(),
        });
        const alice = await UserKlass.create({ name: 'Alice' });
        const postA = await PostKlass.create({ title: 'A' });
        await AuthorshipKlass.create({ authorId: alice.id, articleId: postA.id });
        const posts = await alice
          .hasManyThrough(PostKlass, AuthorshipKlass, {
            throughForeignKey: 'authorId',
            targetForeignKey: 'articleId',
          })
          .all();
        expect(posts.map((p) => p.attributes().title)).toEqual(['A']);
      });
    });

    describe('#hasOne', () => {
      it('returns the associated record', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const ProfileKlass = Model({
          tableName: 'profiles',
          init: (props: { userId: number; bio: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        await ProfileKlass.create({ userId: user.id, bio: 'hello' });
        const profile = await user.hasOne(ProfileKlass);
        expect(profile?.attributes().bio).toBe('hello');
      });

      it('returns undefined when no related record exists', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const ProfileKlass = Model({
          tableName: 'profiles',
          init: (props: { userId: number; bio: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        const profile = await user.hasOne(ProfileKlass);
        expect(profile).toBeUndefined();
      });

      it('accepts an explicit foreignKey', async () => {
        const UserKlass = Model({
          tableName: 'users',
          init: (props: { name: string }) => props,
          connector: assocConnector(),
        });
        const ProfileKlass = Model({
          tableName: 'profiles',
          init: (props: { ownerId: number; bio: string }) => props,
          connector: assocConnector(),
        });
        const user = await UserKlass.create({ name: 'Alice' });
        await ProfileKlass.create({ ownerId: user.id, bio: 'hi' });
        const profile = await user.hasOne(ProfileKlass, { foreignKey: 'ownerId' });
        expect(profile?.attributes().bio).toBe('hi');
      });
    });
  });

  // describe('.order', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;

  //   const subject = () => Klass.order;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array by default', () => {
  //         expect(subject()).toEqual([]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the name of the model', () => {
  //             expect(subject()).toEqual(order);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.keys', () => {
  //   let Klass: typeof Model;
  //   let schema: Schema<any> = Faker.schema;

  //   const subject = () => Klass.keys;

  //   context('schema is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('throws Error', () => {
  //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
  //       });

  //       context('when schema is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get schema(): Schema<any> {
  //               return schema;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the schema keys of the model', () => {
  //             expect(subject()).toEqual(Object.keys(schema));
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Relations
  // pending('.relations');

  // describe('.validators', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let validators: Validator<any>[] = Faker.validators;

  //   const subject = () => Klass.validators;

  //   it('returns empty validators', () => {
  //     expect(subject()).toEqual([]);
  //   });

  //   context('when validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return validators;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns the validators of the model', () => {
  //         expect(subject()).toEqual(validators);
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Strict
  // describe('.strictSchema', () => {
  //   let Klass: typeof Model;
  //   let schema: Schema<any> = Faker.schema;

  //   const subject = () => Klass.strictSchema;

  //   context('schema is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('throws Error', () => {
  //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
  //       });

  //       context('when schema is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get schema(): Schema<any> {
  //               return schema;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the schema with filled properties', () => {
  //             expect(subject()).toEqual(schema);
  //             for (const key in schema) {
  //               expect('defaultValue' in subject()[key]).toBeTruthy();
  //             }
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // pending('.strictRelations');

  // describe('.strictFilter', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.strictFilter;

  //   it('returns empty filter', () => {
  //     expect(subject()).toEqual({});
  //   });

  //   context('when filter is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get filter(): Filter<any> {
  //           return filter;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns the strict filter of the model', () => {
  //         expect(subject()).toEqual(filter);
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Queries
  // describe('.limitBy(amount)', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let limit: number = Faker.limit;

  //   const subject = () => Klass.limitBy(limit);

  //   it('changes limit for new scope and keeps old scope unchanged', () => {
  //     expect(subject().limit).toEqual(limit);
  //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
  //   });
  // });

  // describe('.unlimited', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let limit: number = Faker.limit;

  //   const subject = () => Klass.unlimited;

  //   it('changes limit to default', () => {
  //     expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
  //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
  //   });

  //   context('when limit is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get limit(): number {
  //           return limit;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('changes limit for new scope and keeps old scope unchanged', () => {
  //         expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
  //         expect(Klass.limit).toEqual(limit);
  //       });
  //     },
  //   });
  // });

  // describe('.skipBy(amount)', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let skip: number = Faker.skip;

  //   const subject = () => Klass.skipBy(skip);

  //   it('changes skip for new scope and keeps old scope unchanged', () => {
  //     expect(subject().skip).toEqual(skip);
  //     expect(Klass.skip).toEqual(0);
  //   });
  // });

  // describe('.unskipped', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let skip: number = Faker.skip;

  //   const subject = () => Klass.unskipped;

  //   it('changes skip to default', () => {
  //     expect(subject().skip).toEqual(0);
  //     expect(Klass.skip).toEqual(0);
  //   });

  //   context('when skip is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get skip(): number {
  //           return skip;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('changes skip for new scope and keeps old scope unchanged', () => {
  //         expect(subject().skip).toEqual(0);
  //         expect(Klass.skip).toEqual(skip);
  //       });
  //     },
  //   });
  // });

  // describe('.orderBy(order)', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;
  //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

  //   const subject = () => Klass.orderBy(orderItem);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns order item as array', () => {
  //         expect(subject().order).toEqual([orderItem]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds order item to existing order', () => {
  //             expect(subject().order).toEqual([...order, orderItem]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.reorder(order)', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;
  //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

  //   const subject = () => Klass.reorder(orderItem);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns order item as array', () => {
  //         expect(subject().order).toEqual([orderItem]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('removes current order and returns order item as array', () => {
  //             expect(subject().order).toEqual([orderItem]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.unordered', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;

  //   const subject = () => Klass.unordered;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty order', () => {
  //         expect(subject().order).toEqual([]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns empty order', () => {
  //             expect(subject().order).toEqual([]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.query(filter)', () => {
  //   let Klass: typeof Model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.query(filter);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual(filter);
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds filter to existing filter and returns model', () => {
  //             expect(subject().filter).toEqual({ $and: [
  //               filter,
  //               { id: 1 },
  //             ]});
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.onlyQuery(filter)', () => {
  //   let Klass: typeof Model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.onlyQuery(filter);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual(filter);
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter and returns model', () => {
  //             expect(subject().filter).toEqual(filter);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.queryBy', () => {
  //   let Klass: typeof Model;
  //   let ids: number | number[] = 2;

  //   const subject = () => Klass.queryBy.id(ids);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual({ id: 2 });
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends Klass {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds filter to existing filter and returns model', () => {
  //             expect(subject().filter).toEqual({
  //               $and: [
  //                 { id: 2 },
  //                 { id: 1 },
  //               ]
  //             });
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when passing array of values', {
  //     definitions() {
  //       ids = [1, 2]
  //     },
  //     tests() {
  //       context('model is not extended', {
  //         definitions() {
  //           class NewKlass extends Faker.model { };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter and returns model', () => {
  //             expect(subject().filter).toEqual({ $in: { id: [1, 2] } });
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 1 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('adds filter to existing filter and returns model', () => {
  //                 expect(subject().filter).toEqual({
  //                   $and: [
  //                     { $in: { id: [1, 2] } },
  //                     { id: 1 },
  //                   ]
  //                 });
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.unfiltered', () => {
  //   let Klass: typeof Model;

  //   const subject = () => Klass.unfiltered;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter to empty and returns model', () => {
  //         expect(subject().filter).toEqual({});
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter to empty and returns model', () => {
  //             expect(subject().filter).toEqual({});
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.all', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.all;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const data = await subject();
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const data = await subject();
  //             const attrArr = data.map(instance => instance.attributes);
  //             expect(attrArr).toEqual([instance.attributes]);
  //             expect(data[0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const data = await subject();
  //                 expect(data).toEqual([]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // pending('.pluck');

  // pending('.select');

  // describe('.updateAll(attrs)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   const attrs = { test: 1 };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.updateAll(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get schema() {
  //           const schema = super.schema;
  //           schema.test = { type: DataType.string };
  //           return schema;
  //         }

  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const model = await subject();
  //         const data = await model.all;
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const model = await subject();
  //             const data = await model.all;
  //             const attrArr = data.map(instance => instance.attributes);
  //             const attributes = instance.attributes;
  //             attributes.test = 1;
  //             expect(attrArr).toEqual([attributes]);
  //             expect(data[0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const model = await subject();
  //                 const data = await model.all;
  //                 expect(data).toEqual([]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.deleteAll()', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.deleteAll();

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const model = await subject();
  //         const data = await model.all;
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const model = await subject();
  //             const data = await model.all;
  //             expect(data).toEqual([]);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const model = await subject();
  //                 const data = await model.all;
  //                 expect(data).toEqual([]);
  //                 const allData = await Klass.unfiltered.all;
  //                 expect(allData.map(instance => instance.attributes))
  //                   .toEqual([instance.attributes]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.inBatchesOf(amount)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let amount = 1;

  //   const subject = () => Klass.inBatchesOf(amount);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const dataPromises = await subject();
  //         const datas = await Promise.all(dataPromises);
  //         expect(datas).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const dataPromises = await subject();
  //             const datas = await Promise.all(dataPromises);
  //             expect(datas.length).toEqual(1);
  //             const attrArr = datas[0].map(instance => instance.attributes);
  //             expect(attrArr).toEqual([instance1.attributes]);
  //             expect(datas[0][0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const dataPromises = await subject();
  //                 const datas = await Promise.all(dataPromises);
  //                 expect(datas).toEqual([]);
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const dataPromises = await subject();
  //                 const datas = await Promise.all(dataPromises);
  //                 expect(datas.length).toEqual(2);
  //                 const attrArr1 = datas[0].map(instance => instance.attributes);
  //                 expect(attrArr1).toEqual([instance1.attributes]);
  //                 const attrArr2 = datas[1].map(instance => instance.attributes);
  //                 expect(attrArr2).toEqual([instance2.attributes]);
  //                 expect(datas[0][0]).toBeInstanceOf(Klass);
  //                 expect(datas[1][0]).toBeInstanceOf(Klass);
  //               });

  //               context('when amount is 2', {
  //                 definitions() {
  //                   amount = 2;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const dataPromises = await subject();
  //                     const datas = await Promise.all(dataPromises);
  //                     expect(datas.length).toEqual(1);
  //                     expect(datas[0].length).toEqual(2);
  //                     const attrArr = datas[0].map(instance => instance.attributes);
  //                     expect(attrArr).toEqual([
  //                       instance1.attributes,
  //                       instance2.attributes,
  //                     ]);
  //                     expect(datas[0][0]).toBeInstanceOf(Klass);
  //                     expect(datas[0][1]).toBeInstanceOf(Klass);
  //                   });
  //                 },
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const dataPromises = await subject();
  //                     const datas = await Promise.all(dataPromises);
  //                     expect(datas).toEqual([]);
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.first', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;

  //   const subject = () => Klass.first;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });
  //             },
  //           });

  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.find(query)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let query = {};

  //   const subject = () => Klass.find(query);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when non matching filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });

  //               context('when matching filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: instance2.id };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance.attributes).toEqual(instance2.attributes);
  //                     expect(instance).toBeInstanceOf(Klass);
  //                   });

  //                   context('when query is present', {
  //                     definitions() {
  //                       query = { id: 0 };
  //                     },
  //                     tests() {
  //                       it('filters data', async () => {
  //                         const instance = await subject();
  //                         expect(instance).toBeUndefined();
  //                       });
  //                     },
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.findBy', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let query = () => instance1 ? instance1.id : 0;

  //   const subject = () => Klass.findBy.id(query());

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: instance2.id };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.count', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.count;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const count = await subject();
  //         expect(count).toEqual(0);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const count = await subject();
  //             expect(count).toEqual(1);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const count = await subject();
  //                 expect(count).toEqual(0);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Creating Instances
  // describe('.new(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => new Klass(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {};
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', () => {
  //         const instance = subject();
  //         expect(instance.attributes).toEqual(attrs);
  //         expect(instance).toBeInstanceOf(Klass);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { id: 1 };
  //         },
  //         tests() {
  //           it('sets attributes', () => {
  //             const instance = subject();
  //             expect(instance.attributes).toEqual(attrs);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.build(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => Klass.build(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', () => {
  //         const instance = subject();
  //         expect(instance.attributes).toEqual(attrs);
  //         expect(instance).toBeInstanceOf(Klass);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { id: 1 };
  //         },
  //         tests() {
  //           it('sets attributes', () => {
  //             const instance = subject();
  //             expect(instance.attributes).toEqual(attrs);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.create(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => Klass.create(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', async () => {
  //         const instance = await subject();
  //         expect(instance.id).toBeDefined()
  //         expect(instance).toBeInstanceOf(Klass);
  //         expect(await Klass.count).toEqual(1);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { [Object.keys(Klass.schema)[0]]: 'foo' };
  //         },
  //         tests() {
  //           it('sets attributes', async () => {
  //             const instance = await subject();
  //             const key = Object.keys(Klass.schema)[0];
  //             expect(instance.attributes[key]).toEqual('foo');
  //             expect(instance).toBeInstanceOf(Klass);
  //             expect(await Klass.count).toEqual(1);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion
  // //#endregion

  // //#region Instance
  // //#region Properites
  // describe('#id', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.id;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeUndefined();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeDefined();
  //       });
  //     },
  //   });
  // });

  // describe('#model', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.model;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns model of instance', async () => {
  //         expect(subject()).toBe(Klass);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns model of instance', async () => {
  //         expect(subject()).toBe(Klass);
  //       });
  //     },
  //   });
  // });

  // describe('#attributes', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.attributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#persistentAttributes', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.persistentAttributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#isNew', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isNew;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#isPersistent', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isPersistent;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });
  // });

  // describe('#isChanged', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isChanged;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#isValid', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let trueValidator: Validator<any> = (instance) => Promise.resolve(true);
  //   let falseValidator: Validator<any> = (instance) => Promise.resolve(false);
  //   const subject = () => Klass.build({}).isValid;

  //   it('returns true', async () => {
  //     expect(await subject()).toBeTruthy();
  //   });

  //   context('when true validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [trueValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns true', async () => {
  //         expect(await subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when false validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [falseValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns false', async () => {
  //         expect(await subject()).toBeFalsy();
  //       });
  //     },
  //   });

  //   context('when mixed validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [trueValidator, falseValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns false', async () => {
  //         expect(await subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#changes', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({
  //           foo: {
  //             from: undefined,
  //             to: 'bar',
  //           },
  //         });
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Manipulation
  // describe('#assign(attrs)', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.assign(attrs).attributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#revertChange(key)', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.revertChange(key).changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });

  //       context('when key is not changed', {
  //         definitions() {
  //           key = 'bar';
  //         },
  //         tests() {
  //           it('returns attributes of instance', async () => {
  //             expect(subject()).toEqual({
  //               foo: {
  //                 from: undefined,
  //                 to: 'bar',
  //               },
  //             });
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });

  // describe('#revertChanges()', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.revertChanges().changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Storage
  // describe('#save()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.save();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('saves instance', async () => {
  //         expect(await Klass.all).toEqual([]);
  //         expect(instance.isNew).toBeTruthy();
  //         expect((await subject()).isNew).toBeFalsy();
  //         const data = (await Klass.all).map(instance => instance.attributes);
  //         expect(data).toEqual([instance.attributes]);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('saves changes', async () => {
  //         const count = await Klass.count;
  //         const keys = Object.keys(Klass.schema);
  //         instance.assign({
  //           [keys[0]]: 'foo',
  //           [keys[1]]: 'bar',
  //         });
  //         expect(instance.isChanged).toBeTruthy();
  //         expect((await subject()).isChanged).toBeFalsy();
  //         expect(await Klass.count).toEqual(count);
  //       });
  //     },
  //   });
  // });

  // describe('#delete()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.delete();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns error', () => {
  //         return expect(subject()).rejects.toEqual('[TODO] Cant find error');
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('deletes instance', async () => {
  //         const count = await Klass.count;
  //         const deletedInstance = await subject();
  //         expect(deletedInstance).toBeInstanceOf(Klass);
  //         expect(deletedInstance.attributes).toEqual(instance.attributes);
  //         expect(await Klass.count).toEqual(count - 1);
  //       });
  //     },
  //   });
  // });

  // describe('#reload()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.reload();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns error', async () => {
  //         expect(await subject()).toBeUndefined();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('reloads from storage', async () => {
  //         const keys = Object.keys(Klass.schema).filter(key => key !== 'id');
  //         const attributes = instance.attributes;
  //         instance.assign({
  //           [keys[0]]: 'foo',
  //         });
  //         expect(instance.isChanged).toBeTruthy();
  //         const reloadedInstance = await subject();
  //         expect(reloadedInstance.isChanged).toBeFalsy();
  //         expect(reloadedInstance.attributes).toEqual(attributes);
  //       });
  //     },
  //   });
  // });
  // //#endregion
  // //#endregion
});
