import {
  clone,
  type Dict,
  type Filter,
  FilterError,
  MemoryConnector,
  type Storage,
} from '../index.js';
import { KeyType, type OrderColumn, SortDirection } from '../types.js';
import { context, type FilterSpecGroup, it, randomInteger } from './index.js';

let storage: Storage = {};

const validId: number = randomInteger(1, 3);
const invalidId: number = randomInteger(4, Number.MAX_SAFE_INTEGER);

const tableName = 'foo';
const withEmptySeed = () => (storage = { [tableName]: [] });
const withSingleSeed = () => (storage = { [tableName]: [{ id: validId }] });
const withMultiSeed = () =>
  (storage = {
    [tableName]: [
      { id: 1, foo: 'bar' },
      { id: 2, foo: null },
      { id: 3, foo: 'bar' },
    ],
  });

const idsOf = (items: Dict<any>[]) => items.map((item) => item.id);
const items = () => storage[tableName];
const connector = () => new MemoryConnector({ storage });

const filterSpecGroups: FilterSpecGroup = {
  none: [
    { filter: undefined, results: [1, 2, 3] }, // No filter
    { filter: {}, results: [1, 2, 3] }, // Empty filter
  ],
  property: [
    { filter: { id: validId }, results: [validId] },
    { filter: { id: 1, foo: 'bar' }, results: [1] },
    { filter: { id: 1, foo: 'baz' }, results: [] },
    { filter: { foo: 'bar' }, results: [1, 3] },
    { filter: { id: invalidId }, results: [] },
  ],
  $and: [
    { filter: { $and: [] }, results: [1, 2, 3] },
    { filter: { $and: [{ id: validId }] }, results: [validId] },
    { filter: { $and: [{ id: 2 }, { id: 3 }] }, results: [] },
    { filter: { $and: [{ id: 2 }, { id: 2 }] }, results: [2] },
  ],
  $not: [
    { filter: { $not: {} }, results: [] },
    { filter: { $not: { id: 2 } }, results: [1, 3] },
    { filter: { $not: { id: invalidId } }, results: [1, 2, 3] },
  ],
  $or: [
    { filter: { $or: [] }, results: [] },
    { filter: { $or: [{ id: validId }] }, results: [validId] },
    { filter: { $or: [{ id: 2 }, { id: 3 }] }, results: [2, 3] },
    { filter: { $or: [{ id: 2 }, { id: 2 }] }, results: [2] },
  ],
  $in: [
    { filter: { $in: {} }, results: FilterError },
    { filter: { $in: { id: [validId] } }, results: [validId] },
    { filter: { $in: { id: [2, 3] } }, results: [2, 3] },
    { filter: { $in: { id: [2, 2] } }, results: [2] },
    { filter: { $in: { id: [1], foo: ['bar'] } }, results: FilterError },
  ],
  $notIn: [
    { filter: { $notIn: {} }, results: FilterError },
    { filter: { $notIn: { id: [2] } }, results: [1, 3] },
    { filter: { $notIn: { id: [2, 3] } }, results: [1] },
    { filter: { $notIn: { id: [2, 2] } }, results: [1, 3] },
    { filter: { $notIn: { id: [1], foo: ['bar'] } }, results: FilterError },
  ],
  $null: [
    { filter: { $null: 'foo' }, results: [2] },
    { filter: { $null: 'id' }, results: [] },
    { filter: { $null: 'bar' }, results: [1, 2, 3] },
  ],
  $notNull: [
    { filter: { $notNull: 'foo' }, results: [1, 3] },
    { filter: { $notNull: 'id' }, results: [1, 2, 3] },
    { filter: { $notNull: 'bar' }, results: [] },
  ],
  $between: [
    { filter: { $between: {} }, results: FilterError },
    { filter: { $between: { id: { from: 1, to: 2 } } }, results: [1, 2] },
    { filter: { $between: { foo: { from: 'a', to: 'z' } } }, results: [1, 3] },
    { filter: { $between: { id: { from: 0, to: 1 } } }, results: [1] },
    { filter: { $between: { id: { from: 3, to: 4 } } }, results: [3] },
    { filter: { $between: { id: { from: validId, to: validId } } }, results: [validId] },
    { filter: { $between: { id: { from: 4, to: 5 } } }, results: [] },
    { filter: { $between: { id: { from: 3, to: 1 } } }, results: [] },
    {
      filter: { $between: { id: { from: 1, to: 3 }, foo: { from: 'a', to: 'z' } } },
      results: FilterError,
    },
  ],
  $notBetween: [
    { filter: { $notBetween: {} }, results: FilterError },
    { filter: { $notBetween: { id: { from: 1, to: 2 } } }, results: [3] },
    { filter: { $notBetween: { foo: { from: 'a', to: 'z' } } }, results: [] },
    { filter: { $notBetween: { id: { from: 0, to: 1 } } }, results: [2, 3] },
    { filter: { $notBetween: { id: { from: 3, to: 4 } } }, results: [1, 2] },
    {
      filter: { $notBetween: { id: { from: validId, to: validId } } },
      results: [1, 2, 3].filter((id) => id !== validId),
    },
    { filter: { $notBetween: { id: { from: 4, to: 5 } } }, results: [1, 2, 3] },
    { filter: { $notBetween: { id: { from: 3, to: 1 } } }, results: [1, 2, 3] },
    {
      filter: { $notBetween: { id: { from: 1, to: 3 }, foo: { from: 'a', to: 'z' } } },
      results: FilterError,
    },
  ],
  $gt: [
    { filter: { $gt: {} }, results: FilterError },
    { filter: { $gt: { id: 2 } }, results: [3] },
    { filter: { $gt: { foo: 'bar' } }, results: [] },
    { filter: { $gt: { foo: 'a' } }, results: [1, 3] },
    { filter: { $gt: { id: 0 } }, results: [1, 2, 3] },
    { filter: { $gt: { id: invalidId } }, results: [] },
    { filter: { $gt: { id: 1, foo: 'a' } }, results: FilterError },
  ],
  $gte: [
    { filter: { $gte: {} }, results: FilterError },
    { filter: { $gte: { id: 2 } }, results: [2, 3] },
    { filter: { $gte: { foo: 'z' } }, results: [] },
    { filter: { $gte: { foo: 'bar' } }, results: [1, 3] },
    { filter: { $gte: { foo: 'a' } }, results: [1, 3] },
    { filter: { $gte: { id: 0 } }, results: [1, 2, 3] },
    { filter: { $gte: { id: invalidId } }, results: [] },
    { filter: { $gte: { id: 1, foo: 'a' } }, results: FilterError },
  ],
  $lt: [
    { filter: { $lt: {} }, results: FilterError },
    { filter: { $lt: { id: 2 } }, results: [1] },
    { filter: { $lt: { foo: 'bar' } }, results: [] },
    { filter: { $lt: { foo: 'z' } }, results: [1, 3] },
    { filter: { $lt: { id: 4 } }, results: [1, 2, 3] },
    { filter: { $lt: { id: 0 } }, results: [] },
    { filter: { $lt: { id: 1, foo: 'a' } }, results: FilterError },
  ],
  $lte: [
    { filter: { $lte: {} }, results: FilterError },
    { filter: { $lte: { id: 2 } }, results: [1, 2] },
    { filter: { $lte: { foo: 'a' } }, results: [] },
    { filter: { $lte: { foo: 'bar' } }, results: [1, 3] },
    { filter: { $lte: { foo: 'z' } }, results: [1, 3] },
    { filter: { $lte: { id: 4 } }, results: [1, 2, 3] },
    { filter: { $lte: { id: 0 } }, results: [] },
    { filter: { $lte: { id: 1, foo: 'a' } }, results: FilterError },
  ],
};

