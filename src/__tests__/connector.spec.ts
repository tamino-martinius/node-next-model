import {
  Model,
  NextModel,
  Query,
  Attributes,
  Schema,
} from '../next_model';

import {
  Storage,
  DefaultConnector,
} from '../connector';

import {
  context,
} from './types';

let storage: Storage | undefined  = undefined;
let connector = () => new DefaultConnector(storage);

beforeEach(() => {
  storage = undefined;
})

describe('DefaultConnector', () => {
  describe('#all(model)', () => {
    let Klass: typeof NextModel;
    const subject = () => connector().all(Klass);

    context('with simple model', {
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
        test('returns empty array', () => {
          return expect(subject()).resolves.toEqual([]);
        });

        context('with single item prefilled storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 1 },
              ],
            };
          },
          tests() {
            test('returns all items as model instances', () => {
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
            test('returns all items as model instances', () => {
              return expect(subject()).resolves.toEqual([
                new Klass({ id: 1 }),
                new Klass({ id: 2 }),
                new Klass({ id: 3 }),
              ]);
            });

            context('when query for first item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                  ]);
                });
              },
            });

            context('when query for any item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 2,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 2 }),
                  ]);
                });
              },
            });

            context('when query for non existing property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 4,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns empty array', () => {
                  return expect(subject()).resolves.toEqual([]);
                });
              },
            });

            context('when query is with single $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 2 }),
                    new Klass({ id: 3 }),
                  ]);
                });
              },
            });

            context('when query is with multiple $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 3 }),
                  ]);
                });
              },
            });

            context('when query is with single $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                  ]);
                });
              },
            });

            context('when query is with multiple $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                  ]);
                });
              },
            });

            context('when query is with single $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                  ]);
                });
              },
            });

            context('when query is with multiple $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                    new Klass({ id: 2 }),
                  ]);
                });
              },
            });

            context('when query is nested', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        {
                          $or: [
                            { id: 1 },
                            { id: 2 },
                          ],
                        },
                        {
                          $not: [
                            { id: 3 },
                          ],
                        },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                    new Klass({ id: 2 }),
                  ]);
                });
              },
            });

            context('when multiple special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      $not: [
                        { id: 3 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                    new Klass({ id: 2 }),
                  ]);
                });
              },
            });

            context('when mixed normal and special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns all matching items as model instances', () => {
                  return expect(subject()).resolves.toEqual([
                    new Klass({ id: 1 }),
                  ]);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('#first(model)', () => {
    let Klass: typeof NextModel;
    const subject = () => connector().first(Klass);

    context('with simple model', {
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
        test('returns undefined', () => {
          return expect(subject()).resolves.toBeUndefined();
        });

        context('with single item prefilled storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 1 },
              ],
            };
          },
          tests() {
            test('returns all items as model instances', () => {
              return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
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
            test('returns all items as model instances', () => {
              return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
            });

            context('when query for first item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when query for any item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 2,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 2 }));
                });
              },
            });

            context('when query for non existing property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 4,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns undefined', () => {
                  return expect(subject()).resolves.toBeUndefined();
                });
              },
            });

            context('when query is with single $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 2 }));
                });
              },
            });

            context('when query is with multiple $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 3 }));
                });
              },
            });

            context('when query is with single $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when query is with multiple $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when query is with single $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when query is with multiple $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when query is nested', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        {
                          $or: [
                            { id: 1 },
                            { id: 2 },
                          ],
                        },
                        {
                          $not: [
                            { id: 3 },
                          ],
                        },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when multiple special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      $not: [
                        { id: 3 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });

            context('when mixed normal and special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns first matching item as model instances', () => {
                  return expect(subject()).resolves.toEqual(new Klass({ id: 1 }));
                });
              },
            });
          },
        });
      },
    });
  });

  describe('#count(model)', () => {
    let Klass: typeof NextModel;
    const subject = () => connector().count(Klass);

    context('with simple model', {
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
        test('returns zero', () => {
          return expect(subject()).resolves.toEqual(0);
        });

        context('with single item prefilled storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 1 },
              ],
            };
          },
          tests() {
            test('returns one', () => {
              return expect(subject()).resolves.toEqual(1);
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
            test('returns total count', () => {
              return expect(subject()).resolves.toEqual(3);
            });
    
            context('when query for first item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query for any item property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 2,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query for non existing property match', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      id: 4,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(0);
                });
              },
            });

            context('when query is with single $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(2);
                });
              },
            });

            context('when query is with multiple $not', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $not: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query is with single $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query is with multiple $and', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        { id: 1 },
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query is with single $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });

            context('when query is with multiple $or', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(2);
                });
              },
            });

            context('when query is nested', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $and: [
                        {
                          $or: [
                            { id: 1 },
                            { id: 2 },
                          ],
                        },
                        {
                          $not: [
                            { id: 3 },
                          ],
                        },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(2);
                });
              },
            });

            context('when multiple special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      $not: [
                        { id: 3 },
                      ],
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(2);
                });
              },
            });

            context('when mixed normal and special queries are in one layer', {
              definitions() {
                @Model
                class NewKlass extends Klass {
                  static get query(): Query {
                    return {
                      $or: [
                        { id: 1 },
                        { id: 2 },
                      ],
                      id: 1,
                    };
                  }
                };
                Klass = NewKlass;
              },
              tests() {
                test('returns count of  all matching items', () => {
                  return expect(subject()).resolves.toEqual(1);
                });
              },
            });
          },
        });
      },
    });
  });

  describe('#reload', () => {
    let Klass: typeof NextModel;
    let klass: () => NextModel = () => new Klass({id: 1});
    const subject = () => connector().reload(klass());

    context('with simple model', {
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
        test('returns undefined for empty storage', () => {
          return expect(subject()).resolves.toBeUndefined();
        });

        context('with item missing in prefilled storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 2 },
                { id: 3 },
              ],
            };
          },
          tests() {
            test('returns undefined', () => {
              return expect(subject()).resolves.toBeUndefined();
            });
          },
        });

        context('with item in prefilled storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 1 },
              ],
            };
          },
          tests() {
            test('returns klass from storage', () => {
              return expect(subject()).resolves.toEqual(new Klass({id: 1}));
            });

            context('with unsaved klass', {
              definitions() {
                klass = () => new Klass();
              },
              tests() {
                test('returns klass from storage', () => {
                  return expect(subject()).resolves.toBeUndefined();
                });
              },
            });
          },
        });
      },
    });
  });

  describe('#insert(instance)', () => {
    let Klass: typeof NextModel;
    let items: Attributes[];
    let attrs: Attributes | undefined = undefined;
    let cn: DefaultConnector;
    let klass: () => NextModel = () => new Klass(attrs);
    const subject = () => {
      cn = connector();
      items = cn.items(Klass);
      return cn.create(klass());
    }

    context('with simple model', {
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
        test('sets instance id and adds item to storage', () => {
          return subject().then(instance => {
            expect(instance).toEqual(new Klass({id: 1}));
            expect(items).toEqual([
              {id: 1},
            ]);
            return cn.create(new Klass());
          }).then(instance => {
            expect(instance).toEqual(new Klass({id: 2}));
            expect(items).toEqual([
              {id: 1},
              {id: 2},
            ]);
          });
        });
      },
    });

    context('with complex model', {
      definitions() {
        attrs = {
          foo: 'bar',
          bar: 'baz',
        };

        @Model
        class NewKlass extends NextModel {
          static get modelName(): string {
            return 'Foo';
          }

          static get schema(): Schema {
            return {
              foo: { type: 'string' },
            }
          }

          static get attrAccessors(): string[] {
            return ['bar'];
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('sets instance id and adds item to storage', () => {
          return subject().then(instance => {
            expect(instance).toEqual(new Klass({id: 1, foo: 'bar', bar: 'baz'}));
            expect(items).toEqual([
              {id: 1, foo: 'bar'},
            ]);
            return cn.create(new Klass());
          }).then(instance => {
            expect(instance).toEqual(new Klass({id: 2}));
            expect(items).toEqual([
              {foo: 'bar', id: 1},
              {id: 2},
            ]);
          });
        });
      },
    });
  });

  describe('#update(instance)', () => {
    let Klass: typeof NextModel;
    let items: Attributes[];
    let attrs: Attributes | undefined = undefined;
    let cn: DefaultConnector;
    let klass: () => NextModel = () => new Klass(attrs);
    const subject = () => {
      cn = connector();
      items = cn.items(Klass);
      return cn.update(klass());
    }

    context('with complex model', {
      definitions() {
        attrs = {
          id: 1,
          foo: 'bar',
          bar: 'baz',
        };

        storage = {
          Foo: [
            { id: 1, foo: 'foo' },
          ],
        };

        @Model
        class NewKlass extends NextModel {
          static get modelName(): string {
            return 'Foo';
          }

          static get schema(): Schema {
            return {
              foo: { type: 'string' },
            }
          }

          static get attrAccessors(): string[] {
            return ['bar'];
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('updates item within storage storage', () => {
          return subject().then(instance => {
            expect(instance).toEqual(new Klass({id: 1, foo: 'bar', bar: 'baz'}));
            expect(items).toEqual([
              {id: 1, foo: 'bar'},
            ]);
            return cn.update(new Klass({id: 1}));
          }).then(instance => {
            expect(instance).toEqual(new Klass({id: 1, foo: undefined}));
            expect(items).toEqual([
              {id: 1, foo: undefined},
            ]);
          });
        });

        context('when item is not in storage', {
          definitions() {
            storage = {
              Foo: [
                { id: 2, foo: 'foo' },
              ],
            };
          },
          tests() {
            test('does not change storage', () => {
              return subject().then(instance => {
                expect(instance).toEqual(new Klass({id: 1, foo: 'bar', bar: 'baz'}));
                expect(items).toEqual([
                  {id: 2, foo: 'foo'},
                ]);
              });
            });
          },
        });
      },
    });
  });

  describe('#delete(instance)', () => {
    let Klass: typeof NextModel;
    let items: Attributes[];
    let cn: DefaultConnector;
    const subject = (item: NextModel) => {
      cn = connector();
      items = cn.items(Klass);
      return cn.delete(item);
    }

    context('with simple model', {
      definitions() {
        storage = {
          Foo: [
            { id: 1 },
            { id: 3 },
          ],
        };

        @Model
        class NewKlass extends NextModel {
          static get modelName(): string {
            return 'Foo';
          }
        };
        Klass = NewKlass;
      },
      tests() {
        test('removed item from storage', () => {
          return subject(new Klass({ id: 1 })).then(instance => {
            expect(instance).toEqual(new Klass({ id: 1 }));
            expect(items).toEqual([
              {id: 3},
            ]);
            return cn.delete(new Klass({id: 2}));
          }).then(instance => {
            expect(instance).toEqual(new Klass({ id: 2 }));
            expect(items).toEqual([
              { id: 3 },
            ]);
          });
        });
      },
    });
  });
});
