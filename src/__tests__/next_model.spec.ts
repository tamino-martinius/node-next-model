import {
  PropertyNotDefinedError,
  NextModel,
} from '../next_model';

import {
  BelongsTo,
  HasOne,
  HasMany,
  Filter,
  Schema,
  ModelConstructor,
} from '../types';

import {
  context,
} from './types';

import {
  Faker,
} from '../__mocks__/next_model';

const Model = NextModel<any>();

describe('NextModel', () => {
  //#region Static properties
  describe('.modelName', () => {
    let Klass: typeof Model;
    let modelName: string = Faker.modelName;

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
    let modelName: string = Faker.modelName;

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
    let schema: Schema<any> = Faker.schema;

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
    let schema: Schema<any> = Faker.schema;

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
              expect(subject()).toEqual(schema);
              for (const key in schema) {
                expect('defaultValue' in subject()[key]).toBeTruthy();
              }
            });
          },
        });
      },
    });
  });

  describe('.filter', () => {
    let Klass: typeof Model = Faker.model;
    let filter: Filter<any> = Faker.filter;

    const subject = () => Klass.filter;

    test('returns empty filter', () => {
      expect(subject()).toEqual({});
    });

    context('when filter is present', {
      definitions() {
        class NewKlass extends Klass {
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
  });

  describe('.strictFilter', () => {
    let Klass: typeof Model = Faker.model;
    let filter: Filter<any> = Faker.filter;

    const subject = () => Klass.strictFilter;

    test('returns empty filter', () => {
      expect(subject()).toEqual({});
    });

    context('when filter is present', {
      definitions() {
        class NewKlass extends Klass {
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
  });

  describe('.limit', () => {
    let Klass: typeof Model = Faker.model;
    let limit: number = Faker.limit;

    const subject = () => Klass.limit;

    test('returns maximum limit', () => {
      expect(subject()).toEqual(Number.MAX_SAFE_INTEGER);
    });

    context('when limit is present', {
      definitions() {
        class NewKlass extends Klass {
          static get limit(): number {
            return limit;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the limit of the model', () => {
          expect(subject()).toEqual(limit);
        });
      },
    });
  });

  describe('.skip', () => {
    let Klass: typeof Model = Faker.model;
    let skip: number = Faker.skip;

    const subject = () => Klass.skip;

    test('returns maximum skip', () => {
      expect(subject()).toEqual(0);
    });

    context('when skip is present', {
      definitions() {
        class NewKlass extends Klass {
          static get skip(): number {
            return skip;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the skip of the model', () => {
          expect(subject()).toEqual(skip);
        });
      },
    });
  });
  //#endregion

  // Relations
  describe('.belongsTo', () => {
    let Klass: typeof Model = Faker.model;
    let belongsTo: BelongsTo = Faker.belongsTo;

    const subject = () => Klass.belongsTo;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get belongsTo(): BelongsTo {
            return belongsTo;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          expect(subject()).toEqual(belongsTo);
        });
      },
    });
  });

  describe('.strictBelongsTo', () => {
    let Klass: typeof Model = Faker.model;
    let belongsTo: BelongsTo = Faker.belongsTo;

    const subject = () => Klass.strictBelongsTo;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get belongsTo(): BelongsTo {
            return belongsTo;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          for (const key in belongsTo) {
            expect(subject()[key].model).toEqual(belongsTo[key].model);
            if (belongsTo[key].foreignKey === undefined) {
              expect('foreignKey' in subject()[key]).toBeTruthy();
            }
          }
        });
      },
    });
  });

  describe('.hasOne', () => {
    let Klass: typeof Model = Faker.model;
    let hasOne: HasOne = Faker.hasOne;

    const subject = () => Klass.hasOne;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get hasOne(): HasOne {
            return hasOne;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          expect(subject()).toEqual(hasOne);
        });
      },
    });
  });

  describe('.strictHasOne', () => {
    let Klass: typeof Model = Faker.model;
    let hasOne: HasOne = Faker.hasOne;

    const subject = () => Klass.strictHasOne;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get hasOne(): HasOne {
            return hasOne;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          for (const key in hasOne) {
            expect(subject()[key].model).toEqual(hasOne[key].model);
            if (hasOne[key].foreignKey === undefined) {
              expect('foreignKey' in subject()[key]).toBeTruthy();
            }
          }
        });
      },
    });
  });

  describe('.hasMany', () => {
    let Klass: typeof Model = Faker.model;
    let hasMany: HasMany = Faker.hasMany;

    const subject = () => Klass.hasMany;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get hasMany(): HasMany {
            return hasMany;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          expect(subject()).toEqual(hasMany);
        });
      },
    });
  });

  describe('.strictHasMany', () => {
    let Klass: typeof Model = Faker.model;
    let hasMany: HasMany = Faker.hasMany;

    const subject = () => Klass.strictHasMany;

    test('returns empty relation', () => {
      expect(subject()).toEqual({});
    });

    context('when relation is present', {
      definitions() {
        class NewKlass extends Klass {
          static get hasMany(): HasMany {
            return hasMany;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('returns the strict relation of the model', () => {
          for (const key in hasMany) {
            expect(subject()[key].model).toEqual(hasMany[key].model);
            if (hasMany[key].foreignKey === undefined) {
              expect('foreignKey' in subject()[key]).toBeTruthy();
            }
          }
        });
      },
    });
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

