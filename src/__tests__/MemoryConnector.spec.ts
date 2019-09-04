import { Dict, Filter, MemoryConnector, Scope, Storage } from '..';
import { context, it, randomInteger } from '.';

let storage: Storage = {};

const validId: number = randomInteger(1, 3);
const invalidId: number = randomInteger(4, Number.MAX_SAFE_INTEGER);
const anyId: number = randomInteger(1, Number.MAX_SAFE_INTEGER);

const tableName = 'foo';
const withEmptySeed = () => (storage = { [tableName]: [] });
const withSingleSeed = () => (storage = { [tableName]: [{ id: validId }] });
const withMultiSeed = () =>
  (storage = { [tableName]: [{ id: 1, foo: 'bar' }, { id: 2, foo: null }, { id: 3, foo: 'bar' }] });

const idsOf = (items: Dict<any>[]) => items.map(item => item.id);
const connector = () => new MemoryConnector(storage);

interface FilterSpecs {
  filter: Filter<any> | undefined;
  results: number[] | string;
}

interface FilterSpecGroup {
  [key: string]: FilterSpecs[];
}

const filterSpecGroups: FilterSpecGroup = {
  none: [{ filter: undefined, results: [1, 2, 3] }, { filter: {}, results: [1, 2, 3] }],
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
    { filter: { $in: {} }, results: '[TODO] Return proper error' },
    { filter: { $in: { id: [validId] } }, results: [validId] },
    { filter: { $in: { id: [2, 3] } }, results: [2, 3] },
    { filter: { $in: { id: [2, 2] } }, results: [2] },
    { filter: { $in: { id: [1], foo: ['bar'] } }, results: '[TODO] Return proper error' },
  ],
  $notIn: [
    { filter: { $notIn: {} }, results: '[TODO] Return proper error' },
    { filter: { $notIn: { id: [2] } }, results: [1, 3] },
    { filter: { $notIn: { id: [2, 3] } }, results: [1] },
    { filter: { $notIn: { id: [2, 2] } }, results: [1, 3] },
    { filter: { $notIn: { id: [1], foo: ['bar'] } }, results: '[TODO] Return proper error' },
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
    { filter: { $between: {} }, results: '[TODO] Return proper error' },
    { filter: { $between: { id: { from: 1, to: 2 } } }, results: [1, 2] },
    { filter: { $between: { foo: { from: 'a', to: 'z' } } }, results: [1, 3] },
    { filter: { $between: { id: { from: 0, to: 1 } } }, results: [1] },
    { filter: { $between: { id: { from: 3, to: 4 } } }, results: [3] },
    { filter: { $between: { id: { from: validId, to: validId } } }, results: [validId] },
    { filter: { $between: { id: { from: 4, to: 5 } } }, results: [] },
    { filter: { $between: { id: { from: 3, to: 1 } } }, results: [] },
    {
      filter: { $between: { id: { from: 1, to: 3 }, foo: { from: 'a', to: 'z' } } },
      results: '[TODO] Return proper error',
    },
  ],
  $gt: [
    { filter: { $gt: {} }, results: '[TODO] Return proper error' },
    { filter: { $gt: { id: 2 } }, results: [3] },
    { filter: { $gt: { foo: 'bar' } }, results: [] },
    { filter: { $gt: { foo: 'a' } }, results: [1, 3] },
    { filter: { $gt: { id: 0 } }, results: [1, 2, 3] },
    { filter: { $gt: { id: invalidId } }, results: [] },
    { filter: { $gt: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
  ],
  $gte: [
    { filter: { $gte: {} }, results: '[TODO] Return proper error' },
    { filter: { $gte: { id: 2 } }, results: [2, 3] },
    { filter: { $gte: { foo: 'z' } }, results: [] },
    { filter: { $gte: { foo: 'bar' } }, results: [1, 3] },
    { filter: { $gte: { foo: 'a' } }, results: [1, 3] },
    { filter: { $gte: { id: 0 } }, results: [1, 2, 3] },
    { filter: { $gte: { id: invalidId } }, results: [] },
    { filter: { $gte: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
  ],
  $lt: [
    { filter: { $lt: {} }, results: '[TODO] Return proper error' },
    { filter: { $lt: { id: 2 } }, results: [1] },
    { filter: { $lt: { foo: 'bar' } }, results: [] },
    { filter: { $lt: { foo: 'z' } }, results: [1, 3] },
    { filter: { $lt: { id: 4 } }, results: [1, 2, 3] },
    { filter: { $lt: { id: 0 } }, results: [] },
    { filter: { $lt: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
  ],
  $lte: [
    { filter: { $lte: {} }, results: '[TODO] Return proper error' },
    { filter: { $lte: { id: 2 } }, results: [1, 2] },
    { filter: { $lte: { foo: 'a' } }, results: [] },
    { filter: { $lte: { foo: 'bar' } }, results: [1, 3] },
    { filter: { $lte: { foo: 'z' } }, results: [1, 3] },
    { filter: { $lte: { id: 4 } }, results: [1, 2, 3] },
    { filter: { $lte: { id: 0 } }, results: [] },
    { filter: { $lte: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
  ],
};

for (const key in filterSpecGroups) {
  const groupName = '$async -> ' + key;
  filterSpecGroups[groupName] = [];
  filterSpecGroups[groupName].push(
    ...filterSpecGroups[key].map(spec => ({
      filter: {
        $async: Promise.resolve(spec.filter),
      },
      results: spec.results,
    })),
  );
}

describe('Connector', () => {
  describe('#query(model)', () => {
    let skip: number | undefined;
    let limit: number | undefined;
    let filter: Filter<any> | undefined = {};
    const scope = () => ({ tableName, skip, limit, filter });
    const subject = () => connector().query(scope());

    context('with single item prefilled storage', {
      definitions: withEmptySeed,
      tests() {
        it('promises to return empty array', () => {
          return expect(subject()).resolves.toEqual([]);
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
        for (const groupName in filterSpecGroups) {
          describe(groupName + ' filter', () => {
            filterSpecGroups[groupName].forEach(filterSpec => {
              context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
                definitions() {
                  filter = filterSpec.filter;
                },
                tests() {
                  const results = filterSpec.results;
                  if (Array.isArray(results)) {
                    if (results.length === 0) {
                      it('promises to return empty array', () => {
                        return expect(subject()).resolves.toEqual([]);
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
                      return expect(subject()).rejects.toEqual(results);
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

  // describe('#select(model, ...keys)', () => {
  //   let skip = 0;
  //   let limit = Number.MAX_SAFE_INTEGER;
  //   let keys: any[] = [];
  //   const subject = () => connector().select(Klass.skipBy(skip).limitBy(limit), ...keys);

  //   it('promises empty array', () => {
  //     return expect(subject()).resolves.toEqual([]);
  //   });

  //   context('with single item prefilled storage', {
  //     definitions() {
  //       storage = singleSeed;
  //     },
  //     tests() {
  //       it('promises all items with selected attributes', async () => {
  //         const items = await subject();
  //         expect(items.length).toEqual(1);
  //         expect(items[0].length).toEqual(0);
  //       });
  //     },
  //   });

  //   context('with multiple items prefilled storage', {
  //     definitions() {
  //       storage = multiSeed;
  //     },
  //     tests() {
  //       for (const groupName in filterSpecGroups) {
  //         describe(groupName + ' filter', () => {
  //           filterSpecGroups[groupName].forEach(filterSpec => {
  //             context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //               definitions() {
  //                 class NewKlass extends Klass {
  //                   static get filter(): Filter<any> {
  //                     return filterSpec.filter;
  //                   }
  //                 }
  //                 Klass = NewKlass;
  //               },
  //               tests() {
  //                 const results = filterSpec.results;
  //                 if (Array.isArray(results)) {
  //                   if (results.length === 0) {
  //                     it('promises empty array', () => {
  //                       return expect(subject()).resolves.toEqual([]);
  //                     });
  //                   } else if (results.length === 3) {
  //                     it('promises all items with selected attributes', async () => {
  //                       const items = await subject();
  //                       expect(items.length).toEqual(results.length);
  //                       expect(items[0].length).toEqual(0);
  //                     });
  //                   } else {
  //                     it('promises all matching items with selected attributes', async () => {
  //                       const items = await subject();
  //                       expect(items.length).toEqual(results.length);
  //                       expect(items[0].length).toEqual(0);
  //                     });
  //                   }

  //                   context('when skip is present', {
  //                     definitions() {
  //                       skip = 1;
  //                     },
  //                     reset() {
  //                       skip = 0;
  //                     },
  //                     tests() {
  //                       it('promises all matching items with selected attributes', async () => {
  //                         const items = await subject();
  //                         expect(items.length).toEqual(Math.max(0, results.length - 1));
  //                         if (results.length > 1) {
  //                           expect(items[0].length).toEqual(0);
  //                         }
  //                       });
  //                     },
  //                   });

  //                   context('when limit is present', {
  //                     definitions() {
  //                       limit = 1;
  //                     },
  //                     reset() {
  //                       limit = Number.MAX_SAFE_INTEGER;
  //                     },
  //                     tests() {
  //                       it('promises all matching items with selected attributes', async () => {
  //                         const items = await subject();
  //                         expect(items.length).toEqual(results.length > 0 ? 1 : 0);
  //                         if (results.length > 0) {
  //                           expect(items[0].length).toEqual(0);
  //                         }
  //                       });
  //                     },
  //                   });

  //                   context('when skip and limit is present', {
  //                     definitions() {
  //                       skip = 1;
  //                       limit = 1;
  //                     },
  //                     reset() {
  //                       skip = 0;
  //                       limit = Number.MAX_SAFE_INTEGER;
  //                     },
  //                     tests() {
  //                       it('promises all matching items with selected attributes', async () => {
  //                         const items = await subject();
  //                         expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
  //                         if (results.length > 1) {
  //                           expect(items[0].length).toEqual(0);
  //                         }
  //                       });
  //                     },
  //                   });
  //                 } else {
  //                   it('rejects filter and returns error', () => {
  //                     return expect(subject()).rejects.toEqual(results);
  //                   });
  //                 }
  //               },
  //             });
  //           });
  //         });
  //       }
  //     },
  //   });

  //   context('when keys contain single item', {
  //     definitions() {
  //       keys = ['id'];
  //     },
  //     tests() {
  //       context('with single item prefilled storage', {
  //         definitions() {
  //           storage = singleSeed;
  //         },
  //         tests() {
  //           it('promises all items with selected attributes', async () => {
  //             const items = await subject();
  //             expect(items.length).toEqual(1);
  //             expect(items[0].length).toEqual(1);
  //             expect(items[0]).toEqual([validId]);
  //           });
  //         },
  //       });

  //       context('with multiple items prefilled storage', {
  //         definitions() {
  //           storage = multiSeed;
  //         },
  //         tests() {
  //           for (const groupName in filterSpecGroups) {
  //             describe(groupName + ' filter', () => {
  //               filterSpecGroups[groupName].forEach(filterSpec => {
  //                 context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //                   definitions() {
  //                     class NewKlass extends Klass {
  //                       static get filter(): Filter<any> {
  //                         return filterSpec.filter;
  //                       }
  //                     }
  //                     Klass = NewKlass;
  //                   },
  //                   tests() {
  //                     const results = filterSpec.results;
  //                     if (Array.isArray(results)) {
  //                       if (results.length === 0) {
  //                         it('promises empty array', () => {
  //                           return expect(subject()).resolves.toEqual([]);
  //                         });
  //                       } else if (results.length === 3) {
  //                         it('promises all items with selected attributes', async () => {
  //                           const items = await subject();
  //                           expect(items.length).toEqual(results.length);
  //                           expect(items[0].length).toEqual(1);
  //                           expect(items.map(attrs => attrs[0])).toEqual(results);
  //                         });
  //                       } else {
  //                         it('promises all matching items with selected attributes', async () => {
  //                           const items = await subject();
  //                           expect(items.length).toEqual(results.length);
  //                           expect(items[0].length).toEqual(1);
  //                           expect(items.map(attrs => attrs[0])).toEqual(results);
  //                         });
  //                       }

  //                       context('when skip is present', {
  //                         definitions() {
  //                           skip = 1;
  //                         },
  //                         reset() {
  //                           skip = 0;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(Math.max(0, results.length - 1));
  //                             if (results.length > 1) {
  //                               expect(items[0].length).toEqual(1);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(1));
  //                           });
  //                         },
  //                       });

  //                       context('when limit is present', {
  //                         definitions() {
  //                           limit = 1;
  //                         },
  //                         reset() {
  //                           limit = Number.MAX_SAFE_INTEGER;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(results.length > 0 ? 1 : 0);
  //                             if (results.length > 0) {
  //                               expect(items[0].length).toEqual(1);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(0, 1));
  //                           });
  //                         },
  //                       });

  //                       context('when skip and limit is present', {
  //                         definitions() {
  //                           skip = 1;
  //                           limit = 1;
  //                         },
  //                         reset() {
  //                           skip = 0;
  //                           limit = Number.MAX_SAFE_INTEGER;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
  //                             if (results.length > 1) {
  //                               expect(items[0].length).toEqual(1);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(1, 2));
  //                           });
  //                         },
  //                       });
  //                     } else {
  //                       it('rejects filter and returns error', () => {
  //                         return expect(subject()).rejects.toEqual(results);
  //                       });
  //                     }
  //                   },
  //                 });
  //               });
  //             });
  //           }
  //         },
  //       });
  //     },
  //   });

  //   context('when keys contain multiple items', {
  //     definitions() {
  //       keys = ['id', 'foo'];
  //     },
  //     tests() {
  //       context('with single item prefilled storage', {
  //         definitions() {
  //           storage = singleSeed;
  //         },
  //         tests() {
  //           it('promises all items with selected attributes', async () => {
  //             const items = await subject();
  //             expect(items.length).toEqual(1);
  //             expect(items[0].length).toEqual(2);
  //             expect(items[0]).toEqual([validId, undefined]);
  //           });
  //         },
  //       });

  //       context('with multiple items prefilled storage', {
  //         definitions() {
  //           storage = multiSeed;
  //         },
  //         tests() {
  //           for (const groupName in filterSpecGroups) {
  //             describe(groupName + ' filter', () => {
  //               filterSpecGroups[groupName].forEach(filterSpec => {
  //                 context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //                   definitions() {
  //                     class NewKlass extends Klass {
  //                       static get filter(): Filter<any> {
  //                         return filterSpec.filter;
  //                       }
  //                     }
  //                     Klass = NewKlass;
  //                   },
  //                   tests() {
  //                     const results = filterSpec.results;
  //                     if (Array.isArray(results)) {
  //                       if (results.length === 0) {
  //                         it('promises empty array', () => {
  //                           return expect(subject()).resolves.toEqual([]);
  //                         });
  //                       } else if (results.length === 3) {
  //                         it('promises all items with selected attributes', async () => {
  //                           const items = await subject();
  //                           expect(items.length).toEqual(results.length);
  //                           expect(items[0].length).toEqual(2);
  //                           expect(items.map(attrs => attrs[0])).toEqual(results);
  //                         });
  //                       } else {
  //                         it('promises all matching items with selected attributes', async () => {
  //                           const items = await subject();
  //                           expect(items.length).toEqual(results.length);
  //                           expect(items[0].length).toEqual(2);
  //                           expect(items.map(attrs => attrs[0])).toEqual(results);
  //                         });
  //                       }

  //                       context('when skip is present', {
  //                         definitions() {
  //                           skip = 1;
  //                         },
  //                         reset() {
  //                           skip = 0;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(Math.max(0, results.length - 1));
  //                             if (results.length > 1) {
  //                               expect(items[0].length).toEqual(2);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(1));
  //                           });
  //                         },
  //                       });

  //                       context('when limit is present', {
  //                         definitions() {
  //                           limit = 1;
  //                         },
  //                         reset() {
  //                           limit = Number.MAX_SAFE_INTEGER;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(results.length > 0 ? 1 : 0);
  //                             if (results.length > 0) {
  //                               expect(items[0].length).toEqual(2);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(0, 1));
  //                           });
  //                         },
  //                       });

  //                       context('when skip and limit is present', {
  //                         definitions() {
  //                           skip = 1;
  //                           limit = 1;
  //                         },
  //                         reset() {
  //                           skip = 0;
  //                           limit = Number.MAX_SAFE_INTEGER;
  //                         },
  //                         tests() {
  //                           it('promises all matching items with selected attributes', async () => {
  //                             const items = await subject();
  //                             expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
  //                             if (results.length > 1) {
  //                               expect(items[0].length).toEqual(2);
  //                             }
  //                             expect(items.map(attrs => attrs[0])).toEqual(results.slice(1, 2));
  //                           });
  //                         },
  //                       });
  //                     } else {
  //                       it('rejects filter and returns error', () => {
  //                         return expect(subject()).rejects.toEqual(results);
  //                       });
  //                     }
  //                   },
  //                 });
  //               });
  //             });
  //           }
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#count(model)', () => {
  //   const subject = () => connector().count(Klass);

  //   it('promises a count of 0', () => {
  //     return expect(subject()).resolves.toEqual(0);
  //   });

  //   context('with single item prefilled storage', {
  //     definitions() {
  //       storage = singleSeed;
  //     },
  //     tests() {
  //       it('promises a count of 1', () => {
  //         return expect(subject()).resolves.toEqual(1);
  //       });
  //     },
  //   });

  //   context('with multiple items prefilled storage', {
  //     definitions() {
  //       storage = multiSeed;
  //     },
  //     tests() {
  //       for (const groupName in filterSpecGroups) {
  //         describe(groupName + ' filter', () => {
  //           filterSpecGroups[groupName].forEach(filterSpec => {
  //             context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //               definitions() {
  //                 class NewKlass extends Klass {
  //                   static get filter(): Filter<any> {
  //                     return filterSpec.filter;
  //                   }
  //                 }
  //                 Klass = NewKlass;
  //               },
  //               tests() {
  //                 const results = filterSpec.results;
  //                 if (Array.isArray(results)) {
  //                   it('promises a count of ' + results.length, () => {
  //                     return expect(subject()).resolves.toEqual(results.length);
  //                   });
  //                 } else {
  //                   it('rejects filter and returns error', () => {
  //                     return expect(subject()).rejects.toEqual(results);
  //                   });
  //                 }
  //               },
  //             });
  //           });
  //         });
  //       }
  //     },
  //   });
  // });

  // describe('#updateAll(model, attrs)', () => {
  //   const attrs = {
  //     id: 1,
  //     foo: 'baz',
  //   };
  //   const subject = () => {
  //     return connector().updateAll(Klass, attrs);
  //   };

  //   context('with single item prefilled storage', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get schema(): Schema<any> {
  //           return {
  //             id: { type: DataType.integer },
  //             foo: { type: DataType.string },
  //           };
  //         }
  //       }
  //       Klass = NewKlass;

  //       storage = singleSeed;
  //     },
  //     tests() {
  //       it('updates item within storage storage', async () => {
  //         const count = await subject();
  //         expect(count).toEqual(1);
  //       });

  //       context('when item is not in storage', {
  //         definitions() {
  //           class NewKlass extends Klass {
  //             static get filter(): Filter<any> {
  //               return {
  //                 id: invalidId,
  //               };
  //             }
  //           }
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('does not change storage', async () => {
  //             const count = await subject();
  //             expect(count).toEqual(0);
  //             expect(items()).toEqual([{ id: validId }]);
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('with multiple items prefilled storage', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get schema(): Schema<any> {
  //           return {
  //             id: { type: DataType.integer },
  //             foo: { type: DataType.string },
  //           };
  //         }
  //       }
  //       Klass = NewKlass;

  //       storage = multiSeed;
  //     },
  //     tests() {
  //       for (const groupName in filterSpecGroups) {
  //         describe(groupName + ' filter', () => {
  //           filterSpecGroups[groupName].forEach(filterSpec => {
  //             context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //               definitions() {
  //                 class NewKlass extends Klass {
  //                   static get filter(): Filter<any> {
  //                     return filterSpec.filter;
  //                   }
  //                 }
  //                 Klass = NewKlass;
  //               },
  //               tests() {
  //                 const results = filterSpec.results;
  //                 if (Array.isArray(results)) {
  //                   it('updated matching count of records', async () => {
  //                     const count = await subject();
  //                     expect(count).toEqual(results.length);
  //                   });
  //                 } else {
  //                   it('rejects filter and returns error', () => {
  //                     return expect(subject()).rejects.toEqual(results);
  //                   });
  //                 }
  //               },
  //             });
  //           });
  //         });
  //       }
  //     },
  //   });
  // });

  // describe('#deleteAll(model)', () => {
  //   const subject = () => {
  //     return connector().deleteAll(Klass);
  //   };

  //   context('with single item prefilled storage', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get schema(): Schema<any> {
  //           return {
  //             id: { type: DataType.integer },
  //             foo: { type: DataType.string },
  //           };
  //         }
  //       }
  //       Klass = NewKlass;

  //       storage = singleSeed;
  //     },
  //     tests() {
  //       it('updates item within storage storage', async () => {
  //         const count = await subject();
  //         expect(count).toEqual(1);
  //         expect(items()).toEqual([]);
  //       });

  //       context('when item is not in storage', {
  //         definitions() {
  //           class NewKlass extends Klass {
  //             static get filter(): Filter<any> {
  //               return {
  //                 id: invalidId,
  //               };
  //             }
  //           }
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('does not change storage', async () => {
  //             const count = await subject();
  //             expect(count).toEqual(0);
  //             expect(items()).toEqual([{ id: validId }]);
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('with multiple items prefilled storage', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get schema(): Schema<any> {
  //           return {
  //             id: { type: DataType.integer },
  //             foo: { type: DataType.string },
  //           };
  //         }
  //       }
  //       Klass = NewKlass;

  //       storage = multiSeed;
  //     },
  //     tests() {
  //       for (const groupName in filterSpecGroups) {
  //         describe(groupName + ' filter', () => {
  //           filterSpecGroups[groupName].forEach(filterSpec => {
  //             context(`with filter '${JSON.stringify(filterSpec.filter)}'`, {
  //               definitions() {
  //                 class NewKlass extends Klass {
  //                   static get filter(): Filter<any> {
  //                     return filterSpec.filter;
  //                   }
  //                 }
  //                 Klass = NewKlass;
  //               },
  //               tests() {
  //                 const results = filterSpec.results;
  //                 if (Array.isArray(results)) {
  //                   it('deletes matching amount of records', async () => {
  //                     const count = await subject();
  //                     expect(count).toEqual(results.length);
  //                   });
  //                 } else {
  //                   it('rejects filter and returns error', () => {
  //                     return expect(subject()).rejects.toEqual(results);
  //                   });
  //                 }
  //               },
  //             });
  //           });
  //         });
  //       }
  //     },
  //   });
  // });

  // describe('#create(instance)', () => {
  //   const attrs = {
  //     foo: 'baz',
  //   };
  //   let instance: ModelConstructor<any>;
  //   const subject = () => {
  //     return connector().create(instance);
  //   };

  //   context('with empty storage', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get schema(): Schema<any> {
  //           return {
  //             id: { type: DataType.integer },
  //             foo: { type: DataType.string },
  //           };
  //         }
  //       }
  //       Klass = NewKlass;
  //       instance = new Klass(attrs);
  //       storage = emptySeed;
  //     },
  //     tests() {
  //       it('creates new instance', async () => {
  //         expect(items()).toEqual([]);
  //         const instace = await subject();
  //         expect(instance instanceof Klass).toBeTruthy();
  //         expect(items().length).toEqual(1);
  //         const id = items()[0].id;
  //         expect(items()).toEqual([{ id: id, foo: 'baz' }]);
  //         expect(instance.attributes).toEqual({ id: id, foo: 'baz' });
  //       });
  //     },
  //   });
  // });
});
