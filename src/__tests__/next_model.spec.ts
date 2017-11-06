import {
  Model,
  NextModel,
  Schema,
  BelongsTo,
  HasMany,
  HasOne,
  Validator,
  Validators,
  PromiseCallback,
  SyncCallback,
  PromiseCallbackKeys,
  SyncCallbackKeys,
  Query,
  Order,
  Callbacks,
  Attributes,
  PropertyNotDefinedError,
  LowerBoundsError,
  MinLengthError,
  TypeError,
} from '../next_model';

import {
  Connector,
  DefaultConnector,
} from '../connector';

import {
  context,
} from './types';

import {
  User,
} from '../__mocks__/next_model';

// Have a user seeded in his local db

const seededUserDb: () => Promise<NextModel> = () => {
  return User.dbConnector.first(User)
  .then(user => {
    if (user !== undefined) {
      return User.dbConnector.delete(user);
    }
    return Promise.resolve(user);
  }).then(() => {
    return User.dbConnector.create(User.build({
      firstName: 'Seeded',
      lastName: 'User',
    }));
  });
};

describe('NextModel', () => {
  // Static properties

  // - must be inherited
  describe('.modelName', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.modelName;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when modelName is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get modelName(): string {
                return 'foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the name of the model', () => {
              expect(subject()).toEqual('foo');
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('reflects name from class', () => {
          expect(subject()).toEqual('NewKlass');
        });

        context('when modelName is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get modelName(): string {
                return 'foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the name of the model', () => {
              expect(subject()).toEqual('foo');
            });

            context('when modelName is empty string', {
              definitions() {},
              tests() {
                test('throws MinLengthError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get modelName(): string {
                        return '';
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(MinLengthError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.smallModelName', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.smallModelName;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('reflects name from class', () => {
          expect(subject()).toEqual('newKlass');
        });

        context('when modelName is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get modelName(): string {
                return 'Foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the name of the model', () => {
              expect(subject()).toEqual('foo');
            });

            context('when modelName is empty string', {
              definitions() { },
              tests() {
                test('throws MinLengthError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get modelName(): string {
                        return '';
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(MinLengthError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.identifier', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.identifier;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when identifier is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get identifier(): string {
                return 'foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the identifier of the model', () => {
              expect(subject()).toEqual('foo');
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default identifier', () => {
          expect(subject()).toEqual('id');
        });
        test('adds identifier to schema', () => {
          expect(Klass.schema).toEqual({ id: { type: 'integer' }});
        });

        context('when identifier is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get identifier(): string {
                return 'foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the identifier of the model', () => {
              expect(subject()).toEqual('foo');
            });
            test('adds identifier to schema', () => {
              expect(Klass.schema).toEqual({ foo: { type: 'integer' }});
            });

            context('when identifier is empty string', {
              definitions() {},
              tests() {
                test('throws MinLengthError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get identifier(): string {
                        return '';
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(MinLengthError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.dbConnector', () => {
    let Klass: typeof NextModel;
    const dbConnector: Connector = new (class Connector extends DefaultConnector {})();
    const subject = () => Klass.dbConnector;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when dbConnector is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get dbConnector(): Connector {
                return dbConnector;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the dbConnector of the model', () => {
              expect(subject()).toEqual(dbConnector);
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default dbConnector', () => {
          expect(subject()).toEqual(new DefaultConnector());
        });

        context('when dbConnector is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get dbConnector(): Connector {
                return dbConnector;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the dbConnector of the model', () => {
              expect(subject()).toEqual(dbConnector);
            });
          },
        });
      },
    });
  });

  describe('.attrAccessors', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.attrAccessors;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when attrAccessors is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get attrAccessors(): string[] {
                return ['foo'];
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the attrAccessors of the model', () => {
              expect(subject()).toEqual(['foo']);
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual([]);
        });

        context('when attrAccessors is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get attrAccessors(): string[] {
                return ['foo'];
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the attrAccessors of the model', () => {
              expect(subject()).toEqual(['foo']);
            });

            context('when attrAccessors is empty string', {
              definitions() {},
              tests() {
                test('throws MinLengthError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get attrAccessors(): string[] {
                        return [''];
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(MinLengthError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.schema', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.schema;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when schema is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: {type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the schema of the model', () => {
              expect(subject()).toEqual({ foo: { type: 'bar' }});
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({ id: { type: 'integer' }});
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the schema of the model', () => {
              expect(subject()).toEqual({
                id: { type: 'integer' },
                foo: { type: 'bar' },
              });
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the schema of the model', () => {
                  expect(subject()).toEqual({
                    id: { type: 'integer' },
                    foo: { type: 'bar' },
                    userId: { type: 'integer' },
                  });
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.belongsTo', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.belongsTo;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when belongsTo is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get belongsTo(): BelongsTo {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the belongsTo of the model', () => {
              expect(subject()).toEqual({ user: { model: User }});
            });

            context('when foreignKey is present', {
              definitions() {
                class NewKlass extends NextModel {
                  static get belongsTo(): BelongsTo {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the belongsTo of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({});
        });

        context('when belongsTo is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get belongsTo(): BelongsTo {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the belongsTo of the model and adds defaults', () => {
              expect(subject()).toEqual({ user: { model: User, foreignKey: 'userId' }});
            });

            context('when foreignKey is present', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get belongsTo(): BelongsTo {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the belongsTo of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.hasMany', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.hasMany;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when hasMany is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get hasMany(): HasMany {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the hasMany of the model and adds defaults', () => {
              expect(subject()).toEqual({ user: { model: User }});
            });

            context('when foreignKey is present', {
              definitions() {
                class NewKlass extends NextModel {
                  static get hasMany(): HasMany {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the hasMany of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({});
        });

        context('when hasMany is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get hasMany(): HasMany {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the hasMany of the model and adds defaults', () => {
              expect(subject()).toEqual({ user: { model: User, foreignKey: 'newKlassId' }});
            });

            context('when foreignKey is present', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get hasMany(): HasMany {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the hasMany of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });

          },
        });
      },
    });
  });

  describe('.hasOne', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.hasOne;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when hasOne is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get hasOne(): HasOne {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the hasOne of the model and adds defaults', () => {
              expect(subject()).toEqual({ user: { model: User }});
            });

            context('when foreignKey is present', {
              definitions() {
                class NewKlass extends NextModel {
                  static get hasOne(): HasOne {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the hasOne of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({});
        });

        context('when hasOne is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get hasOne(): HasOne {
                return { user: { model: User }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the hasOne of the model and adds defaults', () => {
              expect(subject()).toEqual({ user: { model: User, foreignKey: 'newKlassId' }});
            });

            context('when foreignKey is present', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get hasOne(): HasOne {
                    return { user: { model: User, foreignKey: 'foo' }};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the hasOne of the model', () => {
                  expect(subject()).toEqual({ user: { model: User, foreignKey: 'foo' }});
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.validators', () => {
    let Klass: typeof NextModel;
    let promiseValidator: Validator = jest.fn().mockReturnValue(Promise.resolve(true));
    const subject = () => Klass.validators;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when validators are present', {
          definitions() {
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return { foo: [promiseValidator]};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the validators of the model', () => {
              expect(subject()).toEqual({ foo: [promiseValidator]});
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({});
        });

        context('when validators are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return { foo: [promiseValidator]};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the validators of the model', () => {
              expect(subject()).toEqual({ foo: [promiseValidator]});
            });

            context('when validators are no array', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get validators(): Validators {
                    return { foo: promiseValidator};
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the validators of the model', () => {
                  expect(subject()).toEqual({ foo: [promiseValidator]});
                });
              },
            });

            context('when validators are mixed', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get validators(): Validators {
                    return {
                      foo: [promiseValidator],
                      bar: promiseValidator,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the validators of the model', () => {
                  expect(subject()).toEqual({
                    foo: [promiseValidator],
                    bar: [promiseValidator],
                  });
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.activeValidators', () => {
    let Klass: typeof NextModel;
    let promiseValidator: Validator = jest.fn().mockReturnValue(Promise.resolve(true));
    const subject = () => Klass.activeValidators;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({});
        });

        context('when validators are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  foo: [promiseValidator],
                  bar: promiseValidator,
                };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the validators of the model', () => {
              expect(subject()).toEqual({
                foo: [promiseValidator],
                bar: [promiseValidator],
              });
            });

            context('when validators are partially skipped', {
              definitions() {
                class NewKlass extends Klass {
                  static get skippedValidators(): string[] {
                    return ['foo'];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the active  validators of the model', () => {
                  expect(subject()).toEqual({
                    bar: [promiseValidator],
                  });
                });
              },
            });

            context('when validators are all skipped', {
              definitions() {
                class NewKlass extends Klass {
                  static get skippedValidators(): string[] {
                    return ['foo', 'bar'];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the active validators of the model', () => {
                  expect(subject()).toEqual({});
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.callbacks', () => {
    let Klass: typeof NextModel;
    let promiseCallback: PromiseCallback = jest.fn().mockReturnValue(Promise.resolve(true));
    let syncCallback: SyncCallback = jest.fn().mockReturnValue(true);
    const callbacks: Callbacks = {
      beforeSave: [promiseCallback],
      afterSave: [promiseCallback],
      beforeUpdate: [promiseCallback],
      afterUpdate: [promiseCallback],
      beforeDelete: [promiseCallback],
      afterDelete: [promiseCallback],
      beforeReload: [promiseCallback],
      afterReload: [promiseCallback],
      beforeAssign: [syncCallback],
      afterAssign: [syncCallback],
    };
    const subject = () => Klass.callbacks;


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when callbacks are present', {
          definitions() {
            class NewKlass extends NextModel {
              static get callbacks(): Callbacks {
                return callbacks;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the callbacks of the model', () => {
              expect(subject()).toEqual(callbacks);
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            beforeSave: [],
            afterSave: [],
            beforeUpdate: [],
            afterUpdate: [],
            beforeDelete: [],
            afterDelete: [],
            beforeReload: [],
            afterReload: [],
            beforeAssign: [],
            afterAssign: [],
          });
        });

        context('when callbacks are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get callbacks(): Callbacks {
                return callbacks;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the callbacks of the model', () => {
              expect(subject()).toEqual(callbacks);
            });

            context('when callbacks are undefined', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get callbacks(): Callbacks {
                    return {
                      beforeSave: undefined,
                      afterSave: undefined,
                      beforeUpdate: undefined,
                      afterUpdate: undefined,
                      beforeDelete: undefined,
                      afterDelete: undefined,
                      beforeReload: undefined,
                      afterReload: undefined,
                      beforeAssign: undefined,
                      afterAssign: undefined,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the callbacks of the model', () => {
                  expect(subject()).toEqual({
                    beforeSave: [],
                    afterSave: [],
                    beforeUpdate: [],
                    afterUpdate: [],
                    beforeDelete: [],
                    afterDelete: [],
                    beforeReload: [],
                    afterReload: [],
                    beforeAssign: [],
                    afterAssign: [],
                  });
                });
              },
            });

            context('when callbacks are no array', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get callbacks(): Callbacks {
                    return {
                      beforeSave: promiseCallback,
                      afterSave: promiseCallback,
                      beforeUpdate: promiseCallback,
                      afterUpdate: promiseCallback,
                      beforeDelete: promiseCallback,
                      afterDelete: promiseCallback,
                      beforeReload: promiseCallback,
                      afterReload: promiseCallback,
                      beforeAssign: syncCallback,
                      afterAssign: syncCallback,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the callbacks of the model', () => {
                  expect(subject()).toEqual(callbacks);
                });
              },
            });

            context('when callbacks are mixed', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get callbacks(): Callbacks {
                    return {
                      beforeSave: [promiseCallback],
                      afterSave: promiseCallback,
                      beforeUpdate: [promiseCallback],
                      afterUpdate: promiseCallback,
                      beforeDelete: [promiseCallback],
                      afterDelete: promiseCallback,
                      beforeReload: [promiseCallback],
                      afterReload: promiseCallback,
                      beforeAssign: [syncCallback],
                      afterAssign: syncCallback,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the callbacks of the model', () => {
                  expect(subject()).toEqual(callbacks);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.activeCallbacks', () => {
    let Klass: typeof NextModel;
    let promiseCallback: PromiseCallback = jest.fn().mockReturnValue(Promise.resolve(true));
    let syncCallback: SyncCallback = jest.fn().mockReturnValue(true);
    const callbacks: Callbacks = {
      beforeSave: [promiseCallback],
      afterSave: [promiseCallback],
      beforeUpdate: [promiseCallback],
      afterUpdate: [promiseCallback],
      beforeDelete: [promiseCallback],
      afterDelete: [promiseCallback],
      beforeReload: [promiseCallback],
      afterReload: [promiseCallback],
      beforeAssign: [syncCallback],
      afterAssign: [syncCallback],
    };
    const subject = () => Klass.activeCallbacks;


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            beforeSave: [],
            afterSave: [],
            beforeUpdate: [],
            afterUpdate: [],
            beforeDelete: [],
            afterDelete: [],
            beforeReload: [],
            afterReload: [],
            beforeAssign: [],
            afterAssign: [],
          });
        });

        context('when callbacks are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get callbacks(): Callbacks {
                return callbacks;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the callbacks of the model', () => {
              expect(subject()).toEqual(callbacks);
            });

            context('when callbacks are disabled', {
              definitions() {
                class NewKlass extends Klass {
                  static get skippedCallbacks(): (PromiseCallbackKeys | SyncCallbackKeys)[] {
                    return [
                      'beforeSave',
                      'afterSave',
                      'beforeUpdate',
                      'afterUpdate',
                      'beforeDelete',
                      'afterDelete',
                      'beforeReload',
                      'afterReload',
                      'beforeAssign',
                      'afterAssign',
                    ];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the active callbacks of the model', () => {
                  expect(subject()).toEqual({
                    beforeSave: [],
                    afterSave: [],
                    beforeUpdate: [],
                    afterUpdate: [],
                    beforeDelete: [],
                    afterDelete: [],
                    beforeReload: [],
                    afterReload: [],
                    beforeAssign: [],
                    afterAssign: [],
                  });
                });
              },
            });

            context('when callbacks partially disabled', {
              definitions() {
                class NewKlass extends Klass {
                  static get skippedCallbacks(): (PromiseCallbackKeys | SyncCallbackKeys)[] {
                    return [
                      'beforeSave',
                      'afterSave',
                      'beforeDelete',
                      'afterDelete',
                      'beforeReload',
                      'afterAssign',
                    ];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the active callbacks of the model', () => {
                  expect(subject()).toEqual({
                    beforeSave: [],
                    afterSave: [],
                    beforeUpdate: [promiseCallback],
                    afterUpdate: [promiseCallback],
                    beforeDelete: [],
                    afterDelete: [],
                    beforeReload: [],
                    afterReload: [promiseCallback],
                    beforeAssign: [syncCallback],
                    afterAssign: [],
                  });
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.skip', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.skip;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when skip is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get skip(): number {
                return 4711;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the skip of the model', () => {
              expect(subject()).toEqual(4711);
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default skip', () => {
          expect(subject()).toEqual(0);
        });

        context('when skip is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get skip(): number {
                return 4711;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the skip of the model', () => {
              expect(subject()).toEqual(4711);
            });

            context('when skip is below 0', {
              definitions() { },
              tests() {
                test('throws LowerBoundsError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get skip(): number {
                        return -4711;
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(LowerBoundsError);
                });
              },
            });

            context('when skip is floating point', {
              definitions() {},
              tests() {
                test('throws TypeError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get skip(): number {
                        return 47.11;
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(TypeError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.limit', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.limit;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when limit is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get limit(): number {
                return 4711;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the limit of the model', () => {
              expect(subject()).toEqual(4711);
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default limit', () => {
          expect(subject()).toEqual(Number.MAX_SAFE_INTEGER);
        });

        context('when limit is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get limit(): number {
                return 4711;
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the limit of the model', () => {
              expect(subject()).toEqual(4711);
            });

            context('when limit is below 0', {
              definitions() { },
              tests() {
                test('throws LowerBoundsError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get limit(): number {
                        return -4711;
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(LowerBoundsError);
                });
              },
            });

            context('when limit is floating point', {
              definitions() { },
              tests() {
                test('throws TypeError', () => {
                  expect(() => {
                    @Model
                    class NewKlass extends NextModel {
                      static get limit(): number {
                        return 47.11;
                      }
                    };
                    Klass = NewKlass;
                  }).toThrow(TypeError);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('.query', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when query is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'bar' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the query of the model', () => {
              expect(subject()).toEqual({ foo: 'bar' });
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default query', () => {
          expect(subject()).toEqual({});
        });

        context('when query is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'bar' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the query of the model', () => {
              expect(subject()).toEqual({ foo: 'bar' });
            });
          },
        });
      },
    });
  });

  describe('.order', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.order;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when order is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get order(): Order {
                return { foo: 'asc' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the order of the model', () => {
              expect(subject()).toEqual({ foo: 'asc' });
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default order', () => {
          expect(subject()).toEqual({});
        });

        context('when order is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get order(): Order {
                return { foo: 'asc' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the order of the model', () => {
              expect(subject()).toEqual({ foo: 'asc' });
            });
          },
        });
      },
    });
  });

  describe('.skippedValidators', () => {
    describe('.skippedValidators', () => {
      let Klass: typeof NextModel;
      const subject = () => Klass.skippedValidators;
  
      context('when decorator is not present', {
        definitions() {
          class NewKlass extends NextModel {};
          Klass = NewKlass;
        },
        tests() {
          test('throws PropertyNotDefinedError', () => {
            expect(subject).toThrow(PropertyNotDefinedError);
          });

          context('when skippedValidators is present', {
            definitions() {
              class NewKlass extends NextModel {
                static get skippedValidators(): string | string[] {
                  return ['foo'];
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedValidators of the model', () => {
                expect(subject()).toEqual(['foo']);
              });
            },
          });
        },
      });
  
      context('when decorator is present', {
        definitions() {
          @Model
          class NewKlass extends NextModel {};
          Klass = NewKlass;
        },
        tests() {
          test('returns default skippedValidators', () => {
            expect(subject()).toEqual([]);
          });

          context('when skippedValidators is array', {
            definitions() {
              @Model
              class NewKlass extends NextModel {
                static get skippedValidators(): string | string[] {
                  return ['foo'];
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedValidators of the model', () => {
                expect(subject()).toEqual(['foo']);
              });
            },
          });

          context('when skippedValidators is string', {
            definitions() {
              @Model
              class NewKlass extends NextModel {
                static get skippedValidators(): string | string[] {
                  return 'foo';
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedValidators of the model as array', () => {
                expect(subject()).toEqual(['foo']);
              });
            },
          });

          context('when skippedValidators is empty string', {
            definitions() { },
            tests() {
              test('throws MinLengthError', () => {
                expect(() => {
                  @Model
                  class NewKlass extends NextModel {
                    static get skippedValidators(): string | string[] {
                      return '';
                    }
                  };
                  Klass = NewKlass;
                }).toThrow(MinLengthError);
              });
            },
          });
        },
      });
    });
  });

  describe('.isValidatorSkipped(key)', () => {
    let Klass: typeof NextModel;
    let key: string = 'foo';
    const subject = () => Klass.isValidatorSkipped(key);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false', () => {
          expect(subject()).toBeFalsy();
        });

        context('when skipped validator is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get skippedValidators(): string | string[] {
                return 'foo';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when multiple skipped validators are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get skippedValidators(): string | string[] {
                return ['foo', 'bar'];
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when skipped validators are present but not matching', {
          definitions() {
            key = 'baz';
          },
          tests() {
            test('returns false', () => {
              expect(subject()).toBeFalsy();
            });
          },
        });
      },
    });
  });

  describe('.skippedCallbacks', () => {
    describe('.skippedCallbacks', () => {
      let Klass: typeof NextModel;
      const subject = () => Klass.skippedCallbacks;
  
      context('when decorator is not present', {
        definitions() {
          class NewKlass extends NextModel {};
          Klass = NewKlass;
        },
        tests() {
          test('throws PropertyNotDefinedError', () => {
            expect(subject).toThrow(PropertyNotDefinedError);
          });

          context('when skippedCallbacks is present', {
            definitions() {
              class NewKlass extends NextModel {
                static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
                  return ['beforeSave'];
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedCallbacks of the model', () => {
                expect(subject()).toEqual(['beforeSave']);
              });
            },
          });
        },
      });
  
      context('when decorator is present', {
        definitions() {
          @Model
          class NewKlass extends NextModel {};
          Klass = NewKlass;
        },
        tests() {
          test('returns default skippedCallbacks', () => {
            expect(subject()).toEqual([]);
          });

          context('when skippedCallbacks is array', {
            definitions() {
              @Model
              class NewKlass extends NextModel {
                static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
                  return ['beforeSave'];
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedCallbacks of the model', () => {
                expect(subject()).toEqual(['beforeSave']);
              });
            },
          });

          context('when skippedCallbacks is string', {
            definitions() {
              @Model
              class NewKlass extends NextModel {
                static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
                  return 'beforeSave';
                }
              };
              Klass = NewKlass;
            },
            tests() {
              test('returns the skippedCallbacks of the model as array', () => {
                expect(subject()).toEqual(['beforeSave']);
              });
            },
          });
        },
      });
    });
  });

  describe('.isCallbackSkipped(key)', () => {
    let Klass: typeof NextModel;
    let key: PromiseCallbackKeys | SyncCallbackKeys = 'beforeSave';
    const subject = () => Klass.isCallbackSkipped(key);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false', () => {
          expect(subject()).toBeFalsy();
        });

        context('when skipped callback is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
                return 'beforeSave';
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when multiple skipped callbacks are present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
                return ['beforeSave', 'afterSave'];
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when skipped callbacks are present but not matching', {
          definitions() {
            key = 'beforeUpdate';
          },
          tests() {
            test('returns false', () => {
              expect(subject()).toBeFalsy();
            });
          },
        });
      },
    });
  });

  describe('.keys', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.keys;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when schema is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: {type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('throws PropertyNotDefinedError', () => {
              expect(subject).toThrow(PropertyNotDefinedError);
            });

            context('when belongsTo relation is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('throws PropertyNotDefinedError', () => {
                  expect(subject).toThrow(PropertyNotDefinedError);
                });

                context('when attrAccessors are present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('throws PropertyNotDefinedError', () => {
                      expect(subject).toThrow(PropertyNotDefinedError);
                    });
                  },
                });
              },
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject().sort()).toEqual(['id'].sort());
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the keys of the schema', () => {
              expect(subject().sort()).toEqual(['id', 'foo'].sort());
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the keys of the belongsTo relation', () => {
                  expect(subject().sort()).toEqual(['id', 'foo', 'userId'].sort());
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns the keys of the attrAccessors', () => {
                      expect(subject().sort()).toEqual(['id', 'foo', 'userId', 'bar'].sort());
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

  describe('.hasKey(key)', () => {
    let Klass: typeof NextModel;
    let key: string = 'foo';
    const subject = () => Klass.hasKey(key);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false for any key', () => {
          expect(subject()).toBeFalsy();
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true when key is in schema', () => {
              expect(subject()).toBeTruthy();
            });

            context('when query for identifier key', {
              definitions() {
                key = Klass.identifier;
              },
              tests() {
                test('returns true', () => {
                  expect(subject()).toBeTruthy();
                });
              },
            });

            context('when query for relation key', {
              definitions() {
                key = 'userId';
              },
              tests() {
                test('returns false', () => {
                  expect(subject()).toBeFalsy();
                });

                context('when belongsTo relation is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get belongsTo(): BelongsTo {
                        return {
                          user: { model: User },
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns true', () => {
                      expect(subject()).toBeTruthy();
                    });
                  },
                });
              },
            });

            context('when query for accessor key', {
              definitions() {
                key = 'bar';
              },
              tests() {
                test('returns false', () => {
                  expect(subject()).toBeFalsy();
                });


                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns true', () => {
                      expect(subject()).toBeTruthy();
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

  describe('.dbKeys', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.dbKeys;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });

        context('when schema is present', {
          definitions() {
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: {type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('throws PropertyNotDefinedError', () => {
              expect(subject).toThrow(PropertyNotDefinedError);
            });

            context('when belongsTo relation is present', {
              definitions() {
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('throws PropertyNotDefinedError', () => {
                  expect(subject).toThrow(PropertyNotDefinedError);
                });

                context('when attrAccessors are present', {
                  definitions() {
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('throws PropertyNotDefinedError', () => {
                      expect(subject).toThrow(PropertyNotDefinedError);
                    });
                  },
                });
              },
            });
          },
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject().sort()).toEqual(['id'].sort());
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns the dbKeys of the schema', () => {
              expect(subject().sort()).toEqual(['id', 'foo'].sort());
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns the dbKeys of the belongsTo relation', () => {
                  expect(subject().sort()).toEqual(['id', 'foo', 'userId'].sort());
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('does not change attrAccessors', () => {
                      expect(subject().sort()).toEqual(['id', 'foo', 'userId'].sort());
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

  describe('.hasDbKey(key)', () => {
    let Klass: typeof NextModel;
    let key: string = 'foo';
    const subject = () => Klass.hasDbKey(key);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false for any key', () => {
          expect(subject()).toBeFalsy();
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true when key is in schema', () => {
              expect(subject()).toBeTruthy();
            });

            context('when query for identifier key', {
              definitions() {
                key = Klass.identifier;
              },
              tests() {
                test('returns true', () => {
                  expect(subject()).toBeTruthy();
                });
              },
            });

            context('when query for relation key', {
              definitions() {
                key = 'userId';
              },
              tests() {
                test('returns false', () => {
                  expect(subject()).toBeFalsy();
                });

                context('when belongsTo relation is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get belongsTo(): BelongsTo {
                        return {
                          user: { model: User },
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns true', () => {
                      expect(subject()).toBeTruthy();
                    });
                  },
                });
              },
            });

            context('when query for accessor key', {
              definitions() {
                key = 'bar';
              },
              tests() {
                test('returns false', () => {
                  expect(subject()).toBeFalsy();
                });


                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns true', () => {
                      expect(subject()).toBeFalsy();
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

  describe('.queryBy(query)', () => {
    let Klass: typeof NextModel;
    const query: Query = {
      foo: 'bar',
    };
    let subject = () => Klass.queryBy(query).query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('sets default query', () => {
          expect(subject()).toEqual({
            $and: [
              {foo: 'bar'},
            ],
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.queryBy(query)) instanceof Klass).toBeTruthy();
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'baz' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  { foo: 'baz' },
                  { foo: 'bar' },
                ],
              });
            });
          },
        });

        context('when query is chained', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.queryBy(query).queryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with and query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.queryBy(query).andQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with or query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.queryBy(query).orQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $or: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with not query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.queryBy(query).notQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $not: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });
      },
    });
  });

  describe('.andQueryBy(query)', () => {
    let Klass: typeof NextModel;
    const query: Query = {
      foo: 'bar',
    };
    let subject = () => Klass.andQueryBy(query).query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('sets default query', () => {
          expect(subject()).toEqual({
            $and: [
              {foo: 'bar'},
            ],
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.andQueryBy(query)) instanceof Klass).toBeTruthy();
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'baz' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  { foo: 'baz' },
                  { foo: 'bar' },
                ],
              });
            });
          },
        });

        context('when query is chained', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.andQueryBy(query).andQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with default query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.andQueryBy(query).queryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with or query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.andQueryBy(query).orQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $or: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with not query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.andQueryBy(query).notQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $not: [
                  {
                    $and: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });
      },
    });
  });

  describe('.orQueryBy(query)', () => {
    let Klass: typeof NextModel;
    const query: Query = {
      foo: 'bar',
    };
    let subject = () => Klass.orQueryBy(query).query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('sets default query', () => {
          expect(subject()).toEqual({
            $or: [
              {foo: 'bar'},
            ],
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.orQueryBy(query)) instanceof Klass).toBeTruthy();
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'baz' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $or: [
                  { foo: 'baz' },
                  { foo: 'bar' },
                ],
              });
            });
          },
        });

        context('when query is chained', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.orQueryBy(query).orQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $or: [
                  {
                    $or: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with default query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.orQueryBy(query).queryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $or: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with and query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.orQueryBy(query).andQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $or: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with not query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.orQueryBy(query).notQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $not: [
                  {
                    $or: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });
      },
    });
  });

  describe('.notQueryBy(query)', () => {
    let Klass: typeof NextModel;
    const query: Query = {
      foo: 'bar',
    };
    let subject = () => Klass.notQueryBy(query).query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('sets default query', () => {
          expect(subject()).toEqual({
            $not: [
              {foo: 'bar'},
            ],
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.notQueryBy(query)) instanceof Klass).toBeTruthy();
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'baz' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $not: [
                  { foo: 'baz' },
                  { foo: 'bar' },
                ],
              });
            });
          },
        });

        context('when query is chained', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.notQueryBy(query).notQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $not: [
                  {
                    $not: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with default query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.notQueryBy(query).queryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $not: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with and query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.notQueryBy(query).andQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $and: [
                  {
                    $not: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });

        context('when query is chained with or query type', {
          definitions() {
            @Model
            class NewKlass extends NextModel {};
            Klass = NewKlass;
            subject = () => Klass.notQueryBy(query).orQueryBy({ bar: 'baz' }).query;
          },
          tests() {
            test('sets the query of the model', () => {
              expect(subject()).toEqual({
                $or: [
                  {
                    $not: [
                      { foo: 'bar' },
                    ],
                  },
                  { bar: 'baz' },
                ],
              });
            });
          },
        });
      },
    });
  });

  describe('.orderBy(order)', () => {
    let Klass: typeof NextModel;
    let orderBy: Order = {
      foo: 'asc',
    };
    const subject = () => Klass.orderBy(orderBy).order;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default order', () => {
          expect(subject()).toEqual({
            foo: 'asc',
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.orderBy(orderBy)) instanceof Klass).toBeTruthy();
        });

        context('when order is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get order(): Order {
                return { bar: 'asc' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('overrides the order of the model', () => {
              expect(subject()).toEqual({
                foo: 'asc',
              });
            });
          },
        });
      },
    });
  });

  describe('.unqueried', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.unqueried.query;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default query', () => {
          expect(subject()).toEqual({});
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.unqueried) instanceof Klass).toBeTruthy();
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'bar' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('resets the query of the model', () => {
              expect(subject()).toEqual({});
            });
          },
        });
      },
    });
  });

  describe('.unordered', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.unordered.order;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default order', () => {
          expect(subject()).toEqual({});
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.unordered) instanceof Klass).toBeTruthy();
        });

        context('when order is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get order(): Order {
                return { foo: 'asc' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('resets the order of the model', () => {
              expect(subject()).toEqual({});
            });
          },
        });
      },
    });
  });

  describe('.unscoped', () => {
    let Klass: typeof NextModel;
    const subject = () => ({
      query: Klass.unscoped.query,
      order: Klass.unscoped.order,
    });


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns default query and order', () => {
          expect(subject()).toEqual({
            query: {},
            order: {},
          });
        });

        test('returns instance of Klass', () => {
          expect(new (Klass.unscoped) instanceof Klass).toBeTruthy();
        });

        context('when order is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get order(): Order {
                return { foo: 'asc' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('resets order of the model', () => {
              expect(subject()).toEqual({
                query: {},
                order: {},
              });
            });
          },
        });

        context('when query is already present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get query(): Query {
                return { foo: 'bar' };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('resets the query of the model', () => {
              expect(subject()).toEqual({
                query: {},
                order: {},
              });
            });
          },
        });
      },
    });
  });

  describe('.all', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.all;


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty array', () => {
          return expect(subject()).resolves.toEqual([]);
        });
      },
    });
  });

  describe('.first', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.first;


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty array', () => {
          return expect(subject()).resolves.toBeUndefined();
        });
      },
    });
  });

  describe('.count', () => {
    let Klass: typeof NextModel;
    const subject = () => Klass.count;


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty array', () => {
          return expect(subject()).resolves.toEqual(0);
        });
      },
    });
  });

  describe('#build(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => Klass.build(attrs).attributes;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            id: undefined,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            };
          },
          tests() {
            test('returns object with applied attributes', () => {
              expect(subject()).toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' } };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              expect(subject()).toEqual({
                id: undefined,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                };
              },
              tests() {
                test('returns object with applied attributes', () => {
                  expect(subject()).toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  expect(subject()).toEqual({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    };
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      expect(subject()).toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });

                context('when query is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get query(): Query {
                        return {
                          foo: 'bar',
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).toEqual({
                        id: undefined,
                        foo: 'bar',
                        userId: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).toEqual({
                            id: 1,
                            foo: 'bar',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
                      },
                    });
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).toEqual({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('#create(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => Klass.create(attrs).then(klass => klass.attributes);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('returns created object', () => {
          return expect(subject()).resolves.toEqual({
            id: 1,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              baz: '💩',
            };
          },
          tests() {
            test('returns object with applied attributes', () => {
              return expect(subject()).resolves.toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' } };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              return expect(subject()).resolves.toEqual({
                id: 1,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  foo: 'bar',
                  baz: '💩',
                };
              },
              tests() {
                test('returns object with applied attributes', () => {
                  return expect(subject()).resolves.toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  return expect(subject()).resolves.toEqual({
                    id: 1,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });

                context('when query is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get query(): Query {
                        return {
                          foo: 'bar',
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        foo: 'bar',
                        userId: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
                      },
                    });
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('#firstOrInitialize(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => Klass.firstOrInitialize(attrs).then(klass => klass.attributes);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when query returns result', {
      definitions() {
        attrs = {
          firstName: 'foo',
        };
        Klass = User;
        return seededUserDb();
      },
      tests() {
        test('returns database record with overwritten attributes', () => {
          return expect(subject()).resolves.toEqual({
            id: expect.any(Number),
            firstName: 'foo',
            lastName: 'User',
          });
        });
      },
    });

    context('when query does not return result', {
      definitions() {
        attrs = {
          firstName: 'foo',
        };
        Klass = User.queryBy({ id: 0 });
        return seededUserDb();
      },
      tests() {
        test('returns empty default', () => {
          return expect(subject()).resolves.toEqual({
            id: undefined,
            firstName: 'foo',
            lastName: undefined,
          });
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          return expect(subject()).resolves.toEqual({
            id: undefined,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            };
          },
          tests() {
            test('returns object with applied attributes', () => {
              return expect(subject()).resolves.toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' } };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              return expect(subject()).resolves.toEqual({
                id: undefined,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                };
              },
              tests() {
                test('returns object with applied attributes', () => {
                  return expect(subject()).resolves.toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  return expect(subject()).resolves.toEqual({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    };
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });

                context('when query is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get query(): Query {
                        return {
                          foo: 'bar',
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: undefined,
                        foo: 'bar',
                        userId: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
                      },
                    });
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('#firstOrCreate(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => Klass.firstOrCreate(attrs).then(klass => klass.attributes);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when query returns result', {
      definitions() {
        attrs = {
          firstName: 'foo',
        };
        Klass = User;
        return seededUserDb();
      },
      tests() {
        test('returns empty default', () => {
          return expect(subject()).resolves.toEqual({
            id: expect.any(Number),
            firstName: 'foo',
            lastName: 'User',
          });
        });
      },
    });

    context('when query does not return result', {
      definitions() {
        attrs = {
          firstName: 'foo',
        };
        Klass = User.queryBy({ id: 0 });
        return seededUserDb();
      },
      tests() {
        test('returns empty default', () => {
          return expect(subject()).resolves.toEqual({
            id: expect.any(Number),
            firstName: 'foo',
            lastName: undefined,
          });
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel { };
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          return expect(subject()).resolves.toEqual({
            id: 1,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              baz: '💩',
            };
          },
          tests() {
            test('returns object with applied attributes', () => {
              return expect(subject()).resolves.toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' } };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              return expect(subject()).resolves.toEqual({
                id: 1,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  foo: 'bar',
                  baz: '💩',
                };
              },
              tests() {
                test('returns object with applied attributes', () => {
                  return expect(subject()).resolves.toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  return expect(subject()).resolves.toEqual({
                    id: 1,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    };
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });

                context('when query is present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get query(): Query {
                        return {
                          foo: 'bar',
                        };
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        foo: 'bar',
                        userId: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          foo: 'bar',
                          bar: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
                      },
                    });
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      return expect(subject()).resolves.toEqual({
                        id: 1,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        };
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          return expect(subject()).resolves.toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('.constructor', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => new Klass(attrs);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns new NextModel instance', () => {
          expect(subject()).toEqual(expect.any(NextModel));
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns new NextModel instance', () => {
          expect(subject()).toEqual(expect.any(NextModel));
        });

        test('returns new Model without any changes', () => {
          expect(subject().changes).toEqual({});
        });

        test('returns new Model without any errors', () => {
          expect(subject().errors).toEqual({});
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              foo: 'bar',
            };
          },
          tests() {
            test('returns new Model without any changes', () => {
              expect(subject().changes).toEqual({});
            });

            test('returns new Model without any errors', () => {
              expect(subject().errors).toEqual({});
            });

            test('has no accessable attribute', () => {
              expect(subject().foo).toBeUndefined();
            });

            context('when schema is present with matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get schema(): Attributes {
                    return {
                      foo: { type: 'string' },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });

                test('has readable attribute', () => {
                  expect(subject().foo).toEqual('bar');
                });

                test('has writeable attribute', () => {
                  const klass: NextModel = subject();
                  klass.foo = 'baz';
                  expect(klass.foo).toEqual('baz');
                });

                test('writing attributes updates changes', () => {
                  const klass: NextModel = subject();
                  expect(klass.changes).toEqual({});
                  klass.foo = 'baz';
                  expect(klass.changes).toEqual({
                    foo: {
                      from: 'bar', to: 'baz',
                    },
                  });
                  klass.foo = 'foo';
                  expect(klass.changes).toEqual({
                    foo: {
                      from: 'bar', to: 'foo',
                    },
                  });
                  klass.foo = 'bar';
                  expect(klass.changes).toEqual({});
                });
              },
            });

            context('when schema is present without matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get schema(): Attributes {
                    return {
                      baz: { type: 'string' },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });
    
                test('has no accessable attribute', () => {
                  expect(subject().foo).toBeUndefined();
                });
              },
            });

            context('when attrAccessor is present with matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get attrAccessors(): string[] {
                    return ['foo'];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });

                test('has readable attribute', () => {
                  expect(subject().foo).toEqual('bar');
                });

                test('has writeable attribute', () => {
                  const klass: NextModel = subject();
                  klass.foo = 'baz';
                  expect(klass.foo).toEqual('baz');
                });

                test('writing attributes updates changes', () => {
                  const klass: NextModel = subject();
                  expect(klass.changes).toEqual({});
                  klass.foo = 'baz';
                  expect(klass.changes).toEqual({
                    foo: {
                      from: 'bar', to: 'baz',
                    },
                  });
                  klass.foo = 'foo';
                  expect(klass.changes).toEqual({
                    foo: {
                      from: 'bar', to: 'foo',
                    },
                  });
                  klass.foo = 'bar';
                  expect(klass.changes).toEqual({});
                });
              },
            });

            context('when attrAccessor is present without matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get attrAccessors(): string[] {
                    return ['baz'];
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });
    
                test('has no accessable attribute', () => {
                  expect(subject().foo).toBeUndefined();
                });
              },
            });

            context('when belongsTo is present with matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
                return seededUserDb();
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });

                test('has readable attribute', () => {
                  expect(subject().user).resolves.toBeUndefined();
                  expect(subject().userId).resolves.toBeUndefined();
                });

                test('has writeable id attribute', () => {
                  const klass: NextModel = subject();
                  klass.userId = 1;
                  expect(klass.attributes.userId).toEqual(1);
                });

                test('sets id by setting relation', () => {
                  const klass: NextModel = subject();
                  klass.user = new User({ id: 1 });
                  expect(klass.userId).toEqual(1);
                  klass.user = undefined;
                  expect(klass.userId).toBeUndefined();
                });

                test('reads user from storage', () => {
                  const klass: NextModel = subject();
                  return User.first.then(user => {
                    klass.userId = user ? user.id : 1;
                    return expect(klass.user).resolves.toEqual(new User({
                      id: expect.any(Number),
                      firstName: 'Seeded',
                      lastName: 'User',
                     }));
                  })
                });
              },
            });

            context('when hasMany is present with matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get hasMany(): HasMany {
                    return {
                      users: { model: User, foreignKey: 'fooId' },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });

                test('relation throws error no id present', () => {
                  const klass = subject();
                  expect(() => klass.users).toThrow(PropertyNotDefinedError);
                });

                test('returns queryable model', () => {
                  const klass = subject();
                  klass.id = 1;
                  expect(klass.users.query).toEqual({ $and: [{ fooId: 1 }] });
                  expect(new klass.users() instanceof User).toBeTruthy();
                });
              },
            });

            context('when hasOne is present with matching key', {
              definitions() {
                @Model
                class NewKlass extends NextModel {
                  static get hasOne(): HasOne {
                    return {
                      users: { model: User, foreignKey: 'fooId' },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns new Model without any changes', () => {
                  expect(subject().changes).toEqual({});
                });
    
                test('returns new Model without any errors', () => {
                  expect(subject().errors).toEqual({});
                });

                test('rejects when no id present', () => {
                  const klass = subject();
                  return expect(klass.users).rejects.toEqual(new PropertyNotDefinedError('#id'));
                });

                test('returns promise', () => {
                  const klass = subject();
                  klass.id = 1;
                  return expect(klass.users).resolves.toBeUndefined();
                });
              },
            });
          },
        });
      },
    });
  });

  describe('#attributes', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => new Klass(attrs).attributes;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            id: undefined,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns object with applied attributes', () => {
              expect(subject()).toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = undefined;
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              expect(subject()).toEqual({
                id: undefined,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                }
              },
              tests() {
                test('returns object with applied attributes', () => {
                  expect(subject()).toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = undefined;
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  expect(subject()).toEqual({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      expect(subject()).toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = undefined;
                  },
                });
    

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).toEqual({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = undefined;
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

  describe('#dbAttributes', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => new Klass(attrs).dbAttributes;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            id: undefined,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns object with applied attributes', () => {
              expect(subject()).toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = undefined;
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              expect(subject()).toEqual({
                id: undefined,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                }
              },
              tests() {
                test('returns object with applied attributes', () => {
                  expect(subject()).toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = undefined;
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  expect(subject()).toEqual({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      expect(subject()).toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = undefined;
                  },
                });
    

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).toEqual({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).toEqual({
                            id: 1,
                            foo: 'bar',
                          });
                        });
                      },
                      reset() {
                        attrs = undefined;
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

  describe('#save()', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    const error = new Error();
    const errorValidator: Validator = (_item) => Promise.resolve(error);
    const subject = () => klass.save();

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('sets instance id if item is new', () => {
          return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
        });

        context('when validator is failing', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: errorValidator,
                };
              }
            };
            Klass = NewKlass;
            klass = new Klass();
          },
          tests() {
            test('does not set id, but errors', () => {
              const result = new Klass({});
              result._errors = { id: [error] };
              return expect(subject()).resolves.toEqual(result);
            });
          },
        });

        context('when item is persisted', {
          definitions() {
            klass = new Klass({ id: 1 });
          },
          tests() {
            test('returns instance', () => {
              return expect(subject()).resolves.toEqual(klass);
            });
          },
        });
      },
    });
  });

  describe('#delete()', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    const subject = () => klass.delete();

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('returns instance', () => {
          return expect(subject()).resolves.toEqual(klass);
        });

        context('when item is persisted', {
          definitions() {
            klass = new Klass({ id: 1 });
          },
          tests() {
            test('returns instance', () => {
              return expect(subject()).resolves.toEqual(klass);
            });
          },
        });
      },
    });
  });

  describe('#update(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes = {};
    const error = new Error();
    const errorValidator: Validator = (_item) => Promise.resolve(error);
    const subject = () => new Klass().update(attrs);

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).resolves.toEqual(new Klass({
            id: undefined,
          }));
        });

        context('when validator is failing', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: errorValidator,
                };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('does not set id, but errors', () => {
              const result = new Klass({});
              result._errors = { id: [error] };
              return expect(subject()).resolves.toEqual(result);
            });
          },
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns object with applied attributes', () => {
              expect(subject()).resolves.toEqual(new Klass({
                id: 1,
              }));
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              expect(subject()).resolves.toEqual(new Klass({
                id: undefined,
                foo: undefined,
              }));
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                }
              },
              tests() {
                test('returns object with applied attributes', () => {
                  expect(subject()).resolves.toEqual(({
                    id: 1,
                    foo: 'bar',
                  }));
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  expect(subject()).resolves.toEqual(new Klass({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  }));
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      expect(subject()).resolves.toEqual(new Klass({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      }));
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).resolves.toEqual(new Klass({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      }));
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).resolves.toEqual(new Klass({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          }));
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('#reload()', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    const subject = () => klass.reload();

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('returns instance', () => {
          return expect(subject()).resolves.toBeUndefined();
        });

        context('when item is persisted', {
          definitions() {
            klass = new Klass({ id: 1 });
          },
          tests() {
            test('returns instance', () => {
              return expect(subject()).resolves.toBeUndefined();
            });
          },
        });

        context('when item is in storage', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get modelName(): string {
                return 'Foo';
              }

              static get dbConnector(): Connector {
                return new DefaultConnector({ Foo: [{ id: 1 }] });
              }
            };
            Klass = NewKlass;
            klass = new Klass({ id: 1});
          },
          tests() {
            test('returns instance', () => {
              return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
            });
          },
        });
      },
    });
  });

  describe('#assign(attrs)', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes = {};
    const subject = () => new Klass().assign(attrs).attributes;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns empty default', () => {
          expect(subject()).toEqual({
            id: undefined,
          });
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns object with applied attributes', () => {
              expect(subject()).toEqual({
                id: 1,
              });
            });
          },
          reset() {
            attrs = {};
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns object with keys of the schema', () => {
              expect(subject()).toEqual({
                id: undefined,
                foo: undefined,
              });
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                }
              },
              tests() {
                test('returns object with applied attributes', () => {
                  expect(subject()).toEqual({
                    id: 1,
                    foo: 'bar',
                  });
                });
              },
              reset() {
                attrs = {};
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns object with keys of the belongsTo relation', () => {
                  expect(subject()).toEqual({
                    id: undefined,
                    foo: undefined,
                    userId: undefined,
                  });
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns object with applied attributes', () => {
                      expect(subject()).toEqual({
                        id: 1,
                        userId: 2,
                        foo: 'bar',
                      });
                    });
                  },
                  reset() {
                    attrs = {};
                  },
                });
    

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns object with keys of the attrAccessors', () => {
                      expect(subject()).toEqual({
                        id: undefined,
                        foo: undefined,
                        userId: undefined,
                        bar: undefined,
                      });
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns object with applied attributes', () => {
                          expect(subject()).toEqual({
                            id: 1,
                            foo: 'bar',
                            bar: 'foo',
                          });
                        });
                      },
                      reset() {
                        attrs = {};
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

  describe('#isNew', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => new Klass(attrs).isNew;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns true', () => {
          expect(subject()).toBeTruthy();
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns false', () => {
              expect(subject()).toBeFalsy();
            });
          },
        });
      },
    });
  });

  describe('#isPersisted', () => {
    let Klass: typeof NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => new Klass(attrs).isPersisted;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false', () => {
          expect(subject()).toBeFalsy();
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });
      },
    });
  });

  describe('#hasChanges', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => (klass = new Klass(attrs)).hasChanges;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns initial false but true after changes', () => {
          expect(subject()).toBeFalsy();
          klass.id = undefined;
          expect(klass.hasChanges).toBeFalsy();
          klass.id = 1;
          expect(klass.hasChanges).toBeTruthy();
          klass.id = undefined;
          expect(klass.hasChanges).toBeFalsy();
        });

        test('does not change when updating unknown attributes', () => {
          expect(subject()).toBeFalsy();
          klass.foo = '💩';
          expect(klass.hasChanges).toBeFalsy();
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns initial false but true after changes', () => {
              expect(subject()).toBeFalsy();
              klass.id = 1;
              expect(klass.hasChanges).toBeFalsy();
              klass.id = 2;
              expect(klass.hasChanges).toBeTruthy();
            });
          },
          reset() {
            attrs = undefined;
          },
        });

        context('when schema is present', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get schema(): Schema {
                return { foo: { type: 'bar' }};
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns initial false but true after changes', () => {
              expect(subject()).toBeFalsy();
              klass.foo = undefined;
              expect(klass.hasChanges).toBeFalsy();
              klass.foo = 'bar';
              expect(klass.hasChanges).toBeTruthy();
            });

            context('when attributes are passed', {
              definitions() {
                attrs = {
                  id: 1,
                  foo: 'bar',
                  baz: '💩',
                }
              },
              tests() {
                test('returns initial false but true after changes', () => {
                  expect(subject()).toBeFalsy();
                  klass.foo = 'bar';
                  expect(klass.hasChanges).toBeFalsy();
                  klass.foo = 'baz';
                  expect(klass.hasChanges).toBeTruthy();
                });
              },
              reset() {
                attrs = undefined;
              },
            });

            context('when belongsTo relation is present', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get belongsTo(): BelongsTo {
                    return {
                      user: { model: User },
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns initial false but true after changes', () => {
                  expect(subject()).toBeFalsy();
                  klass.userId = undefined;
                  expect(klass.hasChanges).toBeFalsy();
                  klass.userId = 1;
                  expect(klass.hasChanges).toBeTruthy();
                });

                context('when attributes are passed', {
                  definitions() {
                    attrs = {
                      id: 1,
                      foo: 'bar',
                      userId: 2,
                      baz: '💩',
                    }
                  },
                  tests() {
                    test('returns initial false but true after changes', () => {
                      expect(subject()).toBeFalsy();
                      klass.userId = 2;
                      expect(klass.hasChanges).toBeFalsy();
                      klass.userId = 3;
                      expect(klass.hasChanges).toBeTruthy();
                    });
                  },
                  reset() {
                    attrs = undefined;
                  },
                });

                context('when attrAccessors are present', {
                  definitions() {
                    @Model
                    class NewKlass extends Klass {
                      static get attrAccessors(): string[] {
                        return ['bar'];
                      }
                    };
                    Klass = NewKlass;
                  },
                  tests() {
                    test('returns initial false but true after changes', () => {
                      expect(subject()).toBeFalsy();
                      klass.bar = undefined;
                      expect(klass.hasChanges).toBeFalsy();
                      klass.bar = 'foo';
                      expect(klass.hasChanges).toBeTruthy();
                    });

                    context('when attributes are passed', {
                      definitions() {
                        attrs = {
                          id: 1,
                          foo: 'bar',
                          bar: 'foo',
                          baz: '💩',
                        }
                      },
                      tests() {
                        test('returns initial false but true after changes', () => {
                          expect(subject()).toBeFalsy();
                          klass.bar = 'foo';
                          expect(klass.hasChanges).toBeFalsy();
                          klass.bar = 'baz';
                          expect(klass.hasChanges).toBeTruthy();
                        });
                      },
                      reset() {
                        attrs = undefined;
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

  describe('#changes', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    let attrs: Attributes | undefined = undefined;
    const subject = () => (klass = new Klass(attrs)).changes;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns initial empty changes and updates on settings attributes', () => {
          expect(subject()).toEqual({});
          klass.id = undefined;
          expect(klass.changes).toEqual({});
          klass.id = 1;
          expect(klass.changes).toEqual({
            id: { from: undefined, to: 1 },
          });
          klass.id = 2;
          expect(klass.changes).toEqual({
            id: { from: undefined, to: 2 },
          });
          klass.id = undefined;
          expect(klass.changes).toEqual({});
        });

        test('does not change when updating unknown attributes', () => {
          expect(subject()).toEqual({});
          klass.foo = '💩';
          expect(klass.changes).toEqual({});
        });

        context('when attributes are passed', {
          definitions() {
            attrs = {
              id: 1,
              baz: '💩',
            }
          },
          tests() {
            test('returns initial false but true after changes', () => {
              expect(subject()).toEqual({});
              klass.id = 1;
              expect(klass.changes).toEqual({});
              klass.id = 2;
              expect(klass.changes).toEqual({
                id: { from: 1, to: 2 },
              });
            });
          },
          reset() {
            attrs = undefined;
          },
        });
      },
    });
  });

  describe('#hasErrors', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;

    const subject = () => (klass = new Klass()).hasErrors;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns false as long as no errors are present', () => {
          expect(subject()).toBeFalsy();
          klass._errors = { id: [new Error()] };
          expect(klass.hasErrors).toBeTruthy();
        });
      },
    });
  });

  describe('#errors', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    const error = new Error();
    const trueValidator: Validator = (_item) => Promise.resolve(true);
    const falseValidator: Validator = (_item) => Promise.resolve(false);
    const errorValidator: Validator = (_item) => Promise.resolve(error);

    const subject = () => klass.errors;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
        klass = new Klass();
      },
      tests() {
        test('returns empty errors object', () => {
          return expect(subject()).toEqual({});
        });
        context('when validator returns true', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: trueValidator,
                };
              }
            };
            Klass = NewKlass;
            klass = new Klass();
            return klass.isValid();
          },
          tests() {
            test('returns empty errors object', () => {
              return expect(subject()).toEqual({});
            });
          },
        });

        context('when validator returns false', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: falseValidator,
                };
              }
            };
            Klass = NewKlass;
            klass = new Klass();
            return klass.isValid();
          },
          tests() {
            test('returns errors object with default error', () => {
              return expect(subject()).toEqual({
                id: [new Error('Validation Failed')],
              });
            });
          },
        });

        context('when validator returns Error', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: errorValidator,
                };
              }
            };
            Klass = NewKlass;
            klass = new Klass();
            return klass.isValid();
          },
          tests() {
            test('returns error', () => {
              return expect(subject()).toEqual({
                id: [error],
              });
            });
          },
        });


        context('when multiple validators are failing', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: [falseValidator, errorValidator],
                };
              }
            };
            Klass = NewKlass;
            klass = new Klass();
            return klass.isValid();
          },
          tests() {
            test('returns errors object with default error', () => {
              return expect(subject()).toEqual({
                id: [
                  new Error('Validation Failed'),
                  error,
                ],
              });
            });
          },
        });
      },
    });
  });

  describe('#model', () => {
    let Klass: typeof NextModel;

    const subject = () => new Klass().model;

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns the prototype of the model instance', () => {
          expect(subject()).toEqual(Klass);
        });
      },
    });
  });

  describe('#isValid()', () => {
    let Klass: typeof NextModel;
    let klass: NextModel;
    const error = new Error();
    const trueValidator: Validator = (_item) => Promise.resolve(true);
    const falseValidator: Validator = (_item) => Promise.resolve(false);
    const errorValidator: Validator = (_item) => Promise.resolve(error);

    const subject = () => (klass = new Klass()).isValid();

    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('throws PropertyNotDefinedError', () => {
          expect(subject).toThrow(PropertyNotDefinedError);
        });
      },
    });

    context('when decorator is present', {
      definitions() {
        @Model
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        test('returns true', () => {
          return expect(subject()).resolves.toBeTruthy();
        });
        context('when validator returns true', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: trueValidator,
                };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns true', () => {
              return expect(subject()).resolves.toBeTruthy();
            });
          },
        });

        context('when validator returns false', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: falseValidator,
                };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns false', () => {
              return expect(subject()).resolves.toBeFalsy();
            });
          },
        });

        context('when validator returns Error', {
          definitions() {
            @Model
            class NewKlass extends NextModel {
              static get validators(): Validators {
                return {
                  id: errorValidator,
                };
              }
            };
            Klass = NewKlass;
          },
          tests() {
            test('returns false', () => {
              return expect(subject()).resolves.toBeFalsy();
            });
          },
        });
      },
    });
  });
});
