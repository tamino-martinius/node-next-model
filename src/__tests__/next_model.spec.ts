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
  User,
} from '../__mocks__/next_model';

interface Context {
  definitions: () => void;
  tests: () => void;
  reset?: () => void,
};

const context = (description: string, {definitions, tests, reset}: Context) => {
  describe(description, () => {
    beforeEach(definitions);
    tests();
    if (reset !== undefined) {
      afterEach(reset);
    }
  })
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the name of the model', () => {
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
        it('reflects name from class', () => {
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
            it('returns the name of the model', () => {
              expect(subject()).toEqual('foo');
            });

            context('when modelName is empty string', {
              definitions() {},
              tests() {
                it('throws MinLengthError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the identifier of the model', () => {
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
        it('returns default identifier', () => {
          expect(subject()).toEqual('id');
        });
        it('adds identifier to schema', () => {
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
            it('returns the identifier of the model', () => {
              expect(subject()).toEqual('foo');
            });
            it('adds identifier to schema', () => {
              expect(Klass.schema).toEqual({ foo: { type: 'integer' }});
            });

            context('when identifier is empty string', {
              definitions() {},
              tests() {
                it('throws MinLengthError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the dbConnector of the model', () => {
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
        it('returns default dbConnector', () => {
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
            it('returns the dbConnector of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the attrAccessors of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the attrAccessors of the model', () => {
              expect(subject()).toEqual(['foo']);
            });

            context('when attrAccessors is empty string', {
              definitions() {},
              tests() {
                it('throws MinLengthError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the schema of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the schema of the model', () => {
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
                it('returns the schema of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the belongsTo of the model', () => {
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
                it('returns the belongsTo of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the belongsTo of the model and adds defaults', () => {
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
                it('returns the belongsTo of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the hasMany of the model and adds defaults', () => {
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
                it('returns the hasMany of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the hasMany of the model and adds defaults', () => {
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
                it('returns the hasMany of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the hasOne of the model and adds defaults', () => {
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
                it('returns the hasOne of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the hasOne of the model and adds defaults', () => {
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
                it('returns the hasOne of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the validators of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the validators of the model', () => {
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
                it('returns the validators of the model', () => {
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
                it('returns the validators of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns empty default', () => {
          expect(subject()).toEqual([]);
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
            it('returns the validators of the model', () => {
              expect(subject()).toEqual([promiseValidator, promiseValidator]);
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
                it('returns the active  validators of the model', () => {
                  expect(subject()).toEqual([promiseValidator]);
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
                it('returns the active validators of the model', () => {
                  expect(subject()).toEqual([]);
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the callbacks of the model', () => {
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
        it('returns empty default', () => {
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
            it('returns the callbacks of the model', () => {
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
                it('returns the callbacks of the model', () => {
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
                it('returns the callbacks of the model', () => {
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
                it('returns the callbacks of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns empty default', () => {
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
            it('returns the callbacks of the model', () => {
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
                it('returns the active callbacks of the model', () => {
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
                it('returns the active callbacks of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the skip of the model', () => {
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
        it('returns default skip', () => {
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
            it('returns the skip of the model', () => {
              expect(subject()).toEqual(4711);
            });

            context('when skip is below 0', {
              definitions() { },
              tests() {
                it('throws LowerBoundsError', () => {
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
                it('throws TypeError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the limit of the model', () => {
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
        it('returns default limit', () => {
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
            it('returns the limit of the model', () => {
              expect(subject()).toEqual(4711);
            });

            context('when limit is below 0', {
              definitions() { },
              tests() {
                it('throws LowerBoundsError', () => {
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
                it('throws TypeError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the query of the model', () => {
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
        it('returns default query', () => {
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
            it('returns the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('returns the order of the model', () => {
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
        it('returns default order', () => {
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
            it('returns the order of the model', () => {
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
          it('throws PropertyNotDefinedError', () => {
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
              it('returns the skippedValidators of the model', () => {
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
          it('returns default skippedValidators', () => {
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
              it('returns the skippedValidators of the model', () => {
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
              it('returns the skippedValidators of the model as array', () => {
                expect(subject()).toEqual(['foo']);
              });
            },
          });

          context('when skippedValidators is empty string', {
            definitions() { },
            tests() {
              it('throws MinLengthError', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns false', () => {
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
            it('returns true', () => {
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
            it('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when skipped validators are present but not matching', {
          definitions() {
            key = 'baz';
          },
          tests() {
            it('returns false', () => {
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
          it('throws PropertyNotDefinedError', () => {
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
              it('returns the skippedCallbacks of the model', () => {
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
          it('returns default skippedCallbacks', () => {
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
              it('returns the skippedCallbacks of the model', () => {
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
              it('returns the skippedCallbacks of the model as array', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns false', () => {
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
            it('returns true', () => {
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
            it('returns true', () => {
              expect(subject()).toBeTruthy();
            });
          },
        });

        context('when skipped callbacks are present but not matching', {
          definitions() {
            key = 'beforeUpdate';
          },
          tests() {
            it('returns false', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('throws PropertyNotDefinedError', () => {
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
                it('throws PropertyNotDefinedError', () => {
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
                    it('throws PropertyNotDefinedError', () => {
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
        it('returns empty default', () => {
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
            it('returns the keys of the schema', () => {
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
                it('returns the keys of the belongsTo relation', () => {
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
                    it('returns the keys of the attrAccessors', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns false for any key', () => {
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
            it('returns true when key is in schema', () => {
              expect(subject()).toBeTruthy();
            });

            context('when query for identifier key', {
              definitions() {
                key = Klass.identifier;
              },
              tests() {
                it('returns true', () => {
                  expect(subject()).toBeTruthy();
                });
              },
            });

            context('when query for relation key', {
              definitions() {
                key = 'userId';
              },
              tests() {
                it('returns false', () => {
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
                    it('returns true', () => {
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
                it('returns false', () => {
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
                    it('returns true', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
            it('throws PropertyNotDefinedError', () => {
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
                it('throws PropertyNotDefinedError', () => {
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
                    it('throws PropertyNotDefinedError', () => {
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
        it('returns empty default', () => {
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
            it('returns the dbKeys of the schema', () => {
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
                it('returns the dbKeys of the belongsTo relation', () => {
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
                    it('does not change attrAccessors', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns false for any key', () => {
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
            it('returns true when key is in schema', () => {
              expect(subject()).toBeTruthy();
            });

            context('when query for identifier key', {
              definitions() {
                key = Klass.identifier;
              },
              tests() {
                it('returns true', () => {
                  expect(subject()).toBeTruthy();
                });
              },
            });

            context('when query for relation key', {
              definitions() {
                key = 'userId';
              },
              tests() {
                it('returns false', () => {
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
                    it('returns true', () => {
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
                it('returns false', () => {
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
                    it('returns true', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('sets default query', () => {
          expect(subject()).toEqual({
            $and: [
              {foo: 'bar'},
            ],
          });
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('sets default query', () => {
          expect(subject()).toEqual({
            $and: [
              {foo: 'bar'},
            ],
          });
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('sets default query', () => {
          expect(subject()).toEqual({
            $or: [
              {foo: 'bar'},
            ],
          });
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('sets default query', () => {
          expect(subject()).toEqual({
            $not: [
              {foo: 'bar'},
            ],
          });
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
            it('sets the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns default order', () => {
          expect(subject()).toEqual({
            foo: 'asc',
          });
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
            it('overrides the order of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns default query', () => {
          expect(subject()).toEqual({});
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
            it('resets the query of the model', () => {
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
        it('throws PropertyNotDefinedError', () => {
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
        it('returns default order', () => {
          expect(subject()).toEqual({});
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
            it('resets the order of the model', () => {
              expect(subject()).toEqual({});
            });
          },
        });
      },
    });
  });

  describe('.model', () => {
    let Klass: typeof NextModel;
    const subject = () => ({
      query: Klass.model.query,
      order: Klass.model.order,
    });


    context('when decorator is not present', {
      definitions() {
        class NewKlass extends NextModel {};
        Klass = NewKlass;
      },
      tests() {
        it('throws PropertyNotDefinedError', () => {
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
        it('returns default query and order', () => {
          expect(subject()).toEqual({
            query: {},
            order: {},
          });
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
            it('resets order of the model', () => {
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
            it('resets the query of the model', () => {
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
    pending('not yet implemented');
  });

  describe('.first', () => {
    pending('not yet implemented');
  });

  describe('.count', () => {
    pending('not yet implemented');
  });

  describe('#save()', () => {
    pending('not yet implemented');
  });

  describe('#delete()', () => {
    pending('not yet implemented');
  });

  describe('#update(attrs)', () => {
    pending('not yet implemented');
  });

  describe('#reload()', () => {
    pending('not yet implemented');
  });


  describe('#isValid()', () => {
    pending('not yet implemented');
  });
});
