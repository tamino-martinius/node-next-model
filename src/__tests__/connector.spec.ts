import {
  NextModel,
} from '../next_model';

import {
  Schema,
  FilterProperty,
  Filter,
  Identifiable,
} from '../types';

import {
  Storage,
  Connector,
} from '../connector';

import {
  context,
} from './types';

import {
  Faker,
} from '../__mocks__/next_model';

let storage: Storage | undefined = undefined;
let connector = () => new Connector(storage);
let id: number;
const Model = NextModel<any>();

beforeEach(() => {
  storage = undefined;
});

describe('DefaultConnector', () => {
  describe('#all(model)', () => {
    let Klass: typeof Model = Faker.model;
    const subject = () => connector().all(Klass);

    it('promises empty array', () => {
      return expect(subject()).resolves.toEqual([]);
    });

    context('with single item prefilled storage', {
      definitions() {
        storage = {
          [Klass.modelName]: [
            { id: 1 },
          ],
        };
      },
      tests() {
        it('promises all items as model instances', () => {
          return expect(subject()).resolves.toEqual([
            new Klass({ id: 1 }),
          ]);
        });
      },
    });

    context('with multiple items prefilled storage', {
      definitions() {
        storage = {
          [Klass.modelName]: [
            { id: 1, foo: 'bar' },
            { id: 2, foo: null},
            { id: 3, foo: 'bar' },
          ],
        };
      },
      tests() {
        it('promises all items as model instances', () => {
          return expect(subject()).resolves.toEqual([
            new Klass({ id: 1 }),
            new Klass({ id: 2 }),
            new Klass({ id: 3 }),
          ]);
        });

        describe('property filter', () => {
          context('with filter for existing id', {
            definitions() {
              id = Faker.randomId(3);
              class NewKlass extends Klass {
                static get filter(): FilterProperty<Identifiable> {
                  return {
                    id,
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id }),
                ]);
              });
            },
          });

          context('with filter for multiple attributes where both matches', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): FilterProperty<any> {
                  return {
                    id: 1,
                    foo: 'bar',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                ]);
              });
            },
          });

          context('with filter for multiple attributes where only one matches', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): FilterProperty<any> {
                  return {
                    id: 1,
                    foo: 'c',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with filter for multiple for one attribute', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): FilterProperty<any> {
                  return {
                    foo: 'bar',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with filter for non existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): FilterProperty<Identifiable> {
                  return {
                    id: Faker.randomNumber(4, Number.MAX_SAFE_INTEGER),
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });
        });

        describe('$and special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $and: [],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter for existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $and: [
                      { id: 2 },
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with multiple filters for non overlapping ids', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $and: [
                      { id: 2 },
                      { id: 3 },
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with multiple overlapping filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $and: [
                      { id: 2 },
                      { id: 2 }, // [TODO] add better example
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });
        });

        describe('$not special filter', () => {
          context('with filter for existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $not: {
                      id: 2,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with filter for non existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $not: {
                      id: Faker.randomNumber(4, Number.MAX_SAFE_INTEGER),
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $not: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });
        });

        describe('$or special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $or: [],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with single filter for existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $or: [
                      { id: 2 },
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with multiple filters for non overlapping ids', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $or: [
                      { id: 2 },
                      { id: 3 },
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with multiple overlapping filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $or: [
                      { id: 2 },
                      { id: 2 }, // [TODO] add better example
                    ],
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });
        });


        describe('$in special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $in: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter for existing id', {
            definitions() {
              id = Faker.randomId(3);
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $in: {
                      id: [id],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id }),
                ]);
              });
            },
          });

          context('with multiple filters for non overlapping ids', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $in: {
                      id: [2, 3],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $in: {
                      id: [Faker.randomId(3)],
                      foo: [Faker.randomId(3)],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });

        describe('$notIn special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notIn: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter for existing id', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notIn: {
                      id: [2],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with multiple filters for non overlapping ids', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notIn: {
                      id: [2, 3],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                ]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notIn: {
                      id: [Faker.randomId(3)],
                      foo: [Faker.randomId(3)],
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });


        describe('$null special filter', () => {
          context('with filter for nullable property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $null: 'foo',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with filter for non nullable property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $null: 'id',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with filter for non present property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $null: 'bar',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });
        });

        describe('$notNull special filter', () => {
          context('with filter for nullable property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notNull: 'foo',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with filter for non nullable property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notNull: 'id',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with filter for non present property', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notNull: 'bar',
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });
        });


        describe('$between special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $between: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter within values', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 1,
                        to: 2,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with single filter with string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $between: {
                      foo: {
                        from: 'a',
                        to: 'z',
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter going into range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 0,
                        to: 1,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                ]);
              });
            },
          });

          context('with single filter going outside range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 3,
                        to: 4,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter with start equals end', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 2,
                        to: 2,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with single filter outside', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 4,
                        to: 5,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with single filter with start greater then end', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $between: {
                      id: {
                        from: 3,
                        to: 1,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $between: {
                      id: { from: 1, to: 2 },
                      foo: { from: 'bar', to: 'foo' },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });

        describe('$notBetween special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notBetween: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter within values', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 1,
                        to: 2,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter with string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notBetween: {
                      foo: {
                        from: 'a',
                        to: 'z',
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with single filter going into range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 0,
                        to: 1,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter going outside range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 3,
                        to: 4,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                ]);
              });
            },
          });

          context('with single filter with start equals end', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 2,
                        to: 2,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter outside', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 4,
                        to: 5,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter with start greater then end', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $notBetween: {
                      id: {
                        from: 3,
                        to: 1,
                      },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $notBetween: {
                      id: { from: 1, to: 2 },
                      foo: { from: 'bar', to: 'foo' },
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });


        describe('$gt special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gt: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter within values', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gt: {
                      id: 2,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter with string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gt: {
                      foo: 'bar',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with single filter with matching string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gt: {
                      foo: 'a',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter going into range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gt: {
                      id: 0,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter outside', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gt: {
                      id: 4,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gt: {
                      id: 2,
                      foo: 'bar',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });

        describe('$gte special filter', () => {
          context('with empty filter', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gte: {},
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });

          context('with single filter within values', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gte: {
                      id: 2,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter with string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gte: {
                      foo: 'z',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with single filter with matching string attributes', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gte: {
                      foo: 'bar',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all matching items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter going into range', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gte: {
                      id: 0,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises all items as model instances', () => {
                return expect(subject()).resolves.toEqual([
                  new Klass({ id: 1 }),
                  new Klass({ id: 2 }),
                  new Klass({ id: 3 }),
                ]);
              });
            },
          });

          context('with single filter outside', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<Identifiable> {
                  return {
                    $gte: {
                      id: 4,
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('promises empty array', () => {
                return expect(subject()).resolves.toEqual([]);
              });
            },
          });

          context('with multiple filters', {
            definitions() {
              class NewKlass extends Klass {
                static get filter(): Filter<any> {
                  return {
                    $gte: {
                      id: 2,
                      foo: 'bar',
                    },
                  };
                }
              };
              Klass = NewKlass;
            },
            tests() {
              it('rejects filter and returns error', () => {
                return expect(subject()).rejects.toEqual('[TODO] Return proper error');
              });
            },
          });
        });

      },
    });
  });
});