for (const key in filterSpecGroups) {
  const groupName = `$async -> ${key}`;
  filterSpecGroups[groupName] = [];
  filterSpecGroups[groupName].push(
    ...filterSpecGroups[key].map((spec) => ({
      filter: {
        $async: Promise.resolve(spec.filter),
      },
      results: spec.results,
    })),
  );
}

describe('Connector', () => {
  describe('#query(scope)', () => {
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined;
    let order: OrderColumn<any>[] | undefined;

    const scope = () => ({ tableName, skip, limit, filter, order });
    const subject = () => connector().query(scope());

    context('with empty prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return empty array', async () => {
          await expect(subject()).resolves.toEqual([]);
        });
      },
    });

    context('with single item prefilled storage', {
      definitions: withSingleSeed,
      tests() {
        it('promises to return matching items', async () => {
          const items = await subject();
          expect(items.length).toEqual(1);
          expect(items[0]).toEqual({ id: validId });
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions: withMultiSeed,
      tests() {
        context('single ascending order', {
          definitions: () => (order = [{ key: 'id', dir: SortDirection.Asc }]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([1, 2, 3]);
            });
          },
        });

        context('single descending order', {
          definitions: () => (order = [{ key: 'id', dir: SortDirection.Desc }]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([3, 2, 1]);
            });
          },
        });

        context('single ascending order on nullable field', {
          definitions: () => (order = [{ key: 'foo', dir: SortDirection.Asc }]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order with nulls last', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([1, 3, 2]);
            });
          },
        });

        context('single descending order on nullable field', {
          definitions: () => (order = [{ key: 'foo', dir: SortDirection.Desc }]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order with nulls first', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([2, 1, 3]);
            });
          },
        });

        context('multiple ascending order on nullable field', {
          definitions: () =>
            (order = [
              { key: 'foo', dir: SortDirection.Asc },
              { key: 'id', dir: SortDirection.Asc },
            ]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order with nulls last', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([1, 3, 2]);
            });
          },
        });

        context('multiple descending order on nullable field', {
          definitions: () =>
            (order = [
              { key: 'foo', dir: SortDirection.Desc },
              { key: 'id', dir: SortDirection.Desc },
            ]),
          reset: () => (order = undefined),
          tests() {
            it('promises to return matching items in defined order with nulls last', async () => {
              const items = await subject();
              expect(items.length).toEqual(3);
              expect(idsOf(items)).toEqual([2, 3, 1]);
            });
          },
        });

        for (const groupName in filterSpecGroups) {
          describe(`${groupName} filter`, () => {
            filterSpecGroups[groupName].forEach((filterSpec) => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions: () => (filter = filterSpec.filter),
                reset: () => (filter = undefined),
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    if (results.length === 0) {
                      it('promises to return empty array', async () => {
                        await expect(subject()).resolves.toEqual([]);
                      });
                    } else if (results.length === 3) {
                      it('promisesto return all items', async () => {
                        const items = await subject();
                        expect(items.length).toEqual(results.length);
                        expect(idsOf(items)).toEqual(results);
                      });
                    } else {
                      it('promises to return all matching items', async () => {
                        const items = await subject();
                        expect(items.length).toEqual(results.length);
                        expect(idsOf(items)).toEqual(results);
                      });
                    }

                    context('when skip is present', {
                      definitions: () => (skip = 1),
                      reset: () => (skip = undefined),
                      tests() {
                        it('promises to return all matching items', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(Math.max(0, results.length - 1));
                          expect(idsOf(items)).toEqual(results.slice(1));
                        });
                      },
                    });

                    context('when limit is present', {
                      definitions: () => (limit = 1),
                      reset: () => (limit = undefined),
                      tests() {
                        it('promises to return all matching items', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                          expect(idsOf(items)).toEqual(results.slice(0, 1));
                        });
                      },
                    });

                    context('when skip and limit is present', {
                      definitions: () => (skip = limit = 1),
                      reset: () => (skip = limit = undefined),
                      tests() {
                        it('promises to return all matching items', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                          expect(idsOf(items)).toEqual(results.slice(1, 2));
                        });
                      },
                    });
                  } else {
                    it('rejects filter and returns error', () => {
                      return expect(subject()).rejects.toBeInstanceOf(results);
                    });
                  }
                },
              });
            });
          });
        }
      },
    });
  });

  describe('#select(scope, ...keys)', () => {
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined;
    let keys: string[] = [];
    const scope = () => ({ tableName, skip, limit, filter });
    const subject = () => connector().select(scope(), ...keys);

    context('with empty prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return empty array', async () => {
          await expect(subject()).resolves.toEqual([]);
        });
      },
    });

    context('with single item prefilled storage', {
      definitions: withSingleSeed,
      tests() {
        it('promises to return all items with selected attributes', async () => {
          const items = await subject();
          expect(items.length).toEqual(1);
          expect(Object.keys(items[0]).length).toEqual(0);
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions: withMultiSeed,
      tests() {
        for (const groupName in filterSpecGroups) {
          describe(`${groupName} filter`, () => {
            filterSpecGroups[groupName].forEach((filterSpec) => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions: () => (filter = filterSpec.filter),
                reset: () => (filter = undefined),
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    if (results.length === 0) {
                      it('promises to return empty array', async () => {
                        await expect(subject()).resolves.toEqual([]);
                      });
                    } else if (results.length === 3) {
                      it('promises to return all items with selected attributes', async () => {
                        const items = await subject();
                        expect(items.length).toEqual(results.length);
                        expect(Object.keys(items[0]).length).toEqual(0);
                      });
                    } else {
                      it('promises to return all matching items with selected attributes', async () => {
                        const items = await subject();
                        expect(items.length).toEqual(results.length);
                        expect(Object.keys(items[0]).length).toEqual(0);
                      });
                    }

                    context('when skip is present', {
                      definitions: () => (skip = 1),
                      reset: () => (skip = undefined),
                      tests() {
                        it('promises to return all matching items with selected attributes', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(Math.max(0, results.length - 1));
                          if (results.length > 1) {
                            expect(Object.keys(items[0]).length).toEqual(0);
                          }
                        });
                      },
                    });

                    context('when limit is present', {
                      definitions: () => (limit = 1),
                      reset: () => (limit = undefined),
                      tests() {
                        it('promises to return all matching items with selected attributes', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                          if (results.length > 0) {
                            expect(Object.keys(items[0]).length).toEqual(0);
                          }
                        });
                      },
                    });

                    context('when skip and limit is present', {
                      definitions: () => (skip = limit = 1),
                      reset: () => (skip = limit = undefined),
                      tests() {
                        it('promises to return all matching items with selected attributes', async () => {
                          const items = await subject();
                          expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                          if (results.length > 1) {
                            expect(Object.keys(items[0]).length).toEqual(0);
                          }
                        });
                      },
                    });
                  } else {
                    it('rejects filter and returns error', () => {
                      return expect(subject()).rejects.toBeInstanceOf(results);
                    });
                  }
                },
              });
            });
          });
        }
      },
    });

    context('when keys contain single item', {
      definitions() {
        keys = ['id'];
      },
      tests() {
        context('with single item prefilled storage', {
          definitions: withSingleSeed,
          tests() {
            it('promises to return all items with selected attributes', async () => {
              const items = await subject();
              expect(items.length).toEqual(1);
              expect(Object.keys(items[0]).length).toEqual(1);
              expect(items[0]).toEqual({ id: validId });
            });
          },
        });

        context('with multiple items prefilled storage', {
          definitions: withMultiSeed,
          tests() {
            for (const groupName in filterSpecGroups) {
              describe(`${groupName} filter`, () => {
                filterSpecGroups[groupName].forEach((filterSpec) => {
                  context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                    definitions: () => (filter = filterSpec.filter),
                    reset: () => (filter = undefined),
                    tests() {
                      const results = filterSpec.results;
                      if (Array.isArray(results)) {
                        if (results.length === 0) {
                          it('promises to return empty array', async () => {
                            await expect(subject()).resolves.toEqual([]);
                          });
                        } else if (results.length === 3) {
                          it('promises to return all items with selected attributes', async () => {
                            const items = await subject();
                            expect(items.length).toEqual(results.length);
                            expect(Object.keys(items[0]).length).toEqual(1);
                            expect(idsOf(items)).toEqual(results);
                          });
                        } else {
                          it('promises to return all matching items with selected attributes', async () => {
                            const items = await subject();
                            expect(items.length).toEqual(results.length);
                            expect(Object.keys(items[0]).length).toEqual(1);
                            expect(idsOf(items)).toEqual(results);
                          });
                        }

                        context('when skip is present', {
                          definitions: () => (skip = 1),
                          reset: () => (skip = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(Math.max(0, results.length - 1));
                              if (results.length > 1) {
                                expect(Object.keys(items[0]).length).toEqual(1);
                              }
                              expect(idsOf(items)).toEqual(results.slice(1));
                            });
                          },
                        });

                        context('when limit is present', {
                          definitions: () => (limit = 1),
                          reset: () => (limit = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                              if (results.length > 0) {
                                expect(Object.keys(items[0]).length).toEqual(1);
                              }
                              expect(idsOf(items)).toEqual(results.slice(0, 1));
                            });
                          },
                        });

                        context('when skip and limit is present', {
                          definitions: () => (skip = limit = 1),
                          reset: () => (skip = limit = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                              if (results.length > 1) {
                                expect(Object.keys(items[0]).length).toEqual(1);
                              }
                              expect(idsOf(items)).toEqual(results.slice(1, 2));
                            });
                          },
                        });
                      } else {
                        it('rejects filter and returns error', () => {
                          return expect(subject()).rejects.toBeInstanceOf(results);
                        });
                      }
                    },
                  });
                });
              });
            }
          },
        });
      },
    });

    context('when keys contain multiple items', {
      definitions() {
        keys = ['id', 'foo'];
      },
      tests() {
        context('with single item prefilled storage', {
          definitions: withSingleSeed,
          tests() {
            it('promises to return all items with selected attributes', async () => {
              const items = await subject();
              expect(items.length).toEqual(1);
              expect(Object.keys(items[0]).length).toEqual(2);
              expect(items[0]).toEqual({ id: validId, foo: undefined });
            });
          },
        });

        context('with multiple items prefilled storage', {
          definitions: withMultiSeed,
          tests() {
            for (const groupName in filterSpecGroups) {
              describe(`${groupName} filter`, () => {
                filterSpecGroups[groupName].forEach((filterSpec) => {
                  context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                    definitions: () => (filter = filterSpec.filter),
                    reset: () => (filter = undefined),
                    tests() {
                      const results = filterSpec.results;
                      if (Array.isArray(results)) {
                        if (results.length === 0) {
                          it('promises to return empty array', async () => {
                            await expect(subject()).resolves.toEqual([]);
                          });
                        } else if (results.length === 3) {
                          it('promises to return all items with selected attributes', async () => {
                            const items = await subject();
                            expect(items.length).toEqual(results.length);
                            expect(Object.keys(items[0]).length).toEqual(2);
                            expect(idsOf(items)).toEqual(results);
                          });
                        } else {
                          it('promises to return all matching items with selected attributes', async () => {
                            const items = await subject();
                            expect(items.length).toEqual(results.length);
                            expect(Object.keys(items[0]).length).toEqual(2);
                            expect(idsOf(items)).toEqual(results);
                          });
                        }

                        context('when skip is present', {
                          definitions: () => (skip = 1),
                          reset: () => (skip = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(Math.max(0, results.length - 1));
                              if (results.length > 1) {
                                expect(Object.keys(items[0]).length).toEqual(2);
                              }
                              expect(idsOf(items)).toEqual(results.slice(1));
                            });
                          },
                        });

                        context('when limit is present', {
                          definitions: () => (limit = 1),
                          reset: () => (limit = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                              if (results.length > 0) {
                                expect(Object.keys(items[0]).length).toEqual(2);
                              }
                              expect(idsOf(items)).toEqual(results.slice(0, 1));
                            });
                          },
                        });

                        context('when skip and limit is present', {
                          definitions: () => (skip = limit = 1),
                          reset: () => (skip = limit = undefined),
                          tests() {
                            it('promises to return all matching items with selected attributes', async () => {
                              const items = await subject();
                              expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                              if (results.length > 1) {
                                expect(Object.keys(items[0]).length).toEqual(2);
                              }
                              expect(idsOf(items)).toEqual(results.slice(1, 2));
                            });
                          },
                        });
                      } else {
                        it('rejects filter and returns error', () => {
                          return expect(subject()).rejects.toBeInstanceOf(results);
                        });
                      }
                    },
                  });
                });
              });
            }
          },
        });
      },
    });
  });

  describe('#count(scope)', () => {
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined;
    const scope = () => ({ tableName, skip, limit, filter });
    const subject = () => connector().count(scope());

    context('with empty prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return a count of 0', async () => {
          await expect(subject()).resolves.toEqual(0);
        });
      },
    });

    context('with single item prefilled storage', {
      definitions: withSingleSeed,
      tests() {
        it('promises to return a count of 1', async () => {
          await expect(subject()).resolves.toEqual(1);
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions: withMultiSeed,
      tests() {
        for (const groupName in filterSpecGroups) {
          describe(`${groupName} filter`, () => {
            filterSpecGroups[groupName].forEach((filterSpec) => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions: () => (filter = filterSpec.filter),
                reset: () => (filter = undefined),
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    it(`promises to return a count of ${results.length}`, async () => {
                      await expect(subject()).resolves.toEqual(results.length);
                    });

                    context('when skip is present', {
                      definitions: () => (skip = 1),
                      reset: () => (skip = undefined),
                      tests() {
                        it('promises to return the count of all matching items', async () => {
                          await expect(subject()).resolves.toEqual(Math.max(0, results.length - 1));
                        });
                      },
                    });

                    context('when limit is present', {
                      definitions: () => (limit = 1),
                      reset: () => (limit = undefined),
                      tests() {
                        it('promises to return the count of all matching items', async () => {
                          await expect(subject()).resolves.toEqual(results.length > 0 ? 1 : 0);
                        });
                      },
                    });

                    context('when skip and limit is present', {
                      definitions: () => (skip = limit = 1),
                      reset: () => (skip = limit = undefined),
                      tests() {
                        it('promises to return the count of all matching items', async () => {
                          await expect(subject()).resolves.toEqual(results.length - 1 > 0 ? 1 : 0);
                        });
                      },
                    });
                  } else {
                    it('rejects filter and returns error', () => {
                      return expect(subject()).rejects.toBeInstanceOf(results);
                    });
                  }
                },
              });
            });
          });
        }
      },
    });
  });

  describe('#updateAll(scope, attrs)', () => {
    const attrs = {
      foo: 'baz',
    };
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined;
    const scope = () => ({ tableName, skip, limit, filter });
    const subject = () => connector().updateAll(scope(), attrs);

    context('with empty prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return empty array', async () => {
          await expect(subject()).resolves.toEqual([]);
        });
        it('does not change items in storage', async () => {
          const storageBeforeUpdate = clone(items());
          await subject();
          const storageAfterUpdate = items();
          expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
        });
      },
    });

    context('with single item prefilled storage', {
      definitions: withSingleSeed,
      tests() {
        it('promises to return updated items', async () => {
          await expect(subject()).resolves.toEqual([{ id: validId, ...attrs }]);
        });

        it('changes items in storage', async () => {
          const storageBeforeUpdate = clone(items());
          await subject();
          const storageAfterUpdate = items();
          expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
          expect(storageAfterUpdate).toEqual([{ id: validId, ...attrs }]);
        });

        context('when filter does not match any item', {
          definitions: () => (filter = { id: invalidId }),
          reset: () => (filter = undefined),
          tests() {
            it('promises to return empty array', async () => {
              await expect(subject()).resolves.toEqual([]);
            });
            it('does not change items in storage', async () => {
              const storageBeforeUpdate = clone(items());
              await subject();
              const storageAfterUpdate = items();
              expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
            });
          },
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions: withMultiSeed,
      tests() {
        for (const groupName in filterSpecGroups) {
          describe(`${groupName} filter`, () => {
            filterSpecGroups[groupName].forEach((filterSpec) => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions: () => (filter = filterSpec.filter),
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    const itUpdatesMatchingItems = (results: number[]) => {
                      it('promises to return updated records', async () => {
                        await expect(subject()).resolves.toEqual(
                          results.map((id) => ({ id, ...attrs })),
                        );
                      });
                      if (results.length === 0) {
                        it('does not change storage when scope has no matches', async () => {
                          const storageBeforeUpdate = clone(items());
                          await subject();
                          const storageAfterUpdate = items();
                          expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                        });
                      } else {
                        it('changes matching items in storage', async () => {
                          const storageBeforeUpdate = clone(items());
                          const changedStorage = items().map((item) =>
                            results.includes(item.id) ? { ...item, ...attrs } : item,
                          );
                          await subject();
                          const storageAfterUpdate = items();
                          expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                          expect(storageAfterUpdate).toEqual(changedStorage);
                        });
                      }
                    };

                    itUpdatesMatchingItems(results);

                    context('when skip is present', {
                      definitions: () => (skip = 1),
                      reset: () => (skip = undefined),
                      tests() {
                        itUpdatesMatchingItems(results.slice(1));
                      },
                    });

                    context('when limit is present', {
                      definitions: () => (limit = 1),
                      reset: () => (limit = undefined),
                      tests() {
                        itUpdatesMatchingItems(results.slice(0, 1));
                      },
                    });

                    context('when skip and limit is present', {
                      definitions: () => (skip = limit = 1),
                      reset: () => (skip = limit = undefined),
                      tests() {
                        itUpdatesMatchingItems(results.slice(1, 2));
                      },
                    });
                  } else {
                    it('rejects filter and returns error', () => {
                      return expect(subject()).rejects.toBeInstanceOf(results);
                    });
                  }
                },
              });
            });
          });
        }
      },
    });
  });

  describe('#deleteAll(scope)', () => {
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined;
    const scope = () => ({ tableName, skip, limit, filter });
    const subject = () => connector().deleteAll(scope());

    context('with empty prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return empty array', async () => {
          await expect(subject()).resolves.toEqual([]);
        });
        it('does not change items in storage', async () => {
          const storageBeforeUpdate = clone(items());
          await subject();
          const storageAfterUpdate = items();
          expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
        });
      },
    });

    context('with single item prefilled storage', {
      definitions: withSingleSeed,
      tests() {
        it('promises to return deleted items', async () => {
          const storageBeforeUpdate = clone(items());
          await expect(subject()).resolves.toEqual(storageBeforeUpdate);
        });

        it('deletes items in storage', async () => {
          const storageBeforeUpdate = clone(items());
          await subject();
          const storageAfterUpdate = items();
          expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
          expect(storageAfterUpdate).toEqual([]);
        });

        context('when filter does not match any item', {
          definitions: () => (filter = { id: invalidId }),
          reset: () => (filter = undefined),
          tests() {
            it('promises to return empty array', async () => {
              await expect(subject()).resolves.toEqual([]);
            });
            it('does not delete items in storage', async () => {
              const storageBeforeUpdate = clone(items());
              await subject();
              const storageAfterUpdate = items();
              expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
            });
          },
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions: withMultiSeed,
      tests() {
        for (const groupName in filterSpecGroups) {
          describe(`${groupName} filter`, () => {
            filterSpecGroups[groupName].forEach((filterSpec) => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions: () => (filter = filterSpec.filter),
                reset: () => (filter = undefined),
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    const itDeletesMatchingItems = (results: number[]) => {
                      it('promises to return deleted records', async () => {
                        const deletedItems = items().filter((item) => results.includes(item.id));
                        await expect(subject()).resolves.toEqual(deletedItems);
                      });
                      if (results.length === 0) {
                        it('does not change storage when scope has no matches', async () => {
                          const storageBeforeUpdate = clone(items());
                          await subject();
                          const storageAfterUpdate = items();
                          expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                        });
                      } else {
                        it('deletes matching items in storage', async () => {
                          const storageBeforeUpdate = clone(items());
                          const changedStorage = items().filter(
                            (item) => !results.includes(item.id),
                          );
                          await subject();
                          const storageAfterUpdate = items();
                          expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                          expect(storageAfterUpdate).toEqual(changedStorage);
                        });
                      }
                    };

                    itDeletesMatchingItems(results);

                    context('when skip is present', {
                      definitions: () => (skip = 1),
                      reset: () => (skip = undefined),
                      tests() {
                        itDeletesMatchingItems(results.slice(1));
                      },
                    });

                    context('when limit is present', {
                      definitions: () => (limit = 1),
                      reset: () => (limit = undefined),
                      tests() {
                        itDeletesMatchingItems(results.slice(0, 1));
                      },
                    });

                    context('when skip and limit is present', {
                      definitions: () => (skip = limit = 1),
                      reset: () => (skip = limit = undefined),
                      tests() {
                        itDeletesMatchingItems(results.slice(1, 2));
                      },
                    });
                  } else {
                    it('rejects filter and returns error', () => {
                      return expect(subject()).rejects.toBeInstanceOf(results);
                    });
                  }
                },
              });
            });
          });
        }
      },
    });
  });

  describe('#batchInsert(tableName, keys, items)', () => {
    const defaultKeys: Dict<KeyType> = { id: KeyType.number };
    let keys: Dict<KeyType> = defaultKeys;
    let itemsToInsert: Dict<any>[] = [];
    const subject = () => connector().batchInsert(tableName, keys, itemsToInsert);

    const itInsertsItemsToStorage = (seeds: Dict<() => void>) => {
      for (const description in seeds) {
        const definitions = seeds[description];
        context(description, {
          definitions,
          tests() {
            it('promises to return empty', async () => {
              await expect(subject()).resolves.toEqual([]);
            });
            it('does not change storage', async () => {
              const storageBeforeUpdate = clone(items());
              await subject();
              const storageAfterUpdate = items();
              expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
            });

            context('with single item to insert', {
              definitions: () => (itemsToInsert = [{ foo: 'bar' }]),
              reset: () => (itemsToInsert = []),
              tests() {
                it('promises to return single item', async () => {
                  const items = await subject();
                  const createdItems = items.map((item, index) => ({
                    id: item.id,
                    ...itemsToInsert[index],
                  }));
                  expect(items.length).toEqual(itemsToInsert.length);
                  for (const item of items) {
                    expect(typeof item.id).toEqual('number');
                  }
                  expect(items).toEqual(createdItems);
                });
                it('adds items to storage', async () => {
                  const storageBeforeUpdate = clone(items());
                  const createdItems = await subject();
                  const storageAfterUpdate = items();
                  expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                  expect(storageAfterUpdate).toEqual([...storageBeforeUpdate, ...createdItems]);
                });

                context('with uuid id', {
                  definitions: () => (keys = { id: KeyType.number, uuid: KeyType.uuid }),
                  reset: () => (keys = defaultKeys),
                  tests() {
                    it('promises to return single item with multiple keys', async () => {
                      const items = await subject();
                      const createdItems = items.map((item, index) => ({
                        id: item.id,
                        uuid: item.uuid,
                        ...itemsToInsert[index],
                      }));
                      expect(items.length).toEqual(itemsToInsert.length);
                      for (const item of items) {
                        expect(item.id).toBeGreaterThan(0);
                        expect(typeof item.uuid).toEqual('string');
                      }
                      expect(items).toEqual(createdItems);
                    });
                    it('adds items to storage', async () => {
                      const storageBeforeUpdate = clone(items());
                      const createdItems = await subject();
                      const storageAfterUpdate = items();
                      expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                      expect(storageAfterUpdate).toEqual([...storageBeforeUpdate, ...createdItems]);
                    });
                  },
                });
              },
            });

            context('with multiple items to insert', {
              definitions: () =>
                (itemsToInsert = [{ foo: 'bar' }, { foo: null }, { foo: undefined }]),
              reset: () => (itemsToInsert = []),
              tests() {
                it('promises to return created items', async () => {
                  const items = await subject();
                  const createdItems = items.map((item, index) => ({
                    id: item.id,
                    ...itemsToInsert[index],
                  }));
                  expect(items.length).toEqual(itemsToInsert.length);
                  let prevItem = items[items.length - 1];
                  for (const item of items) {
                    expect(typeof item.id).toEqual('number');
                    expect(item.id).not.toEqual(prevItem.id);
                    prevItem = item;
                  }
                  expect(items).toEqual(createdItems);
                });
                it('adds items to storage', async () => {
                  const storageBeforeUpdate = clone(items());
                  const createdItems = await subject();
                  const storageAfterUpdate = items();
                  expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                  expect(storageAfterUpdate).toEqual([...storageBeforeUpdate, ...createdItems]);
                });

                context('with uuid id', {
                  definitions: () => (keys = { id: KeyType.number, uuid: KeyType.uuid }),
                  reset: () => (keys = defaultKeys),
                  tests() {
                    it('promises to return created items', async () => {
                      const items = await subject();
                      const createdItems = items.map((item, index) => ({
                        id: item.id,
                        uuid: item.uuid,
                        ...itemsToInsert[index],
                      }));
                      expect(items.length).toEqual(itemsToInsert.length);
                      let prevItem = items[items.length - 1];
                      for (const item of items) {
                        expect(typeof item.id).toEqual('number');
                        expect(typeof item.uuid).toEqual('string');
                        expect(item.id).not.toEqual(prevItem.id);
                        expect(item.uuid).not.toEqual(prevItem.uuid);
                        prevItem = item;
                      }
                      expect(items).toEqual(createdItems);
                    });
                    it('adds items to storage', async () => {
                      const storageBeforeUpdate = clone(items());
                      const createdItems = await subject();
                      const storageAfterUpdate = items();
                      expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                      expect(storageAfterUpdate).toEqual([...storageBeforeUpdate, ...createdItems]);
                    });
                  },
                });
              },
            });
          },
        });
      }
    };

    itInsertsItemsToStorage({
      'with empty prefilled storage': withEmptySeed,
      'with single item prefilled storage': withSingleSeed,
      'with multiple items prefilled storage': withMultiSeed,
    });
  });
});

