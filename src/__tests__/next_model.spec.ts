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
  //#region Static
  //#region Properties
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
        it('throws Error', () => {
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
            it('returns the name of the model', () => {
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
        it('throws Error', () => {
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
            it('returns the name of the model with starting lowercase', () => {
              expect(subject()).toEqual(modelName.toLowerCase());
            });
          },
        });
      },
    });
  });

  describe('.identifier', () => {
    pending('[TODO]');
  });

  describe('.collectionName', () => {
    pending('[TODO]');
  });

  describe('.connector', () => {
    pending('[TODO]');
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
        it('throws Error', () => {
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
            it('returns the schema of the model', () => {
              expect(subject()).toEqual(schema);
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

    it('returns empty filter', () => {
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
        it('returns the filter of the model', () => {
          expect(subject()).toEqual(filter);
        });
      },
    });
  });

  describe('.limit', () => {
    let Klass: typeof Model = Faker.model;
    let limit: number = Faker.limit;

    const subject = () => Klass.limit;

    it('returns maximum limit', () => {
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
        it('returns the limit of the model', () => {
          expect(subject()).toEqual(limit);
        });
      },
    });
  });

  describe('.skip', () => {
    let Klass: typeof Model = Faker.model;
    let skip: number = Faker.skip;

    const subject = () => Klass.skip;

    it('returns maximum skip', () => {
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
        it('returns the skip of the model', () => {
          expect(subject()).toEqual(skip);
        });
      },
    });
  });

  describe('.order', () => {
    pending('[TODO]');
  });

  describe('.keys', () => {
    pending('[TODO]');
  });
  //#endregion

  //#region Relations
  describe('.belongsTo', () => {
    let Klass: typeof Model = Faker.model;
    let belongsTo: BelongsTo = Faker.belongsTo;

    const subject = () => Klass.belongsTo;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
          expect(subject()).toEqual(belongsTo);
        });
      },
    });
  });

  describe('.hasOne', () => {
    let Klass: typeof Model = Faker.model;
    let hasOne: HasOne = Faker.hasOne;

    const subject = () => Klass.hasOne;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
          expect(subject()).toEqual(hasOne);
        });
      },
    });
  });

  describe('.hasMany', () => {
    let Klass: typeof Model = Faker.model;
    let hasMany: HasMany = Faker.hasMany;

    const subject = () => Klass.hasMany;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
          expect(subject()).toEqual(hasMany);
        });
      },
    });
  });

  describe('.validators', () => {
    pending('[TODO]');
  });
  //#endregion

  //#region Strict
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
        it('throws Error', () => {
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
            it('returns the schema with filled properties', () => {
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

  describe('.strictFilter', () => {
    let Klass: typeof Model = Faker.model;
    let filter: Filter<any> = Faker.filter;

    const subject = () => Klass.strictFilter;

    it('returns empty filter', () => {
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
        it('returns the strict filter of the model', () => {
          expect(subject()).toEqual(filter);
        });
      },
    });
  });

  describe('.strictBelongsTo', () => {
    let Klass: typeof Model = Faker.model;
    let belongsTo: BelongsTo = Faker.belongsTo;

    const subject = () => Klass.strictBelongsTo;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
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

  describe('.strictHasOne', () => {
    let Klass: typeof Model = Faker.model;
    let hasOne: HasOne = Faker.hasOne;

    const subject = () => Klass.strictHasOne;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
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

  describe('.strictHasMany', () => {
    let Klass: typeof Model = Faker.model;
    let hasMany: HasMany = Faker.hasMany;

    const subject = () => Klass.strictHasMany;

    it('returns empty relation', () => {
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
        it('returns the strict relation of the model', () => {
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
  //#endregion

  //#region Queries
  describe('.limitBy(amount)', () => {
    let Klass: typeof Model = Faker.model;
    let limit: number = Faker.limit;

    const subject = () => Klass.limitBy(limit);

    it('changes limit for new scope and keeps old scope unchanged', () => {
      expect(subject().limit).toEqual(limit);
      expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('.unlimited', () => {
    let Klass: typeof Model = Faker.model;
    let limit: number = Faker.limit;

    const subject = () => Klass.unlimited;

    it('changes limit to default', () => {
      expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
      expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
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
        it('changes limit for new scope and keeps old scope unchanged', () => {
          expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
          expect(Klass.limit).toEqual(limit);
        });
      },
    });
  });

  describe('.skipBy(amount)', () => {
    let Klass: typeof Model = Faker.model;
    let skip: number = Faker.skip;

    const subject = () => Klass.skipBy(skip);

    it('changes skip for new scope and keeps old scope unchanged', () => {
      expect(subject().skip).toEqual(skip);
      expect(Klass.skip).toEqual(0);
    });
  });

  describe('.unskipped', () => {
    let Klass: typeof Model = Faker.model;
    let skip: number = Faker.skip;

    const subject = () => Klass.unskipped;

    it('changes skip to default', () => {
      expect(subject().skip).toEqual(0);
      expect(Klass.skip).toEqual(0);
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
        it('changes skip for new scope and keeps old scope unchanged', () => {
          expect(subject().skip).toEqual(0);
          expect(Klass.skip).toEqual(skip);
        });
      },
    });
  });

  describe('.orderBy(order)', () => {
    pending('[TODO]');
  });

  describe('.reorder(order)', () => {
    pending('[TODO]');
  });

  describe('.unordered', () => {
    pending('[TODO]');
  });

  describe('.query(query)', () => {
    pending('[TODO]');
  });

  describe('.queryBy', () => {
    pending('[TODO]');
  });

  describe('.unfiltered', () => {
    pending('[TODO]');
  });

  describe('.all', () => {
    pending('[TODO]');
  });

  describe('.updateAll(attrs)', () => {
    pending('[TODO]');
  });

  describe('.deleteAll()', () => {
    pending('[TODO]');
  });

  describe('.inBatchesOf(amount)', () => {
    pending('[TODO]');
  });

  describe('.first', () => {
    pending('[TODO]');
  });

  describe('.find(query)', () => {
    pending('[TODO]');
  });

  describe('.findBy', () => {
    pending('[TODO]');
  });

  describe('.count', () => {
    pending('[TODO]');
  });
  //#endregion

  //#region Creating Instances
  describe('.new(attrs)', () => {
    pending('[TODO]');
  });

  describe('.build(attrs)', () => {
    pending('[TODO]');
  });

  describe('.create(attrs)', () => {
    pending('[TODO]');
  });
  //#endregion
  //#endregion

  //#region Instance
  //#region Properites
  describe('#id', () => {
    pending('[TODO]');
  });

  describe('#model', () => {
    pending('[TODO]');
  });

  describe('#attributes', () => {
    pending('[TODO]');
  });

  describe('#persistentAttributes', () => {
    pending('[TODO]');
  });

  describe('#isNew', () => {
    pending('[TODO]');
  });

  describe('#isPersistent', () => {
    pending('[TODO]');
  });

  describe('#isChanged', () => {
    pending('[TODO]');
  });

  describe('#isValid', () => {
    pending('[TODO]');
  });

  describe('#changes', () => {
    pending('[TODO]');
  });
  //#endregion

  //#region Manipulation
  describe('#assign(attrs)', () => {
    pending('[TODO]');
  });

  describe('#revertChange(key)', () => {
    pending('[TODO]');
  });

  describe('#revertChanges()', () => {
    pending('[TODO]');
  });
  //#endregion

  //#region Storage
  describe('#save()', () => {
    pending('[TODO]');
  });

  describe('#delete()', () => {
    pending('[TODO]');
  });

  describe('#reload()', () => {
    pending('[TODO]');
  });
  //#endregion
  //#endregion
});

