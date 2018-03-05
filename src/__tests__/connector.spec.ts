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
          Foo: [
            { id: 1 },
            { id: 2 },
            { id: 3 },
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
                    $not: {
                      id: 2,
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
      },
    });
  });
});
