import {
  PropertyNotDefinedError,
  NextModel,
} from '../next_model';

import {
  Schema,
  ModelConstructor,
} from '../types';

import {
  context,
} from './types';

const Model = NextModel<any>();

describe('NextModel', () => {
  // Static properties
  describe('.modelName', () => {
    let Klass: typeof Model;
    let modelName: string = 'foo';

    const subject = () => Klass.modelName;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() {};
        Klass = NewKlass;
      },
      tests() {
        test('throws Error', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when modelName is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get modelName(): string {
                return modelName;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the name of the model', () => {
              expect(subject()).toEqual(modelName);
            });
          },
        });
      },
    });
  });

  describe('.schema', () => {
    let Klass: typeof Model;
    let schema: Schema<any> = { foo: { type: 'bar' } };

    const subject = () => Klass.schema;

    context('schema is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        test('throws Error', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when schema is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get schema(): Schema<any> {
                return schema;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the schema of the model', () => {
              expect(subject()).toEqual(schema);
            });
          },
        });
      },
    });
  });
});

