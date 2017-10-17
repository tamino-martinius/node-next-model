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


  // describe('.all', () => {
  //   subject(() => $Klass.all);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   def('cache', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //   ]);

  //   it('throws error without connector', function () {
  //     expect(() => $subject).toThrow();
  //   });

  //   context('when cache is present', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('all', $cache);
  //     });

  //     it('returns cached data', function () {
  //       return $subject.then(data => expect(data).toEqual($cache));
  //     });

  //     context('when caching is disabled', () => {
  //       def('Klass', () => class Klass extends $Klass {
  //         static get cacheData() {
  //           return false;
  //         }
  //       });

  //       it('throws error without connector', function () {
  //         expect(() => $subject).toThrow();
  //       });
  //     });
  //   });

  //   context('when connector is present', () => {
  //     def('Klass', () => class Klass extends $Klass {
  //       static get connector() {
  //         return mockConnector($items);
  //       }
  //     });

  //     it('returns queried data', function () {
  //       return $subject.then(data => expect(data).toEqual($items));
  //     });

  //     context('when cache is present', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('all', $cache);
  //       });

  //       it('returns cached data', function () {
  //         return $subject.then(data => expect(data).toEqual($cache));
  //       });

  //       context('when caching is disabled', () => {
  //         def('Klass', () => class Klass extends $Klass {
  //           static get cacheData() {
  //             return false;
  //           }
  //         });

  //         it('returns queried data', function () {
  //           return $subject.then(data => expect(data).toEqual($items));
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.first', () => {
  //   subject(() => $Klass.first);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   def('cache', () => ({ id: 2, foo: 'foo' }));

  //   it('throws error without connector', function () {
  //     expect(() => $subject).toThrow();
  //   });

  //   context('when cache is present', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('first', $cache);
  //     });

  //     it('returns cached data', function () {
  //       return $subject.then(data => expect(data).toEqual($cache));
  //     });

  //     context('when caching is disabled', () => {
  //       def('Klass', () => class Klass extends $Klass {
  //         static get cacheData() {
  //           return false;
  //         }
  //       });

  //       it('throws error without connector', function () {
  //         expect(() => $subject).toThrow();
  //       });
  //     });
  //   });

  //   context('when connector is present', () => {
  //     def('Klass', () => class Klass extends $Klass {
  //       static get connector() {
  //         return mockConnector($items);
  //       }
  //     });

  //     it('returns queried data', function () {
  //       return $subject.then(data => expect(data).toEqual(first($items)));
  //     });

  //     context('when cache is present', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('first', $cache);
  //       });

  //       it('returns cached data', function () {
  //         return $subject.then(data => expect(data).toEqual($cache));
  //       });

  //       context('when caching is disabled', () => {
  //         def('Klass', () => class Klass extends $Klass {
  //           static get cacheData() {
  //             return false;
  //           }
  //         });

  //         it('returns queried data', function () {
  //           return $subject.then(data => expect(data).toEqual(first($items)));
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.last', () => {
  //   subject(() => $Klass.last);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   def('cache', () => ({ id: 2, foo: 'foo' }));

  //   it('throws error without connector', function () {
  //     expect(() => $subject).toThrow();
  //   });

  //   context('when cache is present', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('last', $cache);
  //     });

  //     it('returns cached data', function () {
  //       return $subject.then(data => expect(data).toEqual($cache));
  //     });

  //     context('when caching is disabled', () => {
  //       def('Klass', () => class Klass extends $Klass {
  //         static get cacheData() {
  //           return false;
  //         }
  //       });

  //       it('throws error without connector', function () {
  //         expect(() => $subject).toThrow();
  //       });
  //     });
  //   });

  //   context('when connector is present', () => {
  //     def('Klass', () => class Klass extends $Klass {
  //       static get connector() {
  //         return mockConnector($items);
  //       }
  //     });

  //     it('returns queried data', function () {
  //       return $subject.then(data => expect(data).toEqual(last($items)));
  //     });

  //     context('when cache is present', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('last', $cache);
  //       });

  //       it('returns cached data', function () {
  //         return $subject.then(data => expect(data).toEqual($cache));
  //       });

  //       context('when caching is disabled', () => {
  //         def('Klass', () => class Klass extends $Klass {
  //           static get cacheData() {
  //             return false;
  //           }
  //         });

  //         it('returns queried data', function () {
  //           return $subject.then(data => expect(data).toEqual(last($items)));
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.count', () => {
  //   subject(() => $Klass.count);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   def('cache', () => 2);

  //   it('throws error without connector', function () {
  //     expect(() => $subject).toThrow();
  //   });

  //   context('when cache is present', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('count', $cache);
  //     });

  //     it('returns cached data', function () {
  //       return $subject.then(data => expect(data).toEqual($cache));
  //     });

  //     context('when caching is disabled', () => {
  //       def('Klass', () => class Klass extends $Klass {
  //         static get cacheData() {
  //           return false;
  //         }
  //       });

  //       it('throws error without connector', function () {
  //         expect(() => $subject).toThrow();
  //       });
  //     });
  //   });

  //   context('when connector is present', () => {
  //     def('Klass', () => class Klass extends $Klass {
  //       static get connector() {
  //         return mockConnector($items);
  //       }
  //     });

  //     it('returns queried data', function () {
  //       return $subject.then(data => expect(data).toEqual($items.length));
  //     });

  //     context('when cache is present', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('count', $cache);
  //       });

  //       it('returns cached data', function () {
  //         return $subject.then(data => expect(data).toEqual($cache));
  //       });

  //       context('when caching is disabled', () => {
  //         def('Klass', () => class Klass extends $Klass {
  //           static get cacheData() {
  //             return false;
  //           }
  //         });

  //         it('returns queried data', function () {
  //           return $subject.then(data => expect(data).toEqual($items.length));
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.reload', () => {
  //   subject(() => $Klass.reload);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   context('cache is present', () => {
  //     def('queryType', () => 'all');
  //     def('items', () => [{ foo: 1 }]);

  //     beforeEach(() => {
  //       $Klass.setCache($queryType, $items);
  //     });

  //     it('clears cache', () => {
  //       expect($Klass.getCache($queryType)).eql($items);
  //       expect($subject.getCache($queryType)).toEqual(undefined);
  //     });
  //   });

  //   context('defaultScope is present', () => {
  //     def('defaultScope', () => ({ foo: 1 }));

  //     it('keeps scope', () => {
  //       expect($subject.defaultScope).toEqual({ foo: 1 });
  //     });
  //   });

  //   context('defaultOrder is present', () => {
  //     def('defaultOrder', () => ({ foo: 'asc' }));

  //     it('keeps order', () => {
  //       expect($subject.defaultOrder).toEqual({ foo: 'asc' });
  //     });
  //   });
  // });

  // // Static functions

  // describe('.hasCache()', () => {
  //   subject(() => $Klass.hasCache($queryType));
  //   def('Klass', () => class Klass extends NextModel {});

  //   def('queryType', () => 'all');

  //   it('returns false', () => {
  //     expect($subject).toEqual(false);
  //   });

  //   context('when other querytype is set', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('first', { foo: 'bar' });
  //     });

  //     it('returns false', () => {
  //       expect($subject).toEqual(false);
  //     });
  //   });

  //   context('when other cache is set', () => {
  //     beforeEach(() => {
  //       $Klass.setCache('all', [{ foo: 'bar' }]);
  //     });

  //     it('returns true', () => {
  //       expect($subject).toEqual(true);
  //     });

  //     context('when cacheData is disabled', () => {
  //       def('Klass', () => class Klass extends $Klass {
  //         static get cacheData() {
  //           return false;
  //         }
  //       });

  //       it('returns false', function () {
  //         expect($subject).toEqual(false);
  //       });
  //     });
  //   });
  // });

  // describe('.getCache()', () => {
  //   subject(() => $Klass.getCache($queryType));
  //   def('Klass', () => class Klass extends NextModel {});

  //   context('when queryType is all', () => {
  //     def('queryType', () => 'all');

  //     it('returns undefined', () => {
  //       expect($subject).toEqual(undefined);
  //     });

  //     context('when cache is set', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('all', [{ foo: 'bar' }]);
  //       });

  //       it('returns cached items', () => {
  //         expect($subject).toEqual([{ foo: 'bar' }]);
  //       });
  //     });
  //   });

  //   context('when queryType is first', () => {
  //     def('queryType', () => 'first');

  //     it('returns undefined', () => {
  //       expect($subject).toEqual(undefined);
  //     });

  //     context('when cache is set', () => {
  //       beforeEach(() => {
  //         $Klass.setCache('first', { foo: 'bar' });
  //       });

  //       it('returns cached item', () => {
  //         expect($subject).toEqual({ foo: 'bar' });
  //       });
  //     });
  //   });
  // });

  // describe('.setCache()', () => {
  //   subject(() => $Klass.setCache($queryType, $value));
  //   def('Klass', () => class Klass extends NextModel {});
  //   def('queryType', () => 'all');
  //   def('value', () => ({ foo: 'bar' }));

  //   it('sets and unsets cache', () => {
  //     const cache = () => $Klass.getCache($queryType);
  //     expect(() => $subject).to
  //       .change(cache).from(undefined).to($value);
  //     expect(() => $Klass.setCache($queryType, undefined)).to
  //       .change(cache).from($value).to(undefined);
  //     expect($subject).toEqual($value);
  //   });
  // });

  // describe('.build()', () => {
  //   subject(() => $Klass.build($attrs));

  //   def('schema', () => ({}));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return $schema;
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   it('returns model instance', () => {
  //     expect($subject).to.be.a($Klass);
  //   });

  //   context('when schema is present', () => {
  //     def('schema', () => ({
  //       id: { type: 'integer' },
  //       bar: { type: 'string', defaultValue: 'bar' },
  //     }));

  //     it('returns model instance and sets default values', () => {
  //       expect($subject).to.be.a($Klass);
  //       expect($subject.id).toEqual(null);
  //       expect($subject.bar).toEqual('bar');
  //     });

  //     context('when passing attributes to constructor', () => {
  //       def('attrs', () => ({
  //         bar: 'foo',
  //       }));

  //       it('returns model instance and sets attributes', () => {
  //         expect($subject).to.be.a($Klass);
  //         expect($subject.id).toEqual(null);
  //         expect($subject.bar).toEqual('foo');
  //       });

  //       context('when passing id', () => {
  //         def('attrs', () => ({
  //           id: 1,
  //           bar: 'foo',
  //         }));

  //         it('throws error while creating', () => {
  //           expect(() => $subject).toThrow();
  //         });
  //       });
  //     });

  //     context('when passing invalid attributes to constructor', () => {
  //       def('attrs', () => ({
  //         baz: 'foo',
  //       }));

  //       it('throws error while creating', () => {
  //         expect(() => $subject).toThrow();
  //       });
  //     });

  //     context('when attrAccessors are present', () => {
  //       def('attrAccessors', () => ['baz']);

  //       it('does not set accessor', () => {
  //         expect($subject).to.be.a($Klass);
  //         expect($subject.baz).toEqual(undefined);
  //       });

  //       context('when passing attributes to constructor', () => {
  //         def('attrs', () => ({
  //           baz: 'foo',
  //         }));

  //         it('returns model instance and sets attributes', () => {
  //           expect($subject).to.be.a($Klass);
  //           expect($subject.baz).toEqual('foo');
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.promiseBuild()', () => {
  //   subject(() => $Klass.promiseBuild($attrs));

  //   def('schema', () => ({}));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return $schema;
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   def('klass', () => new $Klass());

  //   it('returns model instance', () => {
  //     return $subject.then(data => {
  //       expect(data).to.be.a($Klass);
  //     });
  //   });

  //   shared.behavesLikeActionWhichSupportsCallbacks({
  //     action: 'build',
  //     actionIsStatic: true,
  //     actionIsPromise: true,
  //     innerActionBase: 'Klass',
  //   });

  //   context('when schema is present', () => {
  //     def('schema', () => ({
  //       id: { type: 'integer' },
  //       bar: { type: 'string', defaultValue: 'bar' },
  //     }));

  //     it('returns model instance and sets default values', () => {
  //       return $subject.then(data => {
  //         expect(data).to.be.a($Klass);
  //         expect(data.id).toEqual(null);
  //         expect(data.bar).toEqual('bar');
  //       });
  //     });

  //     context('when passing attributes to constructor', () => {
  //       def('attrs', () => ({
  //         bar: 'foo',
  //       }));

  //       it('returns model instance and sets attributes', () => {
  //         return $subject.then(data => {
  //           expect(data).to.be.a($Klass);
  //           expect(data.id).toEqual(null);
  //           expect(data.bar).toEqual('foo');
  //         });
  //       });

  //       context('when passing id', () => {
  //         def('attrs', () => ({
  //           id: 1,
  //           bar: 'foo',
  //         }));

  //         it('catches promise reject', shared.promiseError);
  //       });
  //     });

  //     context('when passing invalid attributes to constructor', () => {
  //       def('attrs', () => ({
  //         baz: 'foo',
  //       }));

  //       it('catches promise reject', shared.promiseError);
  //     });

  //     context('when attrAccessors are present', () => {
  //       def('attrAccessors', () => ['baz']);

  //       it('does not set accessor', () => {
  //         return $subject.then(data => {
  //           expect(data).to.be.a($Klass);
  //           expect(data.baz).toEqual(undefined);
  //         });
  //       });

  //       context('when passing attributes to constructor', () => {
  //         def('attrs', () => ({
  //           baz: 'foo',
  //         }));

  //         it('returns model instance and sets attributes', () => {
  //           return $subject.then(data => {
  //             expect(data).to.be.a($Klass);
  //             expect(data.baz).toEqual('foo');
  //           });
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.create()', () => {
  //   subject(() => $Klass.create($attrs));

  //   def('schema', () => ({}));

  //   def('connector', () => ({ save: function(klass) {
  //     klass.id = 1;
  //     return Promise.resolve(true);
  //   }}));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get connector() {
  //       return $connector;
  //     }

  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return $schema;
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   def('klass', () => new $Klass());

  //   shared.behavesLikeActionWhichSupportsCallbacks({
  //     action: 'build',
  //     actionIsStatic: true,
  //     actionIsPromise: true,
  //     innerActionBase: 'Klass',
  //   });

  //   shared.behavesLikeActionWhichSupportsCallbacks({
  //     action: 'create',
  //     actionIsStatic: true,
  //     actionIsPromise: true,
  //     innerActionBase: 'Klass',
  //     innerActionName: 'promiseBuild',
  //   });

  //   context('when promiseBuild returns $klass', () => {
  //     beforeEach(() => {
  //       sinon.stub($Klass, 'promiseBuild').returns(Promise.resolve($klass));
  //     });

  //     shared.behavesLikeActionWhichSupportsCallbacks({
  //       action: 'save',
  //       actionIsPromise: true,
  //     });
  //   });

  //   it('returns model instance', () => {
  //     return $subject.then(data => expect(data).to.be.a($Klass));
  //   });

  //   context('when schema is present', () => {
  //     def('schema', () => ({
  //       id: { type: 'integer' },
  //       bar: { type: 'string', defaultValue: 'bar' },
  //     }));

  //     it('returns model instance and sets default values', () => {
  //       return $subject.then(data => {
  //         expect(data).to.be.a($Klass);
  //         expect(data.id).toEqual(1);
  //         expect(data.bar).toEqual('bar');
  //       });
  //     });

  //     context('when passing attributes to constructor', () => {
  //       def('attrs', () => ({
  //         bar: 'foo',
  //       }));

  //       it('returns model instance and sets attributes', () => {
  //         return $subject.then(data => {
  //           expect(data).to.be.a($Klass);
  //           expect(data.id).toEqual(1);
  //           expect(data.bar).toEqual('foo');
  //         });
  //       });

  //       context('when passing id', () => {
  //         def('attrs', () => ({
  //           id: 1,
  //           bar: 'foo',
  //         }));

  //         it('catches promise reject', shared.promiseError);
  //       });
  //     });

  //     context('when passing invalid attributes to constructor', () => {
  //       def('attrs', () => ({
  //         baz: 'foo',
  //       }));

  //       it('catches promise reject', shared.promiseError);
  //     });

  //     context('when attrAccessors are present', () => {
  //       def('attrAccessors', () => ['baz']);

  //       it('does not set accessor', () => {
  //         return $subject.then(data => {
  //           expect(data).to.be.a($Klass);
  //           expect(data.baz).toEqual(undefined);
  //         });
  //       });

  //       context('when passing attributes to constructor', () => {
  //         def('attrs', () => ({
  //           baz: 'foo',
  //         }));

  //         it('returns model instance and sets attributes', () => {
  //           return $subject.then(data => {
  //             expect(data).to.be.a($Klass);
  //             expect(data.baz).toEqual('foo');
  //           });
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('.limit()', () => {
  //   subject(() => $Klass.limit($amount));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get connector() {
  //       return mockConnector($items);
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   context('when limit is a number', function () {
  //     def('amount', () => 1);

  //     it('throws no error', function () {
  //       expect(() => $subject).to.not.throwError();
  //     });
  //   });


  //   context('when limit is no number', function () {
  //     def('amount', () => 'a');

  //     it('throws error', function () {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('when limit below 0', function () {
  //     def('amount', () => -1);

  //     it('throws error', function () {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('when fetching items', () => {
  //     subject(() => $Klass.limit($amount).all);

  //     context('when limit is heigher than item count' , () => {
  //       def('amount', () => 10);

  //       it('returns all items', function () {
  //         return $subject.then(data => expect(data).toEqual($items));
  //       });
  //     });

  //     context('when limit is lower than item count' , () => {
  //       def('amount', () => 2);

  //       it('takes the items from start', function () {
  //         return $subject.then(data => expect(data).toEqual([$items[0], $items[1]]));
  //       });
  //     });

  //     context('when defaultScope present', () => {
  //       def('amount', () => 1);
  //       def('defaultScope', () => ({ foo: 'bar' }));

  //       it('limits matching items', function () {
  //         return $subject.then(data => expect(data).toEqual([$items[2]]));
  //       });
  //     });
  //   });
  // });

  // describe('.unlimit()', () => {
  //   subject(() => $Klass.unlimit().all);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get connector() {
  //       return mockConnector($items);
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   it('returns all items', function () {
  //     return $subject.then(data => expect(data).toEqual($items));
  //   });

  //   context('when limit is present' , () => {
  //     def('Klass', () => $Klass.limit(1));

  //     it('returns all items', function () {
  //       return $subject.then(data => expect(data).toEqual($items));
  //     });
  //   });
  // });

  // describe('.skip()', () => {
  //   subject(() => $Klass.skip($amount));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get connector() {
  //       return mockConnector($items);
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   context('when skip is a number', function () {
  //     def('amount', () => 1);

  //     it('throws no error', function () {
  //       expect(() => $subject).to.not.throwError();
  //     });
  //   });


  //   context('when skip is no number', function () {
  //     def('amount', () => 'a');

  //     it('throws error', function () {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('when skip below 0', function () {
  //     def('amount', () => -1);

  //     it('throws error', function () {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('when fetching items', () => {
  //     subject(() => $Klass.skip($amount).all);

  //     context('when skip is heigher than item count', () => {
  //       def('amount', () => 10);

  //       it('returns no items', function () {
  //         return $subject.then(data => expect(data).toEqual([]));
  //       });
  //     });

  //     context('when skip is lower than item count' , () => {
  //       def('amount', () => 2);

  //       it('skips the items from start', function () {
  //         return $subject.then(data => expect(data).toEqual([$items[2], $items[3]]));
  //       });
  //     });

  //     context('when defaultScope present', () => {
  //       def('amount', () => 1);
  //       def('defaultScope', () => ({ foo: 'bar' }));

  //       it('skips matching items', function () {
  //         return $subject.then(data => expect(data).toEqual([$items[3]]));
  //       });
  //     });
  //   });
  // });

  // describe('.unskip()', () => {
  //   subject(() => $Klass.unskip().all);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }

  //     static get connector() {
  //       return mockConnector($items);
  //     }
  //   });

  //   def('items', () => [
  //     { id: 1, foo: 'foo' },
  //     { id: 2, foo: 'foo' },
  //     { id: 3, foo: 'bar' },
  //     { id: 4, foo: 'bar' },
  //   ]);

  //   it('returns all items', function () {
  //     return $subject.then(data => expect(data).toEqual($items));
  //   });

  //   context('when skip is present' , () => {
  //     def('Klass', () => $Klass.skip(1));

  //     it('returns all items', function () {
  //       return $subject.then(data => expect(data).toEqual($items));
  //     });
  //   });
  // });

  // describe('.withScope()', () => {
  //   subject(() => $Klass.withScope($scope));
  //   def('scope', () => ({ foo: 'bar' }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('passes scope to defaultScope', () => {
  //     expect($subject.defaultScope).toEqual($scope);
  //   });

  //   context('defaultScope is already present', () => {
  //     def('defaultScope', () => ({ bar: 'baz' }));

  //     it('overrides current scope', () => {
  //       expect($subject.defaultScope).toEqual($scope);
  //     });

  //     context('defaultScope is already present with same key', () => {
  //       def('defaultScope', () => ({ foo: 'baz' }));

  //       it('overrides current scope', () => {
  //         expect($subject.defaultScope).toEqual($scope);
  //       });
  //     });
  //   });
  // });

  // describe('.order()', () => {
  //   subject(() => $Klass.order($order));
  //   def('order', () => ({ foo: 'asc' }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultOrder() {
  //       return $defaultOrder;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('passes order to defaultOrder', () => {
  //     expect($subject.defaultOrder).toEqual($order);
  //   });

  //   context('when value is invalid', () => {
  //     def('order', () => ({ foo: 1 }));

  //     it('throws error', () => {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('when key is not in schema', () => {
  //     def('order', () => ({ baz: 'asc' }));

  //     it('throws error', () => {
  //       expect(() => $subject).toThrow();
  //     });
  //   });

  //   context('defaultOrder is already present', () => {
  //     def('defaultOrder', () => ({ bar: 'desc' }));

  //     it('overrides current order', () => {
  //       expect($subject.defaultOrder).toEqual($order);
  //     });

  //     context('defaultOrder is already present with same key', () => {
  //       def('defaultOrder', () => ({ foo: 'desc' }));

  //       it('overrides current order', () => {
  //         expect($subject.defaultOrder).toEqual($order);
  //       });
  //     });
  //   });
  // });

  // describe('.scope()', () => {
  //   subject(() => $Klass.scope({ where: $scope }));
  //   def('scope', () => ({ foo: 'bar' }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('passes scope to defaultScope', () => {
  //     expect($subject.defaultScope).toEqual({ foo: 'bar' });
  //   });

  //   context('defaultScope is already present', () => {
  //     def('defaultScope', () => ({ bar: 'baz' }));

  //     it('merges current scope', () => {
  //       expect($subject.defaultScope).toEqual(
  //         { $and: [{ bar: 'baz' }, { foo: 'bar' }] }
  //       );
  //     });
  //   });
  // });

  // describe('.unscope()', () => {
  //   subject(() => $Klass.unscope($args));
  //   def('args', () => 'foo');
  //   def('defaultScope', () => ({ foo : 1 }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('removes scope from defaultScope', () => {
  //     expect($Klass.defaultScope).toEqual($defaultScope);
  //     expect($subject.defaultScope).toEqual({});
  //   });

  //   context('when key is not in schema', () => {
  //     def('args', () => 'baz');

  //     it('does not change the defaultScope', () => {
  //       expect($subject.defaultScope).toEqual($defaultScope);
  //     });
  //   });

  //   context('defaultScope has multiple attributes', () => {
  //     def('defaultScope', () => ({ foo: 1, bar: 2 }));

  //     it('just removes one property of scope', () => {
  //       expect($subject.defaultScope).toEqual({ bar: 2 });
  //     });

  //     context('when unscoping multiple properties', () => {
  //       def('args', () => ['foo', 'bar']);

  //       it('removed all properties by key', () => {
  //         expect($subject.defaultScope).toEqual({});
  //       });
  //     });
  //   });
  // });

  // describe('.where()', () => {
  //   subject(() => $Klass.where($scope));
  //   def('scope', () => ({ foo: 'bar' }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('passes scope to defaultScope', () => {
  //     expect($subject.defaultScope).toEqual({ foo: 'bar' });
  //   });

  //   context('defaultScope is already present', () => {
  //     def('defaultScope', () => ({ bar: 'baz' }));

  //     it('merges current scope', () => {
  //       expect($subject.defaultScope).toEqual(
  //         { $and: [{ bar: 'baz' }, { foo: 'bar' }] }
  //       );
  //     });
  //   });
  // });

  // describe('.orWhere()', () => {
  //   subject(() => $Klass.orWhere($scope));
  //   def('scope', () => ({ foo: 'bar' }));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'integer' },
  //         bar: { type: 'integer' },
  //       };
  //     }

  //     static get defaultScope() {
  //       return $defaultScope;
  //     }
  //   });

  //   it('ruturns a NextModel', () => {
  //     expect($subject).to.be.a('function');
  //     expect($subject.modelName).toEqual('Klass');
  //   });

  //   it('passes scope to defaultScope', () => {
  //     expect($subject.defaultScope).toEqual({ foo: 'bar' });
  //   });

  //   context('defaultScope is already present', () => {
  //     def('defaultScope', () => ({ bar: 'baz' }));

  //     it('merges current scope', () => {
  //       expect($subject.defaultScope).toEqual(
  //         { $or: [{ bar: 'baz' }, { foo: 'bar' }] }
  //       );
  //     });
  //   });
  // });

  // describe('.createTable()', () => {
  //   subject(() => $Klass.createTable());

  //   context('when connector is present', () => {
  //     def('Klass', () => class Klass extends NextModel {
  //       static get connector() {
  //         return { createTable: function(Klass) {
  //           return Promise.resolve('called');
  //         }};
  //       }
  //     });

  //     it('calls the createTable function of the connector', () => {
  //       return $subject.then(data => expect(data).toEqual('called'));
  //     });
  //   });

  //   context('when connector is not present', () => {
  //     def('Klass', () => class Klass extends NextModel {});

  //     it('throws error if connector is not overwritten', () => {
  //       expect(() => $subject).toThrow();
  //     });
  //   });
  // });

  // describe('.fetchSchema()', () => {
  //   subject(() => $Klass.fetchSchema());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return $schema;
  //     }

  //     static get belongsTo() {
  //       return $belongsTo;
  //     }
  //   });

  //   it('returns empty schema', () => {
  //     expect($subject).toEqual({});
  //   });

  //   context('when schema is present', () => {
  //     def('schema', () => ({
  //       foo: { type: 'integer', defaultValue: 1 },
  //       bar: { type: 'integer', defaultValue: 2 },
  //     }));

  //     it('returns schema', () => {
  //       expect($subject).toEqual({
  //         foo: { type: 'integer', defaultValue: 1 },
  //         bar: { type: 'integer', defaultValue: 2 },
  //       });
  //     });
  //   });

  //   context('when type is not present', () => {
  //     def('schema', () => ({
  //       foo: { defaultValue: 'foo' },
  //       bar: { type: 'integer', defaultValue: 2 },
  //     }));

  //     it('adds type string if no type is present', () => {
  //       expect($subject).toEqual({
  //         foo: { type: 'string', defaultValue: 'foo' },
  //         bar: { type: 'integer', defaultValue: 2 },
  //       });
  //     });
  //   });

  //   context('when defaultValue is not present', () => {
  //     def('schema', () => ({
  //       foo: { type: 'integer' },
  //       bar: { type: 'integer', defaultValue: 2 },
  //     }));

  //     it('adds type string if no type is present', () => {
  //       expect($subject).toEqual({
  //         foo: {type: 'integer', defaultValue: null},
  //         bar: {type: 'integer', defaultValue: 2},
  //       });
  //     });
  //   });

  //   context('when belongsTo relation is present', () => {
  //     def('Foo', () => class Foo extends NextModel {
  //       static get modelName() {
  //         return 'Foo';
  //       }

  //       static get schema() {
  //         return {
  //           id: { type: 'integer' },
  //         };
  //       }
  //     });

  //     def('belongsTo', () => ({
  //       foo: { model: $Foo },
  //     }));

  //     it('adds join column to schema', () => {
  //       expect($subject).toEqual({ fooId: { type: 'integer', defaultValue: null }});
  //     });

  //     context('when belongsTo relation has foreignKey', () => {
  //       def('belongsTo', () => ({
  //         foo: { model: $Foo, foreignKey: 'baz' },
  //       }));

  //       it('adds join column to schema', () => {
  //         expect($subject).toEqual({ baz: { type: 'integer', defaultValue: null }});
  //       });
  //     });
  //   });

  //   context('when belongsTo relation class has identifier', () => {
  //     def('Foo', () => class Foo extends NextModel {
  //       static get modelName() {
  //         return 'Foo';
  //       }

  //       static get schema() {
  //         return {
  //           guid: { type: 'guid' },
  //         };
  //       }

  //       static get identifier() {
  //         return 'guid';
  //       }
  //     });

  //     def('belongsTo', () => ({
  //       foo: { model: $Foo },
  //     }));

  //     it('used identifier column as reverse lookup', () => {
  //       expect($subject).toEqual({ fooId: { type: 'guid', defaultValue: null }});
  //     });
  //   });

  //   context('when belongsTo relation class has defaultValue', () => {
  //     def('Foo', () => class Foo extends NextModel {
  //       static get modelName() {
  //         return 'Foo';
  //       }

  //       static get schema() {
  //         return {
  //           id: { type: 'integer', defaultValue: 0 },
  //         };
  //       }
  //     });

  //     def('belongsTo', () => ({
  //       foo: { model: $Foo },
  //     }));

  //     it('adds join column to schema', () => {
  //       expect($subject).toEqual({ fooId: { type: 'integer', defaultValue: 0 }});
  //     });
  //   });
  // });

  // describe('.fetchBelongsTo()', () => {
  //   subject(() => $Klass.fetchBelongsTo());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get belongsTo() {
  //       return {
  //         foo: { model: $Foo },
  //         bar: { model: $Foo, foreignKey: 'bazId' },
  //       };
  //     }
  //   });

  //   def('Foo', () => class Foo extends NextModel {
  //     static get modelName() {
  //       return 'Foo';
  //     }
  //   });

  //   it('prefills foreignKey if foreignKey is not present', () => {
  //     expect($subject).toEqual({
  //       foo: { model: $Foo, foreignKey: 'fooId' },
  //       bar: { model: $Foo, foreignKey: 'bazId' },
  //     });
  //   });
  // });

  // describe('.fetchHasMany()', () => {
  //   subject(() => $Klass.fetchHasMany());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get hasMany() {
  //       return {
  //         foo: { model: $Foo },
  //         bar: { model: $Foo, foreignKey: 'bazId' },
  //       };
  //     }
  //   });

  //   def('Foo', () => class Foo extends NextModel {
  //     static get modelName() {
  //       return 'Foo';
  //     }
  //   });

  //   it('prefills foreignKey if foreignKey is not present', () => {
  //     expect($subject).toEqual({
  //       foo: { model: $Foo, foreignKey: 'klassId' },
  //       bar: { model: $Foo, foreignKey: 'bazId' },
  //     });
  //   });
  // });

  // describe('.fetchHasOne()', () => {
  //   subject(() => $Klass.fetchHasOne());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get hasOne() {
  //       return {
  //         foo: { model: $Foo },
  //         bar: { model: $Foo, foreignKey: 'bazId' },
  //       };
  //     }
  //   });

  //   def('Foo', () => class Foo extends NextModel {
  //     static get modelName() {
  //       return 'Foo';
  //     }
  //   });

  //   it('prefills foreignKey if foreignKey is not present', () => {
  //     expect($subject).toEqual({
  //       foo: { model: $Foo, foreignKey: 'klassId' },
  //       bar: { model: $Foo, foreignKey: 'bazId' },
  //     });
  //   });
  // });

  // describe('.constructor', () => {
  //   subject(() => new $Klass($args));
  //   def('schema', () => ({}));
  //   def('belongsTo', () => ({}));
  //   def('hasMany', () => ({}));
  //   def('hasOne', () => ({}));

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return $schema;
  //     }

  //     static get belongsTo() {
  //       return $belongsTo;
  //     }

  //     static get hasMany() {
  //       return $hasMany;
  //     }

  //     static get hasOne() {
  //       return $hasOne;
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   def('Foo', () => class Foo extends NextModel {
  //     static get modelName() {
  //       return 'Foo';
  //     }

  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         klassId: { type: 'integer' },
  //       };
  //     }

  //     static get connector() {
  //       return mockConnector([
  //         { id: 1, klassId: 1 },
  //       ]);
  //     }
  //   });

  //   it('returns model instance', () => {
  //     expect($subject).to.be.a($Klass);
  //   });

  //   context('when schema is present', () => {
  //     def('schema', () => ({
  //       id: { type: 'integer' },
  //       bar: { type: 'string', defaultValue: 'bar' },
  //     }));

  //     it('returns model instance and sets default values', () => {
  //       expect($subject).to.be.a($Klass);
  //       expect($subject.id).toEqual(null);
  //       expect($subject.bar).toEqual('bar');
  //     });

  //     context('when passing attributes to constructor', () => {
  //       def('args', () => ({
  //         id: 1,
  //         bar: 'foo',
  //       }));

  //       it('returns model instance and sets attributes', () => {
  //         expect($subject).to.be.a($Klass);
  //         expect($subject.id).toEqual(1);
  //         expect($subject.bar).toEqual('foo');
  //       });

  //       context('when hasMany is present', () => {
  //         def('hasMany', () => ({
  //           foos: {model: $Foo},
  //         }));

  //         it('returns scope to foreign model', () => {
  //           expect($subject).to.be.a($Klass);
  //           expect($subject.foos).to.be.a('function');
  //           expect($subject.foos.defaultScope).toEqual({ klassId: 1 });
  //         });
  //       });

  //       context('when hasOne is present', () => {
  //         def('hasOne', () => ({
  //           foo: { model: $Foo },
  //         }));

  //         it('returns scope to foreign model', () => {
  //           expect($subject).to.be.a($Klass);
  //           return $subject.foo.then(data => {
  //             expect(data).to.be.a($Foo);
  //             expect(data.attributes).toEqual({ id: 1, klassId: 1 });
  //           });
  //         });
  //       });
  //     });

  //     context('when passing invalid attributes to constructor', () => {
  //       def('args', () => ({
  //         baz: 'foo',
  //       }));

  //       it('throws error while creating', () => {
  //         expect(() => $subject).toThrow();
  //       });
  //     });

  //     context('when attrAccessors are present', () => {
  //       def('attrAccessors', () => ['baz']);

  //       it('does not set accessor', () => {
  //         expect($subject).to.be.a($Klass);
  //         expect($subject.baz).toEqual(undefined);
  //       });

  //       context('when passing attributes to constructor', () => {
  //         def('args', () => ({
  //           baz: 'foo',
  //         }));

  //         it('returns model instance and sets attributes', () => {
  //           expect($subject).to.be.a($Klass);
  //           expect($subject.baz).toEqual('foo');
  //         });
  //       });
  //     });
  //   });

  //   context('when belongsTo is present', () => {
  //     def('belongsTo', () => ({
  //       foo: { model: $Foo },
  //     }));

  //     it('returns model instance and applies default values to foreignKey', () => {
  //       expect($subject).to.be.a($Klass);
  //       expect($subject.fooId).toEqual(null);
  //     });

  //     context('when passing attributes to constructor', () => {
  //       def('args', () => ({
  //         fooId: 1,
  //       }));

  //       it('sets passed value', () => {
  //         expect($subject).to.be.a($Klass);
  //         expect($subject.fooId).toEqual(1);
  //       });
  //     });
  //   });
  // });

  // // Properties

  // describe('#attributes', () => {
  //   subject(() => $klass.attributes);
  //   def('klass', () => new $Klass($args));
  //   def('args', () => ({}));
  //   def('attrAccessors', () => []);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   it('returns schema defined attributes', () => {
  //     expect($subject).toEqual({ foo: null });
  //   });

  //   context('when attribute is set', () => {
  //     def('args', () => ({ foo: 'bar' }));

  //     it('returns value', () => {
  //       expect($subject).toEqual({ foo: 'bar' });
  //     });
  //   });

  //   context('when unknown attribute is set', () => {
  //     beforeEach(() => {
  //       $klass.baz = 'foo';
  //     });

  //     it('ignores keys which are not in schema', () => {
  //       expect($subject).toEqual({ foo: null });
  //     });
  //   });

  //   context('when attrAccessors are present', () => {
  //     def('attrAccessors', () => ['bar']);
  //     def('args', () => ({ bar: 'foo' }));

  //     it('also returns keys from attrAccessors', () => {
  //       expect($subject).toEqual({ foo: null, bar: 'foo' });
  //     });
  //   });
  // });

  // describe('#databaseAttributes', () => {
  //   subject(() => $klass.databaseAttributes);
  //   def('klass', () => new $Klass($args));
  //   def('args', () => ({}));
  //   def('attrAccessors', () => []);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get identifier() {
  //       return $identifier;
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get attrAccessors() {
  //       return $attrAccessors;
  //     }
  //   });

  //   it('returns schema defined attributes', () => {
  //     expect($subject).toEqual({ foo: null });
  //   });

  //   context('when attribute is set', () => {
  //     def('args', () => ({ foo: 'bar' }));

  //     it('returns value', () => {
  //       expect($subject).toEqual({ foo: 'bar' });
  //     });

  //     context('when identifier is present', () => {
  //       def('identifier', () => 'id');

  //       it('returns attributes of schema', () => {
  //         expect($subject).toEqual({ foo: 'bar' });
  //       });
  //     });

  //     context('when identifier is in schema', () => {
  //       def('identifier', () => 'foo');

  //       it('returns attributes without identifier', () => {
  //         expect($subject).toEqual({});
  //       });
  //     });
  //   });

  //   context('when unknown attribute is set', () => {
  //     beforeEach(() => {
  //       $klass.baz = 'foo';
  //     });

  //     it('ignores keys which are not in schema', () => {
  //       expect($subject).toEqual({ foo: null });
  //     });
  //   });

  //   context('when attrAccessors are present', () => {
  //     def('attrAccessors', () => ['bar']);
  //     def('args', () => ({ bar: 'foo' }));

  //     it('only returns attributes from schema', () => {
  //       expect($subject).toEqual({ foo: null});
  //     });
  //   });
  // });

  // describe('#isNew', () => {
  //   subject(() => $klass.isNew);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get connector() {
  //       return { save: function(klass) {
  //         klass.id = 1;
  //         return Promise.resolve(true);
  //       }};
  //     }
  //   });

  //   def('klass', () => $Klass.build({ foo: 'bar' }));

  //   context('when model is build', () => {
  //     it('returns true', () => {
  //       expect($subject).toEqual(true);
  //     });
  //   });

  //   context('when model is created', () => {
  //     beforeEach(() => {
  //       return $klass.save();
  //     });

  //     it('returns false', () => {
  //       expect($subject).toEqual(false);
  //     });
  //   });
  // });

  // describe('#isPersisted', () => {
  //   subject(() => $klass.isPersisted);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get connector() {
  //       return { save: function(klass) {
  //         klass.id = 1;
  //         return Promise.resolve(true);
  //       }};
  //     }
  //   });

  //   def('klass', () => $Klass.build({ foo: 'bar' }));

  //   context('when model is build', () => {
  //     it('returns false', () => {
  //       expect($subject).toEqual(false);
  //     });
  //   });

  //   context('when model is created', () => {
  //     beforeEach(() => {
  //       return $klass.save();
  //     });

  //     it('returns true', () => {
  //       expect($subject).toEqual(true);
  //     });
  //   });
  // });

  // describe('#isChanged', () => {
  //   subject(() => () => $klass.isChanged);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         name: { type: 'string' },
  //       };
  //     }

  //     static get trackChanges() {
  //       return $trackChanges;
  //     }

  //     static get connector() {
  //       return mockConnector([]);
  //     }
  //   });

  //   def('trackChanges', () => true);

  //   def('klass', () => $Klass.build({ name: 'foo' }));

  //   it('is not changed', () => {
  //     expect($subject()).toEqual(false);
  //   });

  //   it('is not changed after save', () => {
  //     return $klass.save().then(data => {
  //       expect($subject()).toEqual(false);
  //       $klass.name = 'bar';
  //       expect($subject()).toEqual(true);
  //       return $klass.save();
  //     }).then(data => {
  //       expect($subject()).toEqual(false);
  //     });
  //   });

  //   it('is changed after value set', () => {
  //     $klass.name = 'bar';
  //     expect($subject()).toEqual(true);
  //   });

  //   it('is not changed when value is same', () => {
  //     $klass.name = 'foo';
  //     expect($subject()).toEqual(false);
  //   });

  //   it('is changed after assign', () => {
  //     $klass.assign({ name: 'bar' });
  //     expect($subject()).toEqual(true);
  //   });

  //   it('is changed after assignAttribute', () => {
  //     $klass.assignAttribute('name', 'bar');
  //     expect($subject()).toEqual(true);
  //   });

  //   context('when track changes is disabled', () => {
  //     def('trackChanges', () => false);

  //     it('is not changed after value set', () => {
  //       $klass.name = 'bar';
  //       expect($subject()).toEqual(false);
  //     });

  //     it('is not changed after assign', () => {
  //       $klass.assign({ name: 'bar' });
  //       expect($subject()).toEqual(false);
  //     });

  //     it('is not changed after assignAttribute', () => {
  //       $klass.assignAttribute('name', 'bar');
  //       expect($subject()).toEqual(false);
  //     });
  //   });
  // });

  // describe('#changes', () => {
  //   subject(() => () => $klass.changes);

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         name: { type: 'string' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get trackChanges() {
  //       return $trackChanges;
  //     }

  //     static get connector() {
  //       return mockConnector([]);
  //     }
  //   });

  //   def('trackChanges', () => true);

  //   def('klass', () => $Klass.build({ name: 'foo' }));

  //   it('is empty', () => {
  //     expect($subject()).toEqual({});
  //   });

  //   it('is empty after save', () => {
  //     return $klass.save().then(data => {
  //       expect($subject()).toEqual({});
  //       $klass.name = 'bar';
  //       expect($subject()).toEqual({ name: [
  //         { from: 'foo', to: 'bar' },
  //       ] });
  //       return $klass.save();
  //     }).then(data => {
  //       expect($subject()).toEqual({});
  //     });
  //   });

  //   it('tracks changes after value set', () => {
  //     $klass.name = 'bar';
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //   });

  //   it('tracks multiple changes after multiple edit', () => {
  //     $klass.name = 'bar';
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //     $klass.name = 'bar';
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //     $klass.name = 'baz';
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //       { from: 'bar', to: 'baz' },
  //     ] });
  //   });

  //   it('clears changes after edit to start value after multiple edit', () => {
  //     $klass.name = 'bar';
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //     $klass.name = 'foo';
  //     expect($subject()).toEqual({});
  //   });

  //   it('is empty when value is same', () => {
  //     $klass.name = 'foo';
  //     expect($subject()).toEqual({});
  //   });

  //   it('tracks changes after assign', () => {
  //     $klass.assign({ name: 'bar' });
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //   });

  //   it('tracks changes after assignAttribute', () => {
  //     $klass.assignAttribute('name', 'bar');
  //     expect($subject()).toEqual({ name: [
  //       { from: 'foo', to: 'bar' },
  //     ] });
  //   });

  //   it('tracks multiple changes after assign with multiple values', () => {
  //     $klass.assign({ name: 'bar', foo: 'bar' });
  //     expect($subject()).toEqual({
  //       name: [{ from: 'foo', to: 'bar' }],
  //       foo: [{ from: null, to: 'bar' }],
  //     });
  //   });

  //   context('when track changes is disabled', () => {
  //     def('trackChanges', () => false);

  //     it('is undefined', () => {
  //       expect($subject()).toEqual(undefined);
  //     });

  //     it('tracks no changes after value set', () => {
  //       $klass.name = 'bar';
  //       expect($subject()).toEqual(undefined);
  //     });

  //     it('tracks no changes after assign', () => {
  //       $klass.assign({ name: 'bar' });
  //       expect($subject()).toEqual(undefined);
  //     });

  //     it('tracks no changes after assignAttribute', () => {
  //       $klass.assignAttribute('name', 'bar');
  //       expect($subject()).toEqual(undefined);
  //     });

  //     it('tracks no changes after assign with multiple values', () => {
  //       $klass.assign({ name: 'bar', foo: 'bar' });
  //       expect($subject()).toEqual(undefined);
  //     });
  //   });
  // });

  // // Functions

  // describe('#assignAttribute()', () => {
  //   subject(() => $klass.assignAttribute($key, $value));
  //   def('klass', () => new $Klass($args));
  //   def('args', () => ({}));
  //   def('key', () => 'foo');
  //   def('value', () => 'bar');

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'string' },
  //       };
  //     }
  //   });


  //   it('assigns values for keys from schema', () => {
  //     expect($klass.foo).toEqual(null);
  //     expect($subject.foo).toEqual('bar');
  //     expect($klass.foo).toEqual('bar');
  //   });

  //   context('when key is not in schema', () => {
  //     def('key', () => 'baz');

  //     it('throws error', () => {
  //       expect(() => $subject).toThrow()
  //     });
  //   });


  //   context('when attribute is already set', () => {
  //     def('args', () => ({ foo: 'baz' }));

  //     it('overrides value', () => {
  //       expect($klass.foo).toEqual('baz');
  //       expect($subject.foo).toEqual('bar');
  //       expect($klass.foo).toEqual('bar');
  //     });
  //   });
  // });

  // describe('#assign()', () => {
  //   subject(() => $klass.assign({[$key]: $value}));
  //   def('klass', () => new $Klass($args));
  //   def('args', () => ({}));
  //   def('key', () => 'foo');
  //   def('value', () => 'bar');

  //   def('Klass', () => class Klass extends NextModel {
  //     static get modelName() {
  //       return 'Klass';
  //     }

  //     static get schema() {
  //       return {
  //         foo: { type: 'string' },
  //       };
  //     }
  //   });


  //   it('assigns values for keys from schema', () => {
  //     expect($klass.foo).toEqual(null);
  //     expect($subject.foo).toEqual('bar');
  //     expect($klass.foo).toEqual('bar');
  //   });

  //   context('when key is not in schema', () => {
  //     def('key', () => 'baz');

  //     it('throws error', () => {
  //       expect(() => $subject).toThrow()
  //     });
  //   });


  //   context('when attribute is already set', () => {
  //     def('args', () => ({ foo: 'baz' }));

  //     it('overrides value', () => {
  //       expect($klass.foo).toEqual('baz');
  //       expect($subject.foo).toEqual('bar');
  //       expect($klass.foo).toEqual('bar');
  //     });
  //   });
  // });

  // describe('#save()', () => {
  //   subject(() => $klass.save());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get connector() {
  //       return $connector;
  //     }
  //   });

  //   def('klass', () => $Klass.build());

  //   it('catches promise reject if connector is not overwritten', shared.promiseError);

  //   context('when connector is present', () => {
  //     def('connector', () => ({ save: function(klass) {
  //       klass.id = 1;
  //       return Promise.resolve(true);
  //     }}));

  //     it('saves the item', () => {
  //       expect($klass.id).toEqual(null);
  //       expect($klass.isNew).toEqual(true);
  //       return $subject.then(data => {
  //         expect(data).to.be.a($Klass);
  //         expect(data.id).toEqual(1);
  //         expect(data.isNew).toEqual(false);
  //       });
  //     });

  //     shared.behavesLikeActionWhichSupportsCallbacks({
  //       action: 'save',
  //       actionIsPromise: true,
  //     });
  //   });
  // });

  // describe('#delete()', () => {
  //   subject(() => $klass.delete());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get connector() {
  //       return $connector;
  //     }
  //   });

  //   def('klass', () => $Klass.build());
  //   beforeEach(() => {
  //     $klass.id = 1;
  //   });

  //   it('catches promise reject if connector is not overwritten', shared.promiseError);

  //   context('when connector is present', () => {
  //     def('connector', () => ({ delete: function(klass) {
  //       delete klass.id;
  //       return Promise.resolve(true);
  //     }}));

  //     it('deletes the item', () => {
  //       expect($klass.isNew).toEqual(false);
  //       return $subject.then(data => {
  //         expect(data).to.be.a($Klass);
  //         expect(data.isNew).toEqual(true);
  //       });
  //     });

  //     context('when item is new', () => {
  //       beforeEach(() => {
  //         delete $klass.id;
  //       });

  //       it('does not change the item', () => {
  //         expect($klass.isNew).toEqual(true);
  //         return $subject.then(data => {
  //           expect(data).to.be.a($Klass);
  //           expect(data.isNew).toEqual(true);
  //         });
  //       });
  //     });

  //     shared.behavesLikeActionWhichSupportsCallbacks({
  //       action: 'delete',
  //       actionIsPromise: true,
  //     });
  //   });
  // });

  // describe('#reload()', () => {
  //   subject(() => $klass.reload());

  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         foo: { type: 'string' },
  //       };
  //     }

  //     static get connector() {
  //       return $connector;
  //     }
  //   });

  //   def('klass', () => {
  //     const klass = $Klass.build({ foo: 'foo' });
  //     klass.id = $id;
  //     return klass;
  //   });
  //   def('id', () => undefined);

  //   it('returns unchanged item as long as item is new', () => {
  //     return $subject.then(data => {
  //       expect(data).toEqual($klass);
  //     })
  //   });

  //   context('when item is persisted', () => {
  //     def('id', () => 1);

  //     it('throws error if connector is not overwritten', () => {
  //       expect(() => $subject).toThrow();
  //     });

  //     context('when connector is present', () => {
  //       def('connector', () => mockConnector([$item]));

  //       context('when item is deleted', () => {
  //         def('item', () => undefined);

  //         it('flags item as new', () => {
  //           expect($klass.isNew).toEqual(false);

  //           return $subject.then(data => {
  //             expect(data).to.be.a($Klass);
  //             expect(data.isNew).toEqual(true);
  //             expect(data.foo).toEqual('foo');
  //           });
  //         });
  //       });

  //       context('when item is same', () => {
  //         def('item', () => $klass);

  //         it('does not change item', () => {
  //           return $subject.then(data => {
  //             expect(data).to.be.a($Klass);
  //             expect(data.id).toEqual($id);
  //             expect(data.foo).toEqual('foo');
  //           });
  //         });
  //       });

  //       context('when item has different values', () => {
  //         def('item', () => {
  //           const klass = $Klass.build({ foo: 'bar' });
  //           klass.id = $id;
  //           return klass;
  //         });

  //         it('updates values', () => {
  //           return $subject.then(data => {
  //             expect(data).to.be.a($Klass);
  //             expect(data.id).toEqual($id);
  //             expect(data.foo).toEqual('bar');
  //           });
  //         });
  //       });
  //     });
  //   });
  // });

  // describe('#afterChange()', () => {
  //   def('Klass', () => class Klass extends NextModel {
  //     static get schema() {
  //       return {
  //         id: { type: 'integer' },
  //         name: { type: 'string' },
  //       };
  //     }

  //     get afterChange() {
  //       return $afterChange;
  //     }

  //     get afterIdChange() {
  //       return $afterIdChange;
  //     }

  //     get afterNameChange() {
  //       return $afterNameChange;
  //     }

  //     static get trackChanges() {
  //       return $trackChanges;
  //     }

  //     static get connector() {
  //       return mockConnector([]);
  //     }
  //   });

  //   def('trackChanges', () => true);

  //   def('klass', () => $Klass.build({ name: 'foo' }));

  //   def('afterChange', () => sinon.spy());
  //   def('afterIdChange', () => sinon.spy());
  //   def('afterNameChange', () => sinon.spy());

  //   it('does not call on build', () => {
  //     expect($afterChange.called).toEqual(false);
  //     expect($afterIdChange.called).toEqual(false);
  //     expect($afterNameChange.called).toEqual(false);
  //   });

  //   it('calls change for id after save', () => {
  //     return $klass.save().then(data => {
  //       expect($afterChange.calledOnce).toEqual(true);
  //       expect($afterIdChange.calledOnce).toEqual(true);
  //       expect($afterNameChange.called).toEqual(false);
  //     });
  //   });

  //   it('calls change after value set', () => {
  //     $klass.name = 'bar';
  //     expect($afterChange.calledOnce).toEqual(true);
  //     expect($afterIdChange.called).toEqual(false);
  //     expect($afterNameChange.calledOnce).toEqual(true);
  //   });

  //   it('does not call change after value set to same value', () => {
  //     $klass.name = 'foo';
  //     expect($afterChange.called).toEqual(false);
  //     expect($afterIdChange.called).toEqual(false);
  //     expect($afterNameChange.called).toEqual(false);
  //   });

  //   it('calls change after assign', () => {
  //     $klass.assign({ name: 'bar' });
  //     expect($afterChange.calledOnce).toEqual(true);
  //     expect($afterIdChange.called).toEqual(false);
  //     expect($afterNameChange.calledOnce).toEqual(true);
  //   });

  //   it('calls change after assignAttribute', () => {
  //     $klass.assignAttribute('name', 'bar');
  //     expect($afterChange.calledOnce).toEqual(true);
  //     expect($afterIdChange.called).toEqual(false);
  //     expect($afterNameChange.calledOnce).toEqual(true);
  //   });

  //   context('callbacks on server side', () => {
  //     def('Klass', () => class Klass extends $Klass {
  //       get afterChangeServer() {
  //         return $afterChangeServer;
  //       }

  //       get afterIdChangeServer() {
  //         return $afterIdChangeServer;
  //       }

  //       get afterNameChangeServer() {
  //         return $afterNameChangeServer;
  //       }

  //       get afterChangeClient() {
  //         return $afterChangeClient;
  //       }

  //       get afterIdChangeClient() {
  //         return $afterIdChangeClient;
  //       }

  //       get afterNameChangeClient() {
  //         return $afterNameChangeClient;
  //       }
  //     });

  //     def('afterChangeServer', () => sinon.spy());
  //     def('afterIdChangeServer', () => sinon.spy());
  //     def('afterNameChangeServer', () => sinon.spy());
  //     def('afterChangeClient', () => sinon.spy());
  //     def('afterIdChangeClient', () => sinon.spy());
  //     def('afterNameChangeClient', () => sinon.spy());

  //     it('calls server change after value set', () => {
  //       $klass.name = 'bar';
  //       expect($afterChangeServer.calledOnce).toEqual(true);
  //       expect($afterIdChangeServer.called).toEqual(false);
  //       expect($afterNameChangeServer.calledOnce).toEqual(true);
  //     });

  //     it('does not call client change after value set', () => {
  //       $klass.name = 'bar';
  //       expect($afterChangeClient.called).toEqual(false);
  //       expect($afterIdChangeClient.called).toEqual(false);
  //       expect($afterNameChangeClient.called).toEqual(false);
  //     });
  //   });

  //   context('when track changes is disabled', () => {
  //     def('trackChanges', () => false);

  //     it('does not call change for id after save', () => {
  //       return $klass.save().then(data => {
  //         expect($afterChange.called).toEqual(false);
  //         expect($afterIdChange.called).toEqual(false);
  //         expect($afterNameChange.called).toEqual(false);
  //       });
  //     });

  //     it('does not call change after value set', () => {
  //       $klass.name = 'bar';
  //       expect($afterChange.called).toEqual(false);
  //       expect($afterIdChange.called).toEqual(false);
  //       expect($afterNameChange.called).toEqual(false);
  //     });

  //     it('does not call change after assign', () => {
  //       $klass.assign({ name: 'bar' });
  //       expect($afterChange.called).toEqual(false);
  //       expect($afterIdChange.called).toEqual(false);
  //       expect($afterNameChange.called).toEqual(false);
  //     });

  //     it('does not call change after assignAttribute', () => {
  //       $klass.assignAttribute('name', 'bar');
  //       expect($afterChange.called).toEqual(false);
  //       expect($afterIdChange.called).toEqual(false);
  //       expect($afterNameChange.called).toEqual(false);
  //     });
  //   });
  // });
});