describe('#deltaUpdate(spec)', () => {
  beforeEach(() => {
    storage = {
      [tableName]: [
        { id: 1, count: 0 },
        { id: 2, count: 0 },
        { id: 3, count: 5 },
      ],
    };
  });

  it('exposes an deltaUpdate method', () => {
    expect(typeof connector().deltaUpdate).toBe('function');
  });

  it('applies a positive delta and returns the affected row count', async () => {
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: { id: 1 },
      deltas: [{ column: 'count', by: 3 }],
    });
    expect(affected).toBe(1);
    expect(storage[tableName].find((r) => r.id === 1)?.count).toBe(3);
  });

  it('applies a negative delta', async () => {
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: { id: 3 },
      deltas: [{ column: 'count', by: -2 }],
    });
    expect(affected).toBe(1);
    expect(storage[tableName].find((r) => r.id === 3)?.count).toBe(3);
  });

  it('treats null/undefined columns as 0 for the delta', async () => {
    storage[tableName] = [{ id: 1 }];
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: { id: 1 },
      deltas: [{ column: 'count', by: 7 }],
    });
    expect(affected).toBe(1);
    expect(storage[tableName][0].count).toBe(7);
  });

  it('applies absolute set fields alongside deltas', async () => {
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: { id: 1 },
      deltas: [{ column: 'count', by: 1 }],
      set: { foo: 'bar' },
    });
    expect(affected).toBe(1);
    const row = storage[tableName].find((r) => r.id === 1);
    expect(row?.count).toBe(1);
    expect(row?.foo).toBe('bar');
  });

  it('updates every matching row when filter is broader', async () => {
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: {},
      deltas: [{ column: 'count', by: 1 }],
    });
    expect(affected).toBe(3);
    expect(storage[tableName].map((r) => r.count)).toEqual([1, 1, 6]);
  });

  it('returns 0 when no row matches', async () => {
    const affected = await connector().deltaUpdate?.({
      tableName,
      filter: { id: 9999 },
      deltas: [{ column: 'count', by: 1 }],
    });
    expect(affected).toBe(0);
    expect(storage[tableName].map((r) => r.count)).toEqual([0, 0, 5]);
  });

  it('1000 concurrent increments converge to the correct value', async () => {
    storage[tableName] = [{ id: 1, count: 0 }];
    const c = connector();
    const N = 1000;
    await Promise.all(
      Array.from({ length: N }, () =>
        c.deltaUpdate?.({
          tableName,
          filter: { id: 1 },
          deltas: [{ column: 'count', by: 1 }],
        }),
      ),
    );
    expect(storage[tableName][0].count).toBe(N);
  });
});

import { baseQueryScoped } from '../query/baseQueryScoped.js';

describe('#queryScoped(spec)', () => {
  it('queryScoped delegates to baseQueryScoped fallback', async () => {
    const c = new MemoryConnector({ storage: { items: [{ id: 1 }, { id: 2 }] } });
    const rows = await c.queryScoped({
      target: { tableName: 'items', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: 'rows',
    });
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

import { runModelConformance } from './conformance.js';

runModelConformance({
  name: 'MemoryConnector',
  makeConnector: () => new MemoryConnector({ storage: {} }),
});
