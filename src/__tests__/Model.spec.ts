import { Dict, Filter, KeyType, MemoryConnector, Model, Order, Storage } from '..';
import { context, it } from '.';

describe('Model', () => {
  let storage: Storage = {};

  let tableName = 'foo';
  let init = () => ({});
  let skip: number | undefined;
  let limit: number | undefined;
  let filter: Filter<any> | undefined;
  let order: Order<any> | undefined;
  let connector = () => new MemoryConnector({ storage });
  let keys: Dict<KeyType> | undefined;

  const seed = [
    { id: 1, foo: 'bar', bar: 'baz' },
    { id: 2, foo: null, bar: 'baz' },
    { id: 3, foo: 'bar', bar: null },
  ];
  function withSeededData(tests: () => void) {
    context('with seeded data', {
      definitions: () =>
        (storage = {
          [tableName]: seed,
        }),
      reset: () => (storage = {}),
      tests,
    });
  }

  function itReturnsClass(subject: () => any) {
    it('returns class', () => {
      const Model = subject();
      expect(typeof Model).toEqual('function');
      expect(typeof Model.prototype).toEqual('object');
    });
  }

  const attributesOf = (items: any[]) => items.map(item => item.attributes as Dict<any>);

  const CreateModel = () =>
    Model({
      tableName,
      init,
      skip,
      limit,
      filter,
      order,
      connector: connector(),
      keys,
    });

  const subject = () => CreateModel();

  itReturnsClass(subject);

  describe('filter parameter', () => {
    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('without filter', {
          definitions: () => (filter = undefined),
          reset: () => (filter = undefined),
          tests: () => {
            it('promises to return all matching items as model instances', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = undefined),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter(item => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .filterBy({ bar: 'baz' } as Filter<any>)
                  .all();

              it('uses intersection of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter(item => item.foo === 'bar' && item.bar === 'baz');
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.filterBy', () => {
    let filter: Filter<any> = {};

    const subject = () => CreateModel().filterBy(filter);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () =>
          CreateModel()
            .filterBy(filter)
            .all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter(item => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .filterBy(filter)
                  .filterBy({ bar: 'baz' } as Filter<any>)
                  .all();

              it('uses intersection of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter(item => item.foo === 'bar' && item.bar === 'baz');
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.orFilterBy', () => {
    let filter: Filter<any> = {};

    const subject = () => CreateModel().orFilterBy(filter);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () =>
          CreateModel()
            .orFilterBy(filter)
            .all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { id: 1 }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter(item => item.id === 1);
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            describe('when additional filter is present', () => {
              const subject = () =>
                CreateModel()
                  .orFilterBy(filter)
                  .orFilterBy({ id: 2 } as Filter<any>)
                  .all();

              it('uses union of both filters', async () => {
                const instances = await subject();
                const expectedItems = seed.filter(item => item.id === 1 || item.id === 2);
                expect(attributesOf(instances)).toEqual(expectedItems);
              });
            });
          },
        });
      });
    });
  });

  describe('.unfiltered', () => {
    const subject = () => CreateModel().unfiltered;

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unfiltered.all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { id: 1 }),
          reset: () => (filter = {}),
          tests: () => {
            it('resets filter', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  describe('.limitBy', () => {
    let limit: number = Number.MAX_SAFE_INTEGER;

    const subject = () => CreateModel().limitBy(limit);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () =>
          CreateModel()
            .limitBy(limit)
            .all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter(item => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            context('limit lower then expected count', {
              definitions: () => (limit = 1),
              reset: () => (limit = Number.MAX_SAFE_INTEGER),
              tests: () => {
                it('limits returned results', async () => {
                  const instances = await subject();
                  const expectedItems = seed.filter(item => item.foo === 'bar').splice(0, 1);
                  expect(attributesOf(instances)).toEqual(expectedItems);
                });
              },
            });
          },
        });
      });
    });
  });

  describe('.unlimited', () => {
    const subject = () => CreateModel().unlimited;

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unlimited.all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with limit', {
          definitions: () => (limit = 1),
          reset: () => (limit = undefined),
          tests: () => {
            it('resets limit', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  describe('.skipBy', () => {
    let skip: number = 0;

    const subject = () => CreateModel().skipBy(skip);

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () =>
          CreateModel()
            .skipBy(skip)
            .all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with filter', {
          definitions: () => (filter = { foo: 'bar' }),
          reset: () => (filter = {}),
          tests: () => {
            it('uses filter', async () => {
              const instances = await subject();
              const expectedItems = seed.filter(item => item.foo === 'bar');
              expect(attributesOf(instances)).toEqual(expectedItems);
            });

            context('skip lower then expected count', {
              definitions: () => (skip = 1),
              reset: () => (skip = 1),
              tests: () => {
                it('skips returned results', async () => {
                  const instances = await subject();
                  const expectedItems = seed.filter(item => item.foo === 'bar').splice(1, 1);
                  expect(attributesOf(instances)).toEqual(expectedItems);
                });
              },
            });
          },
        });
      });
    });
  });

  describe('.unskipped', () => {
    const subject = () => CreateModel().unskipped;

    itReturnsClass(subject);

    withSeededData(() => {
      describe('when testing query results', () => {
        const subject = () => CreateModel().unskipped.all();

        it('promises to return all matching items as model instances', async () => {
          const instances = await subject();
          expect(attributesOf(instances)).toEqual(seed);
        });

        context('with skip', {
          definitions: () => (skip = 1),
          reset: () => (skip = undefined),
          tests: () => {
            it('resets skip', async () => {
              const instances = await subject();
              expect(attributesOf(instances)).toEqual(seed);
            });
          },
        });
      });
    });
  });

  // describe('.order', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;

  //   const subject = () => Klass.order;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array by default', () => {
  //         expect(subject()).toEqual([]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the name of the model', () => {
  //             expect(subject()).toEqual(order);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.keys', () => {
  //   let Klass: typeof Model;
  //   let schema: Schema<any> = Faker.schema;

  //   const subject = () => Klass.keys;

  //   context('schema is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('throws Error', () => {
  //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
  //       });

  //       context('when schema is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get schema(): Schema<any> {
  //               return schema;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the schema keys of the model', () => {
  //             expect(subject()).toEqual(Object.keys(schema));
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Relations
  // pending('.relations');

  // describe('.validators', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let validators: Validator<any>[] = Faker.validators;

  //   const subject = () => Klass.validators;

  //   it('returns empty validators', () => {
  //     expect(subject()).toEqual([]);
  //   });

  //   context('when validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return validators;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns the validators of the model', () => {
  //         expect(subject()).toEqual(validators);
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Strict
  // describe('.strictSchema', () => {
  //   let Klass: typeof Model;
  //   let schema: Schema<any> = Faker.schema;

  //   const subject = () => Klass.strictSchema;

  //   context('schema is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('throws Error', () => {
  //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
  //       });

  //       context('when schema is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get schema(): Schema<any> {
  //               return schema;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns the schema with filled properties', () => {
  //             expect(subject()).toEqual(schema);
  //             for (const key in schema) {
  //               expect('defaultValue' in subject()[key]).toBeTruthy();
  //             }
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // pending('.strictRelations');

  // describe('.strictFilter', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.strictFilter;

  //   it('returns empty filter', () => {
  //     expect(subject()).toEqual({});
  //   });

  //   context('when filter is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get filter(): Filter<any> {
  //           return filter;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns the strict filter of the model', () => {
  //         expect(subject()).toEqual(filter);
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Queries
  // describe('.limitBy(amount)', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let limit: number = Faker.limit;

  //   const subject = () => Klass.limitBy(limit);

  //   it('changes limit for new scope and keeps old scope unchanged', () => {
  //     expect(subject().limit).toEqual(limit);
  //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
  //   });
  // });

  // describe('.unlimited', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let limit: number = Faker.limit;

  //   const subject = () => Klass.unlimited;

  //   it('changes limit to default', () => {
  //     expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
  //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
  //   });

  //   context('when limit is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get limit(): number {
  //           return limit;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('changes limit for new scope and keeps old scope unchanged', () => {
  //         expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
  //         expect(Klass.limit).toEqual(limit);
  //       });
  //     },
  //   });
  // });

  // describe('.skipBy(amount)', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let skip: number = Faker.skip;

  //   const subject = () => Klass.skipBy(skip);

  //   it('changes skip for new scope and keeps old scope unchanged', () => {
  //     expect(subject().skip).toEqual(skip);
  //     expect(Klass.skip).toEqual(0);
  //   });
  // });

  // describe('.unskipped', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let skip: number = Faker.skip;

  //   const subject = () => Klass.unskipped;

  //   it('changes skip to default', () => {
  //     expect(subject().skip).toEqual(0);
  //     expect(Klass.skip).toEqual(0);
  //   });

  //   context('when skip is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get skip(): number {
  //           return skip;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('changes skip for new scope and keeps old scope unchanged', () => {
  //         expect(subject().skip).toEqual(0);
  //         expect(Klass.skip).toEqual(skip);
  //       });
  //     },
  //   });
  // });

  // describe('.orderBy(order)', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;
  //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

  //   const subject = () => Klass.orderBy(orderItem);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns order item as array', () => {
  //         expect(subject().order).toEqual([orderItem]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds order item to existing order', () => {
  //             expect(subject().order).toEqual([...order, orderItem]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.reorder(order)', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;
  //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };

  //   const subject = () => Klass.reorder(orderItem);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns order item as array', () => {
  //         expect(subject().order).toEqual([orderItem]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('removes current order and returns order item as array', () => {
  //             expect(subject().order).toEqual([orderItem]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.unordered', () => {
  //   let Klass: typeof Model;
  //   let order: Partial<Order<any>>[] = Faker.order;

  //   const subject = () => Klass.unordered;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty order', () => {
  //         expect(subject().order).toEqual([]);
  //       });

  //       context('when order is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get order(): Partial<Order<any>>[] {
  //               return order;
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('returns empty order', () => {
  //             expect(subject().order).toEqual([]);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.query(filter)', () => {
  //   let Klass: typeof Model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.query(filter);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual(filter);
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds filter to existing filter and returns model', () => {
  //             expect(subject().filter).toEqual({ $and: [
  //               filter,
  //               { id: 1 },
  //             ]});
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.onlyQuery(filter)', () => {
  //   let Klass: typeof Model;
  //   let filter: Filter<any> = Faker.filter;

  //   const subject = () => Klass.onlyQuery(filter);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual(filter);
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter and returns model', () => {
  //             expect(subject().filter).toEqual(filter);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.queryBy', () => {
  //   let Klass: typeof Model;
  //   let ids: number | number[] = 2;

  //   const subject = () => Klass.queryBy.id(ids);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter and returns model', () => {
  //         expect(subject().filter).toEqual({ id: 2 });
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends Klass {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('adds filter to existing filter and returns model', () => {
  //             expect(subject().filter).toEqual({
  //               $and: [
  //                 { id: 2 },
  //                 { id: 1 },
  //               ]
  //             });
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when passing array of values', {
  //     definitions() {
  //       ids = [1, 2]
  //     },
  //     tests() {
  //       context('model is not extended', {
  //         definitions() {
  //           class NewKlass extends Faker.model { };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter and returns model', () => {
  //             expect(subject().filter).toEqual({ $in: { id: [1, 2] } });
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 1 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('adds filter to existing filter and returns model', () => {
  //                 expect(subject().filter).toEqual({
  //                   $and: [
  //                     { $in: { id: [1, 2] } },
  //                     { id: 1 },
  //                   ]
  //                 });
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.unfiltered', () => {
  //   let Klass: typeof Model;

  //   const subject = () => Klass.unfiltered;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends NextModel<any>() { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('sets filter to empty and returns model', () => {
  //         expect(subject().filter).toEqual({});
  //       });

  //       context('when filter is present', {
  //         definitions() {
  //           class NewKlass extends NextModel<any>() {
  //             static get filter(): Filter<any> {
  //               return { id: 1 };
  //             }
  //           };
  //           Klass = NewKlass;
  //         },
  //         tests() {
  //           it('sets filter to empty and returns model', () => {
  //             expect(subject().filter).toEqual({});
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.all', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.all;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const data = await subject();
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const data = await subject();
  //             const attrArr = data.map(instance => instance.attributes);
  //             expect(attrArr).toEqual([instance.attributes]);
  //             expect(data[0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const data = await subject();
  //                 expect(data).toEqual([]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // pending('.pluck');

  // pending('.select');

  // describe('.updateAll(attrs)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   const attrs = { test: 1 };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.updateAll(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get schema() {
  //           const schema = super.schema;
  //           schema.test = { type: DataType.string };
  //           return schema;
  //         }

  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const model = await subject();
  //         const data = await model.all;
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const model = await subject();
  //             const data = await model.all;
  //             const attrArr = data.map(instance => instance.attributes);
  //             const attributes = instance.attributes;
  //             attributes.test = 1;
  //             expect(attrArr).toEqual([attributes]);
  //             expect(data[0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const model = await subject();
  //                 const data = await model.all;
  //                 expect(data).toEqual([]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.deleteAll()', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.deleteAll();

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const model = await subject();
  //         const data = await model.all;
  //         expect(data).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const model = await subject();
  //             const data = await model.all;
  //             expect(data).toEqual([]);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const model = await subject();
  //                 const data = await model.all;
  //                 expect(data).toEqual([]);
  //                 const allData = await Klass.unfiltered.all;
  //                 expect(allData.map(instance => instance.attributes))
  //                   .toEqual([instance.attributes]);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.inBatchesOf(amount)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let amount = 1;

  //   const subject = () => Klass.inBatchesOf(amount);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const dataPromises = await subject();
  //         const datas = await Promise.all(dataPromises);
  //         expect(datas).toEqual([]);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const dataPromises = await subject();
  //             const datas = await Promise.all(dataPromises);
  //             expect(datas.length).toEqual(1);
  //             const attrArr = datas[0].map(instance => instance.attributes);
  //             expect(attrArr).toEqual([instance1.attributes]);
  //             expect(datas[0][0]).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const dataPromises = await subject();
  //                 const datas = await Promise.all(dataPromises);
  //                 expect(datas).toEqual([]);
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const dataPromises = await subject();
  //                 const datas = await Promise.all(dataPromises);
  //                 expect(datas.length).toEqual(2);
  //                 const attrArr1 = datas[0].map(instance => instance.attributes);
  //                 expect(attrArr1).toEqual([instance1.attributes]);
  //                 const attrArr2 = datas[1].map(instance => instance.attributes);
  //                 expect(attrArr2).toEqual([instance2.attributes]);
  //                 expect(datas[0][0]).toBeInstanceOf(Klass);
  //                 expect(datas[1][0]).toBeInstanceOf(Klass);
  //               });

  //               context('when amount is 2', {
  //                 definitions() {
  //                   amount = 2;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const dataPromises = await subject();
  //                     const datas = await Promise.all(dataPromises);
  //                     expect(datas.length).toEqual(1);
  //                     expect(datas[0].length).toEqual(2);
  //                     const attrArr = datas[0].map(instance => instance.attributes);
  //                     expect(attrArr).toEqual([
  //                       instance1.attributes,
  //                       instance2.attributes,
  //                     ]);
  //                     expect(datas[0][0]).toBeInstanceOf(Klass);
  //                     expect(datas[0][1]).toBeInstanceOf(Klass);
  //                   });
  //                 },
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const dataPromises = await subject();
  //                     const datas = await Promise.all(dataPromises);
  //                     expect(datas).toEqual([]);
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.first', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;

  //   const subject = () => Klass.first;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });
  //             },
  //           });

  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.find(query)', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let query = {};

  //   const subject = () => Klass.find(query);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when non matching filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: 0 };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });

  //               context('when matching filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: instance2.id };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance.attributes).toEqual(instance2.attributes);
  //                     expect(instance).toBeInstanceOf(Klass);
  //                   });

  //                   context('when query is present', {
  //                     definitions() {
  //                       query = { id: 0 };
  //                     },
  //                     tests() {
  //                       it('filters data', async () => {
  //                         const instance = await subject();
  //                         expect(instance).toBeUndefined();
  //                       });
  //                     },
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.findBy', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance1: ModelConstructor<any>;
  //   let instance2: ModelConstructor<any>;
  //   let query = () => instance1 ? instance1.id : 0;

  //   const subject = () => Klass.findBy.id(query());

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const instance = await subject();
  //         expect(instance).toBeUndefined();
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance1 = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const instance = await subject();
  //             expect(instance.attributes).toEqual(instance1.attributes);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const instance = await subject();
  //                 expect(instance).toBeUndefined();
  //               });
  //             },
  //           });

  //           context('when multiple data', {
  //             async definitions() {
  //               instance2 = await Klass.create({});
  //             },
  //             tests() {
  //               it('calls connector with model', async () => {
  //                 const instance = await subject();
  //                 expect(instance.attributes).toEqual(instance1.attributes);
  //                 expect(instance).toBeInstanceOf(Klass);
  //               });

  //               context('when filter is present', {
  //                 definitions() {
  //                   class NewKlass extends Klass {
  //                     static get filter(): Filter<any> {
  //                       return { id: instance2.id };
  //                     }
  //                   };
  //                   Klass = NewKlass;
  //                 },
  //                 tests() {
  //                   it('filters data', async () => {
  //                     const instance = await subject();
  //                     expect(instance).toBeUndefined();
  //                   });
  //                 },
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.count', () => {
  //   let Klass: typeof Model;
  //   let connector: Connector<any> = Faker.connector;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => Klass.count;

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {
  //         static get connector() {
  //           return connector;
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns empty array', async () => {
  //         const count = await subject();
  //         expect(count).toEqual(0);
  //       });

  //       context('when data is present', {
  //         async definitions() {
  //           instance = await Klass.create({});
  //         },
  //         tests() {
  //           it('calls connector with model', async () => {
  //             const count = await subject();
  //             expect(count).toEqual(1);
  //           });

  //           context('when filter is present', {
  //             definitions() {
  //               class NewKlass extends Klass {
  //                 static get filter(): Filter<any> {
  //                   return { id: 0 };
  //                 }
  //               };
  //               Klass = NewKlass;
  //             },
  //             tests() {
  //               it('filters data', async () => {
  //                 const count = await subject();
  //                 expect(count).toEqual(0);
  //               });
  //             },
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Creating Instances
  // describe('.new(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => new Klass(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model {};
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', () => {
  //         const instance = subject();
  //         expect(instance.attributes).toEqual(attrs);
  //         expect(instance).toBeInstanceOf(Klass);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { id: 1 };
  //         },
  //         tests() {
  //           it('sets attributes', () => {
  //             const instance = subject();
  //             expect(instance.attributes).toEqual(attrs);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.build(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => Klass.build(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', () => {
  //         const instance = subject();
  //         expect(instance.attributes).toEqual(attrs);
  //         expect(instance).toBeInstanceOf(Klass);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { id: 1 };
  //         },
  //         tests() {
  //           it('sets attributes', () => {
  //             const instance = subject();
  //             expect(instance.attributes).toEqual(attrs);
  //             expect(instance).toBeInstanceOf(Klass);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('.create(attrs)', () => {
  //   let Klass: typeof Model;
  //   let attrs = {};
  //   const subject = () => Klass.create(attrs);

  //   context('model is not extended', {
  //     definitions() {
  //       class NewKlass extends Faker.model { };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns instance', async () => {
  //         const instance = await subject();
  //         expect(instance.id).toBeDefined()
  //         expect(instance).toBeInstanceOf(Klass);
  //         expect(await Klass.count).toEqual(1);
  //       });

  //       context('when attributes are set', {
  //         definitions() {
  //           attrs = { [Object.keys(Klass.schema)[0]]: 'foo' };
  //         },
  //         tests() {
  //           it('sets attributes', async () => {
  //             const instance = await subject();
  //             const key = Object.keys(Klass.schema)[0];
  //             expect(instance.attributes[key]).toEqual('foo');
  //             expect(instance).toBeInstanceOf(Klass);
  //             expect(await Klass.count).toEqual(1);
  //           });
  //         },
  //       });
  //     },
  //   });
  // });
  // //#endregion
  // //#endregion

  // //#region Instance
  // //#region Properites
  // describe('#id', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.id;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeUndefined();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeDefined();
  //       });
  //     },
  //   });
  // });

  // describe('#model', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.model;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns model of instance', async () => {
  //         expect(subject()).toBe(Klass);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns model of instance', async () => {
  //         expect(subject()).toBe(Klass);
  //       });
  //     },
  //   });
  // });

  // describe('#attributes', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.attributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#persistentAttributes', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.persistentAttributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#isNew', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isNew;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#isPersistent', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isPersistent;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns undefined', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('returns identifier', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });
  // });

  // describe('#isChanged', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.isChanged;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#isValid', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let trueValidator: Validator<any> = (instance) => Promise.resolve(true);
  //   let falseValidator: Validator<any> = (instance) => Promise.resolve(false);
  //   const subject = () => Klass.build({}).isValid;

  //   it('returns true', async () => {
  //     expect(await subject()).toBeTruthy();
  //   });

  //   context('when true validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [trueValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns true', async () => {
  //         expect(await subject()).toBeTruthy();
  //       });
  //     },
  //   });

  //   context('when false validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [falseValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns false', async () => {
  //         expect(await subject()).toBeFalsy();
  //       });
  //     },
  //   });

  //   context('when mixed validators is present', {
  //     definitions() {
  //       class NewKlass extends Klass {
  //         static get validators(): Validator<any>[] {
  //           return [trueValidator, falseValidator];
  //         }
  //       };
  //       Klass = NewKlass;
  //     },
  //     tests() {
  //       it('returns false', async () => {
  //         expect(await subject()).toBeFalsy();
  //       });
  //     },
  //   });
  // });

  // describe('#changes', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({
  //           foo: {
  //             from: undefined,
  //             to: 'bar',
  //           },
  //         });
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Manipulation
  // describe('#assign(attrs)', () => {
  //   let attrs: any = {};
  //   let key: string = 'foo';
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.assign(attrs).attributes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual(attrs);
  //       });
  //     },
  //   });

  //   context('when attributes have key which is not at schema', {
  //     async definitions() {
  //       attrs = { notInSchema: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject().notInSchema).toBeUndefined();
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when attributes have key which is present at schema', {
  //     async definitions() {
  //       attrs = { [key]: 'foo' };
  //     },
  //     tests() {
  //       context('when instance is build', {
  //         definitions() {
  //           instance = Klass.build(attrs);
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });

  //       context('when instance is created', {
  //         async definitions() {
  //           instance = await Klass.create(attrs);
  //           attrs.id = instance.id;
  //         },
  //         tests() {
  //           it('does not set invalid key', async () => {
  //             expect(subject()[key]).toEqual('foo');
  //           });
  //         },
  //       });
  //     },
  //   });
  // });

  // describe('#revertChange(key)', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.revertChange(key).changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });

  //       context('when key is not changed', {
  //         definitions() {
  //           key = 'bar';
  //         },
  //         tests() {
  //           it('returns attributes of instance', async () => {
  //             expect(subject()).toEqual({
  //               foo: {
  //                 from: undefined,
  //                 to: 'bar',
  //               },
  //             });
  //           });
  //         },
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });

  // describe('#revertChanges()', () => {
  //   let key: string = 'foo';
  //   let attrs: any = { [key]: 'bar' };
  //   let Klass: typeof Model = class NewKlass extends Faker.model {
  //     static get schema() {
  //       const schema = super.schema;
  //       schema[key] = { type: DataType.string };
  //       return schema;
  //     }
  //   };
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.revertChanges().changes;

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build(attrs);
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create(attrs);
  //       attrs.id = instance.id;
  //     },
  //     tests() {
  //       it('returns attributes of instance', async () => {
  //         expect(subject()).toEqual({});
  //       });
  //     },
  //   });
  // });
  // //#endregion

  // //#region Storage
  // describe('#save()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.save();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('saves instance', async () => {
  //         expect(await Klass.all).toEqual([]);
  //         expect(instance.isNew).toBeTruthy();
  //         expect((await subject()).isNew).toBeFalsy();
  //         const data = (await Klass.all).map(instance => instance.attributes);
  //         expect(data).toEqual([instance.attributes]);
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('saves changes', async () => {
  //         const count = await Klass.count;
  //         const keys = Object.keys(Klass.schema);
  //         instance.assign({
  //           [keys[0]]: 'foo',
  //           [keys[1]]: 'bar',
  //         });
  //         expect(instance.isChanged).toBeTruthy();
  //         expect((await subject()).isChanged).toBeFalsy();
  //         expect(await Klass.count).toEqual(count);
  //       });
  //     },
  //   });
  // });

  // describe('#delete()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.delete();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns error', () => {
  //         return expect(subject()).rejects.toEqual('[TODO] Cant find error');
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('deletes instance', async () => {
  //         const count = await Klass.count;
  //         const deletedInstance = await subject();
  //         expect(deletedInstance).toBeInstanceOf(Klass);
  //         expect(deletedInstance.attributes).toEqual(instance.attributes);
  //         expect(await Klass.count).toEqual(count - 1);
  //       });
  //     },
  //   });
  // });

  // describe('#reload()', () => {
  //   let Klass: typeof Model = Faker.model;
  //   let instance: ModelConstructor<any>;

  //   const subject = () => instance.reload();

  //   context('when instance is build', {
  //     definitions() {
  //       instance = Klass.build({});
  //     },
  //     tests() {
  //       it('returns error', async () => {
  //         expect(await subject()).toBeUndefined();
  //       });
  //     },
  //   });

  //   context('when instance is created', {
  //     async definitions() {
  //       instance = await Klass.create({});
  //     },
  //     tests() {
  //       it('reloads from storage', async () => {
  //         const keys = Object.keys(Klass.schema).filter(key => key !== 'id');
  //         const attributes = instance.attributes;
  //         instance.assign({
  //           [keys[0]]: 'foo',
  //         });
  //         expect(instance.isChanged).toBeTruthy();
  //         const reloadedInstance = await subject();
  //         expect(reloadedInstance.isChanged).toBeFalsy();
  //         expect(reloadedInstance.attributes).toEqual(attributes);
  //       });
  //     },
  //   });
  // });
  // //#endregion
  // //#endregion
});
