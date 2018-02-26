import {
  PropertyNotDefinedError,
  NextModel,
} from '../next_model';

import {
  Filter,
  Schema,
  ModelConstructor,
} from '../types';

import {
  context,
} from './types';

const Model = NextModel<any>();

describe('NextModel', () => {
  //#region Static properties
  describe('.modelName', () => {
    let Klass: typeof Model;
    let modelName: string = 'Foo';

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

  describe('.lowerModelName', () => {
    let Klass: typeof Model;
    let modelName: string = 'Foo';

    const subject = () => Klass.lowerModelName;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
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
            test('returns the name of the model with starting lowercase', () => {
              expect(subject()).toEqual(modelName.toLowerCase());
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

  describe('.strictSchema', () => {
    let Klass: typeof Model;
    let schema: Schema<any> = { foo: { type: 'bar' } };

    const subject = () => Klass.strictSchema;

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
            test('returns the schema with filled properties', () => {
              expect('defaultValue' in schema.foo).toBeFalsy();
              expect(subject()).toEqual(schema);
              expect('defaultValue' in subject().foo).toBeTruthy();
            });
          },
        });
      },
    });
  });

  describe('.filter', () => {
    let Klass: typeof Model;
    let filter: Filter<any> = { $not: { foo: 'bar' } };

    const subject = () => Klass.filter;

    context('filter is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        test('returns undefined filter', () => {
          expect(subject()).toBeUndefined();
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get filter(): Filter<any> {
                return filter;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the filter of the model', () => {
              expect(subject()).toEqual(filter);
            });
          },
        });
      },
    });
  });


  describe('.strictFilter', () => {
    let Klass: typeof Model;
    let filter: Filter<any> = { $not: { foo: 'bar' } };

    const subject = () => Klass.strictFilter;

    context('filter is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        test('returns empty filter', () => {
          expect(subject()).toEqual({});
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get filter(): Filter<any> {
                return filter;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the strict filter of the model', () => {
              expect(subject()).toEqual(filter);
            });
          },
        });
      },
    });
  });

  describe('.limit', () => {
    pending('[TODO]');
  });

  describe('.skip', () => {
    pending('[TODO]');
  });
  //#endregion

  // Relations
  describe('.belongsTo', () => {
    pending('[TODO]');
  });

  describe('.strictBelongsTo', () => {
    pending('[TODO]');
  });

  describe('.hasOne', () => {
    pending('[TODO]');
  });

  describe('.strictHasOne', () => {
    pending('[TODO]');
  });

  describe('.hasMany', () => {
    pending('[TODO]');
  });

  describe('.strictHasMany', () => {
    pending('[TODO]');
  });

  // Queries
  describe('.query', () => {
    pending('[TODO]');
  });

  describe('.queryBy', () => {
    pending('[TODO]');
  });

  describe('.first', () => {
    pending('[TODO]');
  });

  describe('.find', () => {
    pending('[TODO]');
  });

  describe('.findBy', () => {
    pending('[TODO]');
  });
});

