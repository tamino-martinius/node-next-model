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
  });
});
