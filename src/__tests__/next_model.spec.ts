import {
  PropertyNotDefinedError,
  NextModel,
} from '../next_model';

import Connector from '../connector';

import {
  BelongsTo,
  HasOne,
  HasMany,
  Filter,
  Schema,
  ModelConstructor,
  Order,
  Validator,
} from '../types';

import {
  context,
  it,
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

  describe('.underscoreModelName', () => {
    let Klass: typeof Model;
    let modelName: string = Faker.modelName;
    const subject = () => Klass.underscoreModelName;

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

            context('when modelName has multiple uppercase letters', {
              definitions() {
                class NewKlass extends NextModel<any>() {
                  static get modelName(): string {
                    return modelName + modelName;
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('seperates both parts with underscore', () => {
                const name = modelName.toLowerCase() + '_' + modelName.toLowerCase();
                  expect(subject()).toEqual(name);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.pluralModelName', () => {
    let Klass: typeof Model;
    let modelName: string = Faker.modelName;
    const subject = () => Klass.pluralModelName;

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
                return 'Foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns the plural name of the model with starting lowercase', () => {
              expect(subject()).toEqual('foos');
            });

            context('when modelName has multiple uppercase letters', {
              definitions() {
                class NewKlass extends NextModel<any>() {
                  static get modelName(): string {
                    return modelName + modelName;
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('seperates both parts with underscore', () => {
                  expect(subject()).toMatch(modelName.toLowerCase() + '_');
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.identifier', () => {
    let Klass: typeof Model;
    let identifier: string = Faker.identifier;

    const subject = () => Klass.identifier;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('returns `id` as default', () => {
          expect(subject()).toEqual('id');
        });

        context('when identifier is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get identifier(): string {
                return identifier;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns the name of the model', () => {
              expect(subject()).toEqual(identifier);
            });
          },
        });
      },
    });
  });

  describe('.collectionName', () => {
    let Klass: typeof Model;
    let collectionName: string = Faker.collectionName;

    const subject = () => Klass.collectionName;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('is undefined by default', () => {
          expect(subject()).toBeUndefined();
        });

        context('when collectionName is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get collectionName(): string {
                return collectionName;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns the name of the model', () => {
              expect(subject()).toEqual(collectionName);
            });
          },
        });
      },
    });
  });

  describe('.connector', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;

    const subject = () => Klass.connector;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('is a connector by default', () => {
          expect(subject()).toBeInstanceOf(Connector);
        });

        context('when connector is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get connector(): Connector<any> {
                return connector;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns the name of the model', () => {
              expect(subject()).toEqual(connector);
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
    let Klass: typeof Model;
    let order: Partial<Order<any>>[] = Faker.order;

    const subject = () => Klass.order;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array by default', () => {
          expect(subject()).toEqual([]);
        });

        context('when order is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get order(): Partial<Order<any>>[] {
                return order;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns the name of the model', () => {
              expect(subject()).toEqual(order);
            });
          },
        });
      },
    });
  });

  describe('.keys', () => {
    let Klass: typeof Model;
    let schema: Schema<any> = Faker.schema;

    const subject = () => Klass.keys;

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
            it('returns the schema keys of the model', () => {
              expect(subject()).toEqual(Object.keys(schema));
            });
          },
        });
      },
    });
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
    let Klass: typeof Model = Faker.model;
    let validators: Validator<any>[] = Faker.validators;

    const subject = () => Klass.validators;

    it('returns empty validators', () => {
      expect(subject()).toEqual([]);
    });

    context('when validators is present', {
      definitions() {
        class NewKlass extends Klass {
          static get validators(): Validator<any>[] {
            return validators;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns the validators of the model', () => {
          expect(subject()).toEqual(validators);
        });
      },
    });
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
    let Klass: typeof Model;
    let order: Partial<Order<any>>[] = Faker.order;
    let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

    const subject = () => Klass.orderBy(orderItem);

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('returns order item as array', () => {
          expect(subject().order).toEqual([orderItem]);
        });

        context('when order is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get order(): Partial<Order<any>>[] {
                return order;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('adds order item to existing order', () => {
              expect(subject().order).toEqual([...order, orderItem]);
            });
          },
        });
      },
    });
  });

  describe('.reorder(order)', () => {
    let Klass: typeof Model;
    let order: Partial<Order<any>>[] = Faker.order;
    let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

    const subject = () => Klass.reorder(orderItem);

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('returns order item as array', () => {
          expect(subject().order).toEqual([orderItem]);
        });

        context('when order is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get order(): Partial<Order<any>>[] {
                return order;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('removes current order and returns order item as array', () => {
              expect(subject().order).toEqual([orderItem]);
            });
          },
        });
      },
    });
  });

  describe('.unordered', () => {
    let Klass: typeof Model;
    let order: Partial<Order<any>>[] = Faker.order;

    const subject = () => Klass.unordered;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty order', () => {
          expect(subject().order).toEqual([]);
        });

        context('when order is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get order(): Partial<Order<any>>[] {
                return order;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('returns empty order', () => {
              expect(subject().order).toEqual([]);
            });
          },
        });
      },
    });
  });

  describe('.query(filter)', () => {
    let Klass: typeof Model;
    let filter: Filter<any> = Faker.filter;

    const subject = () => Klass.query(filter);

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('sets filter and returns model', () => {
          expect(subject().filter).toEqual(filter);
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get filter(): Filter<any> {
                return { id: 1 };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('adds filter to existing filter and returns model', () => {
              expect(subject().filter).toEqual({ $and: [
                filter,
                { id: 1 },
              ]});
            });
          },
        });
      },
    });
  });

  describe('.onlyQuery(filter)', () => {
    let Klass: typeof Model;
    let filter: Filter<any> = Faker.filter;

    const subject = () => Klass.onlyQuery(filter);

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('sets filter and returns model', () => {
          expect(subject().filter).toEqual(filter);
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get filter(): Filter<any> {
                return { id: 1 };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('sets filter and returns model', () => {
              expect(subject().filter).toEqual(filter);
            });
          },
        });
      },
    });
  });

  describe('.queryBy', () => {
    let Klass: typeof Model;
    let ids: number | number[] = 2;

    const subject = () => Klass.queryBy.id(ids);

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model { };
        Klass = NewKlass;
      },
      tests() {
        it('sets filter and returns model', () => {
          expect(subject().filter).toEqual({ id: 2 });
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends Klass {
              static get filter(): Filter<any> {
                return { id: 1 };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('adds filter to existing filter and returns model', () => {
              expect(subject().filter).toEqual({
                $and: [
                  { id: 2 },
                  { id: 1 },
                ]
              });
            });
          },
        });
      },
    });

    context('when passing array of values', {
      definitions() {
        ids = [1, 2]
      },
      tests() {
        context('model is not extended', {
          definitions() {
            class NewKlass extends Faker.model { };
            Klass = NewKlass;
          },
          tests() {
            it('sets filter and returns model', () => {
              expect(subject().filter).toEqual({ $in: { id: [1, 2] } });
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 1 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('adds filter to existing filter and returns model', () => {
                  expect(subject().filter).toEqual({
                    $and: [
                      { $in: { id: [1, 2] } },
                      { id: 1 },
                    ]
                  });
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.unfiltered', () => {
    let Klass: typeof Model;

    const subject = () => Klass.unfiltered;

    context('model is not extended', {
      definitions() {
        class NewKlass extends NextModel<any>() { };
        Klass = NewKlass;
      },
      tests() {
        it('sets filter to empty and returns model', () => {
          expect(subject().filter).toEqual({});
        });

        context('when filter is present', {
          definitions() {
            class NewKlass extends NextModel<any>() {
              static get filter(): Filter<any> {
                return { id: 1 };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            it('sets filter to empty and returns model', () => {
              expect(subject().filter).toEqual({});
            });
          },
        });
      },
    });
  });

  describe('.all', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance: ModelConstructor<any>;

    const subject = () => Klass.all;

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const data = await subject();
          expect(data).toEqual([]);
        });

        context('when data is present', {
          async definitions() {
            instance = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const data = await subject();
              const attrArr = data.map(instance => instance.attributes);
              expect(attrArr).toEqual([instance.attributes]);
              expect(data[0]).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const data = await subject();
                  expect(data).toEqual([]);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.updateAll(attrs)', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    const attrs = { test: 1 };
    let instance: ModelConstructor<any>;

    const subject = () => Klass.updateAll(attrs);

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get schema() {
            const schema = super.schema;
            schema.test = { type: 'number' };
            return schema;
          }

          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const model = await subject();
          const data = await model.all;
          expect(data).toEqual([]);
        });

        context('when data is present', {
          async definitions() {
            instance = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const model = await subject();
              const data = await model.all;
              const attrArr = data.map(instance => instance.attributes);
              const attributes = instance.attributes;
              attributes.test = 1;
              expect(attrArr).toEqual([attributes]);
              expect(data[0]).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const model = await subject();
                  const data = await model.all;
                  expect(data).toEqual([]);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.deleteAll()', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance: ModelConstructor<any>;

    const subject = () => Klass.deleteAll();

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const model = await subject();
          const data = await model.all;
          expect(data).toEqual([]);
        });

        context('when data is present', {
          async definitions() {
            instance = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const model = await subject();
              const data = await model.all;
              expect(data).toEqual([]);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const model = await subject();
                  const data = await model.all;
                  expect(data).toEqual([]);
                  const allData = await Klass.unfiltered.all;
                  expect(allData.map(instance => instance.attributes))
                    .toEqual([instance.attributes]);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.inBatchesOf(amount)', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance1: ModelConstructor<any>;
    let instance2: ModelConstructor<any>;
    let amount = 1;

    const subject = () => Klass.inBatchesOf(amount);

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const dataPromises = await subject();
          const datas = await Promise.all(dataPromises);
          expect(datas).toEqual([]);
        });

        context('when data is present', {
          async definitions() {
            instance1 = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const dataPromises = await subject();
              const datas = await Promise.all(dataPromises);
              expect(datas.length).toEqual(1);
              const attrArr = datas[0].map(instance => instance.attributes);
              expect(attrArr).toEqual([instance1.attributes]);
              expect(datas[0][0]).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const dataPromises = await subject();
                  const datas = await Promise.all(dataPromises);
                  expect(datas).toEqual([]);
                });
              },
            });

            context('when multiple data', {
              async definitions() {
                instance2 = await Klass.create({});
              },
              tests() {
                it('calls connector with model', async () => {
                  const dataPromises = await subject();
                  const datas = await Promise.all(dataPromises);
                  expect(datas.length).toEqual(2);
                  const attrArr1 = datas[0].map(instance => instance.attributes);
                  expect(attrArr1).toEqual([instance1.attributes]);
                  const attrArr2 = datas[1].map(instance => instance.attributes);
                  expect(attrArr2).toEqual([instance2.attributes]);
                  expect(datas[0][0]).toBeInstanceOf(Klass);
                  expect(datas[1][0]).toBeInstanceOf(Klass);
                });

                context('when amount is 2', {
                  definitions() {
                    amount = 2;
                  },
                  tests() {
                    it('filters data', async () => {
                      const dataPromises = await subject();
                      const datas = await Promise.all(dataPromises);
                      expect(datas.length).toEqual(1);
                      expect(datas[0].length).toEqual(2);
                      const attrArr = datas[0].map(instance => instance.attributes);
                      expect(attrArr).toEqual([
                        instance1.attributes,
                        instance2.attributes,
                      ]);
                      expect(datas[0][0]).toBeInstanceOf(Klass);
                      expect(datas[0][1]).toBeInstanceOf(Klass);
                    });
                  },
                });

                context('when filter is present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get filter(): Filter<any> {
                        return { id: 0 };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    it('filters data', async () => {
                      const dataPromises = await subject();
                      const datas = await Promise.all(dataPromises);
                      expect(datas).toEqual([]);
                    });
                  },
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.first', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance1: ModelConstructor<any>;
    let instance2: ModelConstructor<any>;

    const subject = () => Klass.first;

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const instance = await subject();
          expect(instance).toBeUndefined();
        });

        context('when data is present', {
          async definitions() {
            instance1 = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const instance = await subject();
              expect(instance.attributes).toEqual(instance1.attributes);
              expect(instance).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const instance = await subject();
                  expect(instance).toBeUndefined();
                });
              },
            });

            context('when multiple data', {
              async definitions() {
                instance2 = await Klass.create({});
              },
              tests() {
                it('calls connector with model', async () => {
                  const instance = await subject();
                  expect(instance.attributes).toEqual(instance1.attributes);
                  expect(instance).toBeInstanceOf(Klass);
                });

                context('when filter is present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get filter(): Filter<any> {
                        return { id: 0 };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    it('filters data', async () => {
                      const instance = await subject();
                      expect(instance).toBeUndefined();
                    });
                  },
                });
              },
            });

          },
        });
      },
    });
  });

  describe('.find(query)', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance1: ModelConstructor<any>;
    let instance2: ModelConstructor<any>;
    let query = {};

    const subject = () => Klass.find(query);

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const instance = await subject();
          expect(instance).toBeUndefined();
        });

        context('when data is present', {
          async definitions() {
            instance1 = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const instance = await subject();
              expect(instance.attributes).toEqual(instance1.attributes);
              expect(instance).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const instance = await subject();
                  expect(instance).toBeUndefined();
                });
              },
            });

            context('when multiple data', {
              async definitions() {
                instance2 = await Klass.create({});
              },
              tests() {
                it('calls connector with model', async () => {
                  const instance = await subject();
                  expect(instance.attributes).toEqual(instance1.attributes);
                  expect(instance).toBeInstanceOf(Klass);
                });

                context('when non matching filter is present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get filter(): Filter<any> {
                        return { id: 0 };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    it('filters data', async () => {
                      const instance = await subject();
                      expect(instance).toBeUndefined();
                    });
                  },
                });

                context('when matching filter is present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get filter(): Filter<any> {
                        return { id: instance2.id };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    it('filters data', async () => {
                      const instance = await subject();
                      expect(instance.attributes).toEqual(instance2.attributes);
                      expect(instance).toBeInstanceOf(Klass);
                    });

                    context('when query is present', {
                      definitions() {
                        query = { id: 0 };
                      },
                      tests() {
                        it('filters data', async () => {
                          const instance = await subject();
                          expect(instance).toBeUndefined();
                        });
                      },
                    });
                  },
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.findBy', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance1: ModelConstructor<any>;
    let instance2: ModelConstructor<any>;
    let query = () => instance1 ? instance1.id : 0;

    const subject = () => Klass.findBy.id(query());

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const instance = await subject();
          expect(instance).toBeUndefined();
        });

        context('when data is present', {
          async definitions() {
            instance1 = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const instance = await subject();
              expect(instance.attributes).toEqual(instance1.attributes);
              expect(instance).toBeInstanceOf(Klass);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const instance = await subject();
                  expect(instance).toBeUndefined();
                });
              },
            });

            context('when multiple data', {
              async definitions() {
                instance2 = await Klass.create({});
              },
              tests() {
                it('calls connector with model', async () => {
                  const instance = await subject();
                  expect(instance.attributes).toEqual(instance1.attributes);
                  expect(instance).toBeInstanceOf(Klass);
                });

                context('when filter is present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get filter(): Filter<any> {
                        return { id: instance2.id };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    it('filters data', async () => {
                      const instance = await subject();
                      expect(instance).toBeUndefined();
                    });
                  },
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.count', () => {
    let Klass: typeof Model;
    let connector: Connector<any> = Faker.connector;
    let instance: ModelConstructor<any>;

    const subject = () => Klass.count;

    context('model is not extended', {
      definitions() {
        class NewKlass extends Faker.model {
          static get connector() {
            return connector;
          }
        };
        Klass = NewKlass;
      },
      tests() {
        it('returns empty array', async () => {
          const count = await subject();
          expect(count).toEqual(0);
        });

        context('when data is present', {
          async definitions() {
            instance = await Klass.create({});
          },
          tests() {
            it('calls connector with model', async () => {
              const count = await subject();
              expect(count).toEqual(1);
            });

            context('when filter is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get filter(): Filter<any> {
                    return { id: 0 };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                it('filters data', async () => {
                  const count = await subject();
                  expect(count).toEqual(0);
                });
              },
            });
          },
        });
      },
    });
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

