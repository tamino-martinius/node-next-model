// import * as Knex from 'knex';

// import { Model, Filter, OrderColumn, Dict } from '@next-model/core';

// import { KnexConnector } from '..';

// import { context, Connection, FilterSpecGroup, randomInteger } from '.';

// const client = process.env.DB || 'sqlite3';
// const isOracle = client === 'oracledb';
// let connection: Connection = { filename: ':memory:' };
// switch (process.env.DB) {
//   case 'mysql': {
//     connection = {
//       host: '127.0.0.1',
//       user: 'root',
//       password: '',
//       database: 'test_mysql',
//     };
//     break;
//   }
//   case 'mysql2': {
//     connection = {
//       host: '127.0.0.1',
//       user: 'root',
//       password: '',
//       database: 'test_mysql2',
//     };
//     break;
//   }
//   case 'postgres': {
//     connection = {
//       host: '127.0.0.1',
//       database: 'test_postgres',
//     };
//     break;
//   }
//   case 'oracledb': {
//     connection = <Connection>{
//       user: 'travis',
//       password: 'travis',
//       connectString: 'localhost/XE',
//       stmtCacheSize: 0,
//     };
//     break;
//   }
// }

// const config: Knex.Config = {
//   client,
//   connection,
//   useNullAsDefault: true,
// };

// const connector = new KnexConnector(config);

// const tableName = 'users';

// class User extends Model({
//   init: (props: { name: string | null; age: number }) => props,
//   tableName,
//   connector,
// }) {}

// let user1: User | undefined;
// let user2: User | undefined;
// let user3: User | undefined;

// async function cleanDb(): Promise<void> {
//   user1 = user2 = user3 = undefined;

//   await connector.knex.schema.dropTableIfExists('users');
// }

// async function seedTable(): Promise<void> {
//   await connector.knex.schema.dropTableIfExists('users');

//   await connector.knex.schema.createTable('users', (table: Knex.CreateTableBuilder) => {
//     table
//       .increments('id')
//       .primary()
//       .unsigned();
//     table.string('name');
//     table.integer('age');
//   });
// }

// async function seedData() {
//   user1 = await User.create({ name: 'foo', age: 18 });
//   user2 = await User.create({ name: null, age: 21 });
//   user3 = await User.create({ name: 'bar', age: 21 });
//   return [user1, user2, user3];
// }

// async function seedDb(): Promise<Knex.SchemaBuilder> {
//   await seedTable();
//   await seedData();
// }

// const idsOf = (items: Dict<any>[]) => items.map(item => item.id);

// afterEach(cleanDb);

// const validId = randomInteger(1, 3);
// const validUserId = () => users[validId]();
// const users: (() => number)[] = [
//   () => 0,
//   () => (user1 ? user1.attributes.id : 0),
//   () => (user2 ? user2.attributes.id : 0),
//   () => (user3 ? user3.attributes.id : 0),
//   () => randomInteger(user3 ? user3.attributes.id + 1 : 0, 99999),
// ];

// const filterSpecGroups: FilterSpecGroup = {
//   none: [
//     {
//       // Empty Filter
//       filter: () => ({}),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       // Undefined Filter
//       filter: () => undefined,
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//   ],
//   property: [
//     {
//       // Filter by random id
//       filter: () => ({ id: validUserId() }),
//       results: () => [validUserId()],
//     },
//     {
//       // Filter with multiple valid attributes
//       filter: () => ({ id: users[1](), name: 'foo' }),
//       results: () => [users[1]()],
//     },
//     {
//       // Filter with multiple invalid attributes
//       filter: () => ({ id: users[1](), name: 'bar' }),
//       results: () => [],
//     },
//     {
//       // Filter with multiple matching items
//       filter: () => ({ age: 21 }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       // Filter with no matching items
//       filter: () => ({ id: 0 }),
//       results: () => [],
//     },
//   ],
//   $and: [
//     {
//       // Filter with empty
//       filter: () => ({ $and: [] }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $and: [{ id: validUserId() }] }),
//       results: () => [validUserId()],
//     },
//     {
//       //
//       filter: () => ({ $and: [{ id: users[2]() }, { id: users[3]() }] }),
//       results: () => [],
//     },
//     {
//       filter: () => ({ $and: [{ id: users[2]() }, { id: users[2]() }] }),
//       results: () => [users[2]()],
//     },
//   ],
//   $not: [
//     {
//       //
//       filter: () => ({ $not: {} }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $not: { id: users[2]() } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $not: { id: 0 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//   ],
//   $or: [
//     {
//       //
//       filter: () => ({ $or: [] }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $or: [{ id: validUserId() }] }),
//       results: () => [validUserId()],
//     },
//     {
//       filter: () => ({ $or: [{ id: users[2]() }, { id: users[3]() }] }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       filter: () => ({ $or: [{ id: users[2]() }, { id: users[2]() }] }),
//       results: () => [users[2]()],
//     },
//   ],
//   $in: [
//     {
//       //
//       filter: () => ({ $in: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $in: { id: [validUserId()] } }),
//       results: () => [validUserId()],
//     },
//     {
//       filter: () => ({ $in: { id: [users[2](), users[3]()] } }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $in: { id: [users[2](), users[2]()] } }),
//       results: () => [users[2]()],
//     },
//     {
//       filter: () => ({ $in: { id: [users[1]()], name: ['foo'] } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $notIn: [
//     {
//       //
//       filter: () => ({ $notIn: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $notIn: { id: [users[2]()] } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $notIn: { id: [users[2](), users[3]()] } }),
//       results: () => [users[1]()],
//     },
//     {
//       filter: () => ({ $notIn: { id: [users[2](), users[2]()] } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       filter: () => ({ $notIn: { id: [users[1]()], name: ['foo'] } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $null: [
//     {
//       //
//       filter: () => ({ $null: 'name' }),
//       results: () => [users[2]()],
//     },
//     {
//       //
//       filter: () => ({ $null: 'id' }),
//       results: () => [],
//     },
//     {
//       //
//       filter: () => ({ $null: 'bar' }),
//       results: 'bar',
//     },
//   ],
//   $notNull: [
//     {
//       //
//       filter: () => ({ $notNull: 'name' }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $notNull: 'id' }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $notNull: 'bar' }),
//       results: 'bar',
//     },
//   ],
//   $between: [
//     {
//       //
//       filter: () => ({ $between: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       filter: () => ({ $between: { id: { from: users[1](), to: users[2]() } } }),
//       results: () => [users[1](), users[2]()],
//     },
//     {
//       filter: () => ({ $between: { name: { from: 'a', to: 'z' } } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       filter: () => ({ $between: { age: { from: 20, to: 30 } } }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       filter: () => ({ $between: { id: { from: 0, to: users[1]() } } }),
//       results: () => [users[1]()],
//     },
//     {
//       filter: () => ({ $between: { id: { from: users[3](), to: users[4]() } } }),
//       results: () => [users[3]()],
//     },
//     {
//       filter: () => ({ $between: { id: { from: validUserId(), to: validUserId() } } }),
//       results: () => [validUserId()],
//     },
//     {
//       //
//       filter: () => ({ $between: { age: { from: 30, to: 40 } } }),
//       results: () => [],
//     },
//     {
//       filter: () => ({ $between: { id: { from: users[3](), to: users[1]() } } }),
//       results: () => [],
//     },
//     {
//       filter: () => ({
//         $between: { id: { from: users[1](), to: users[3]() }, name: { from: 'a', to: 'z' } },
//       }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $gt: [
//     {
//       //
//       filter: () => ({ $gt: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $gt: { id: users[2]() } }),
//       results: () => [users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gt: { age: 21 } }),
//       results: () => [],
//     },
//     {
//       //
//       filter: () => ({ $gt: { age: 20 } }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gt: { id: 0 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       filter: () => ({ $gt: { id: users[1](), name: 'a' } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $gte: [
//     {
//       //
//       filter: () => ({ $gte: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $gte: { id: users[2]() } }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gte: { name: 'z' } }),
//       results: () => [],
//     },
//     {
//       //
//       filter: () => ({ $gte: { age: 21 } }),
//       results: () => [users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gte: { name: 'a' } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gte: { id: 0 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $gte: { age: 30 } }),
//       results: () => [],
//     },
//     {
//       filter: () => ({ $gte: { id: users[1](), name: 'a' } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $lt: [
//     {
//       //
//       filter: () => ({ $lt: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $lt: { id: users[2]() } }),
//       results: () => [users[1]()],
//     },
//     {
//       //
//       filter: () => ({ $lt: { name: 'bar' } }),
//       results: () => [],
//     },
//     {
//       //
//       filter: () => ({ $lt: { name: 'z' } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lt: { age: 30 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lt: { id: 0 } }),
//       results: () => [],
//     },
//     {
//       filter: () => ({ $lt: { id: users[1](), name: 'z' } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $lte: [
//     {
//       //
//       filter: () => ({ $lte: {} }),
//       results: '[TODO] Return proper error',
//     },
//     {
//       //
//       filter: () => ({ $lte: { id: users[2]() } }),
//       results: () => [users[1](), users[2]()],
//     },
//     {
//       //
//       filter: () => ({ $lte: { name: 'bar' } }),
//       results: () => [users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lte: { age: 21 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lte: { name: 'z' } }),
//       results: () => [users[1](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lte: { age: 30 } }),
//       results: () => [users[1](), users[2](), users[3]()],
//     },
//     {
//       //
//       filter: () => ({ $lte: { id: 0 } }),
//       results: () => [],
//     },
//     {
//       filter: () => ({ $lte: { id: users[1](), name: 'z' } }),
//       results: '[TODO] Return proper error',
//     },
//   ],
//   $raw: [
//     {
//       filter: () => ({ $raw: { $query: 'id = ?', $bindings: [validUserId()] } }),
//       results: () => [validUserId()],
//     },
//     {
//       filter: () => ({ $raw: { $query: 'id = :id', $bindings: { id: validUserId() } } }),
//       results: () => [validUserId()],
//     },
//   ],
// };

// describe('KnexConnector', () => {
//   describe('#query(scope)', () => {
//     let skip: number | undefined;
//     let limit: number | undefined;
//     let filter: Filter<any> | undefined;
//     let order: OrderColumn<any>[] | undefined;

//     const scope = () => ({ tableName, skip, limit, filter, order });
//     const subject = () => connector.query(scope());

//     it('rejects with error', async () => {
//       try {
//         await subject();
//         expect(true).toBeFalsy(); // Should not reach
//       } catch (error) {
//         expect(error.message).toContain('users');
//       }
//     });
//     context('with seeded table', {
//       definitions: seedTable,
//       tests() {
//         it('promises empty array', async () => {
//           const data = await subject();
//           return expect(data).toEqual([]);
//         });
//       },
//     });

//     context('with seeded data', {
//       definitions: seedDb,
//       tests() {
//         for (const groupName in filterSpecGroups) {
//           describe(groupName + ' filter', () => {
//             filterSpecGroups[groupName].forEach((filterSpec, index) => {
//               context('with filter #' + (index + 1), {
//                 definitions: () => (filter = filterSpec.filter()),
//                 reset: () => (filter = undefined),
//                 tests() {
//                   const results = filterSpec.results;
//                   if (typeof results === 'function') {
//                     it('promises all matching items as model instances', async () => {
//                       const ids = results();
//                       const items = await subject();
//                       expect(items.length).toEqual(ids.length);
//                       expect(idsOf(items)).toEqual(ids);
//                     });

//                     context('when skip is present', {
//                       definitions: () => (skip = 1),
//                       reset: () => (skip = undefined),
//                       tests() {
//                         it('promises all matching items as model instances', async () => {
//                           const items = await subject();
//                           const ids = results();

//                           expect(items.length).toEqual(Math.max(0, ids.length - 1));
//                           expect(idsOf(items)).toEqual(ids.slice(1));
//                         });
//                       },
//                     });

//                     context('when limit is present', {
//                       definitions: () => (limit = 1),
//                       reset: () => (limit = undefined),
//                       tests() {
//                         it('promises all matching items as model instances', async () => {
//                           const items = await subject();
//                           const ids = results();

//                           expect(items.length).toEqual(ids.length > 0 ? 1 : 0);
//                           expect(idsOf(items)).toEqual(ids.slice(0, 1));
//                         });
//                       },
//                     });

//                     context('when skip and limit is present', {
//                       definitions: () => (skip = limit = 1),
//                       reset: () => (skip = limit = undefined),
//                       tests() {
//                         it('promises all matching items as model instances', async () => {
//                           const instances = await subject();
//                           const ids = results();

//                           expect(instances.length).toEqual(ids.length - 1 > 0 ? 1 : 0);
//                           expect(idsOf(instances)).toEqual(ids.slice(1, 2));
//                         });
//                       },
//                     });
//                   } else {
//                     it('rejects filter and returns error', async () => {
//                       try {
//                         await subject();
//                         expect(true).toBeFalsy(); // Should not reach
//                       } catch (error) {
//                         if (error.message !== undefined) {
//                           expect(error.message).toContain(results);
//                         } else {
//                           expect(error).toEqual(results);
//                         }
//                       }
//                     });
//                   }
//                 },
//               });
//             });
//           });
//         }
//       },
//     });
//   });

//   describe('#count(scope)', () => {
//     let skip: number | undefined;
//     let limit: number | undefined;
//     let filter: Filter<any> | undefined;
//     let order: OrderColumn<any>[] | undefined;

//     const scope = () => ({ tableName, skip, limit, filter, order });
//     const subject = () => connector.count(scope());

//     it('rejects with error', async () => {
//       try {
//         await subject();
//         expect(true).toBeFalsy(); // Should not reach
//       } catch (error) {
//         expect(error.message).toContain('users');
//       }
//     });
//     context('with seeded table', {
//       definitions: seedTable,
//       tests() {
//         it('promises a count of 0', async () => {
//           const data = await subject();
//           return expect(data).toEqual(0);
//         });
//       },
//     });

//     context('with seeded data', {
//       definitions: seedDb,
//       tests() {
//         for (const groupName in filterSpecGroups) {
//           describe(groupName + ' filter', () => {
//             filterSpecGroups[groupName].forEach((filterSpec, index) => {
//               context('with filter #' + (index + 1), {
//                 definitions: () => (filter = filterSpec.filter()),
//                 reset: () => (filter = undefined),
//                 tests() {
//                   const results = filterSpec.results;
//                   if (typeof results === 'function') {
//                     it('returns count of matching records', async () => {
//                       const ids = (<any>filterSpec.results)();
//                       const count = await subject();
//                       expect(count).toEqual(ids.length);
//                     });
//                   } else {
//                     it('rejects filter and returns error', async () => {
//                       try {
//                         await subject();
//                         expect(true).toBeFalsy(); // Should not reach
//                       } catch (error) {
//                         if (error.message !== undefined) {
//                           expect(error.message).toContain(results);
//                         } else {
//                           expect(error).toEqual(results);
//                         }
//                       }
//                     });
//                   }
//                 },
//               });
//             });
//           });
//         }
//       },
//     });
//   });

//   // describe('#updateAll(Klass, attrs)', () => {
//   //   let Klass: typeof User = User;
//   //   let attrs: Partial<UserSchema> = {
//   //     name: 'updated',
//   //   };
//   //   const subject = () => connector.updateAll(Klass, attrs);

//   //   it('rejects with error', async () => {
//   //     try {
//   //       const data = await subject();
//   //       expect(true).toBeFalsy(); // Should not reach
//   //     } catch (error) {
//   //       expect(error.message).toContain('users');
//   //     }
//   //   });
//   //   context('with seeded table', {
//   //     definitions: seedTable,
//   //     tests() {
//   //       it('promises a count of 0', async () => {
//   //         const data = await subject();
//   //         return expect(data).toEqual(0);
//   //       });
//   //     },
//   //   });

//   //   context('with seeded data', {
//   //     definitions: seedDb,
//   //     tests() {
//   //       for (const groupName in filterSpecGroups) {
//   //         describe(groupName + ' filter', () => {
//   //           filterSpecGroups[groupName].forEach((filterSpec, index) => {
//   //             context('with filter #' + (index + 1), {
//   //               definitions() {
//   //                 const filter: Filter<UserSchema> = <any>filterSpec.filter();
//   //                 class NewKlass extends User {
//   //                   static get filter(): Filter<UserSchema> {
//   //                     return filter;
//   //                   }
//   //                 }
//   //                 Klass = NewKlass;
//   //               },
//   //               tests() {
//   //                 const results = filterSpec.results;
//   //                 if (typeof results === 'function') {
//   //                   it('returns count of matching records', async () => {
//   //                     const ids = (<any>filterSpec.results)();
//   //                     const count = await subject();
//   //                     expect(count).toEqual(ids.length);
//   //                     const instances = await connector.query(Klass);
//   //                     for (const instance of instances) {
//   //                       expect((<User>instance).name).toEqual('updated');
//   //                     }
//   //                   });
//   //                 } else {
//   //                   it('rejects filter and returns error', async () => {
//   //                     try {
//   //                       await subject();
//   //                       expect(true).toBeFalsy(); // Should not reach
//   //                     } catch (error) {
//   //                       if (error.message !== undefined) {
//   //                         expect(error.message).toContain(results);
//   //                       } else {
//   //                         expect(error).toEqual(results);
//   //                       }
//   //                     }
//   //                   });
//   //                 }
//   //               },
//   //             });
//   //           });
//   //         });
//   //       }
//   //     },
//   //   });
//   // });

//   // describe('#deleteAll(Klass)', () => {
//   //   let Klass: typeof User = User;
//   //   const subject = () => connector.deleteAll(Klass);

//   //   it('rejects with error', async () => {
//   //     try {
//   //       const data = await subject();
//   //       expect(true).toBeFalsy(); // Should not reach
//   //     } catch (error) {
//   //       expect(error.message).toContain('users');
//   //     }
//   //   });
//   //   context('with seeded table', {
//   //     definitions: seedTable,
//   //     tests() {
//   //       it('promises a count of 0', async () => {
//   //         const data = await subject();
//   //         return expect(data).toEqual(0);
//   //       });
//   //     },
//   //   });

//   //   context('with seeded data', {
//   //     definitions: seedDb,
//   //     tests() {
//   //       for (const groupName in filterSpecGroups) {
//   //         describe(groupName + ' filter', () => {
//   //           filterSpecGroups[groupName].forEach((filterSpec, index) => {
//   //             context('with filter #' + (index + 1), {
//   //               definitions() {
//   //                 const filter: Filter<UserSchema> = <any>filterSpec.filter();
//   //                 class NewKlass extends User {
//   //                   static get filter(): Filter<UserSchema> {
//   //                     return filter;
//   //                   }
//   //                 }
//   //                 Klass = NewKlass;
//   //               },
//   //               tests() {
//   //                 const results = filterSpec.results;
//   //                 if (typeof results === 'function') {
//   //                   it('returns count of matching records', async () => {
//   //                     const ids = (<any>filterSpec.results)();
//   //                     const count = await subject();
//   //                     expect(count).toEqual(ids.length);
//   //                     const instances = await connector.query(Klass);
//   //                     expect(instances.length).toEqual(0);
//   //                   });
//   //                 } else {
//   //                   it('rejects filter and returns error', async () => {
//   //                     try {
//   //                       await subject();
//   //                       expect(true).toBeFalsy(); // Should not reach
//   //                     } catch (error) {
//   //                       if (error.message !== undefined) {
//   //                         expect(error.message).toContain(results);
//   //                       } else {
//   //                         expect(error).toEqual(results);
//   //                       }
//   //                     }
//   //                   });
//   //                 }
//   //               },
//   //             });
//   //           });
//   //         });
//   //       }
//   //     },
//   //   });
//   // });

//   // describe('#batchInsert(instance)', () => {
//   //   let Klass: typeof User = User;
//   //   let attrs: Partial<UserSchema> = {
//   //     name: 'created',
//   //     age: 4711,
//   //   };
//   //   let klass = new Klass(attrs);
//   //   const subject = () => connector.create(klass);

//   //   it('rejects with error', async () => {
//   //     try {
//   //       const data = await subject();
//   //       expect(true).toBeFalsy(); // Should not reach
//   //     } catch (error) {
//   //       expect(error.message).toContain('users');
//   //     }
//   //   });
//   //   context('with seeded table', {
//   //     definitions: seedTable,
//   //     tests() {
//   //       it('creates instance and sets id', async () => {
//   //         expect(await Klass.count).toEqual(0);
//   //         const instance = await subject();
//   //         expect(instance.id).toBeGreaterThan(0);
//   //         expect(instance.attributes).toEqual({
//   //           id: instance.id,
//   //           name: attrs.name,
//   //           age: attrs.age,
//   //         });
//   //         expect(await Klass.count).toEqual(1);
//   //       });
//   //     },
//   //   });
//   // });

//   // describe('#execute(sql, bindings)', () => {
//   //   let sql: string = 'SELECT * FROM users WHERE id = :id';
//   //   let id = () => 0;
//   //   const subject = () => connector.execute(sql, { id: id() });

//   //   it('rejects with error', async () => {
//   //     try {
//   //       const data = await subject();
//   //       expect(true).toBeFalsy(); // Should not reach
//   //     } catch (error) {
//   //       expect(error.message).toContain('users');
//   //     }
//   //   });

//   //   context('with seeded table', {
//   //     definitions: seedTable,
//   //     tests() {
//   //       it('promises empty array', async () => {
//   //         const data = await subject();
//   //         return expect(data).toEqual([]);
//   //       });

//   //       context('with seeded data', {
//   //         definitions: seedData,
//   //         tests() {
//   //           it('promises empty array', async () => {
//   //             const data = await subject();
//   //             expect(data).toEqual([]);
//   //           });

//   //           context('with queryfor data', {
//   //             definitions() {
//   //               id = uid;
//   //             },
//   //             tests() {
//   //               it('promises array of rows', async () => {
//   //                 const data = await subject();
//   //                 expect(data).toEqual([validUser().attributes]);
//   //               });
//   //             },
//   //           });
//   //         },
//   //       });
//   //     },
//   //   });
//   // });
// });

// afterAll(() => {
//   connector.knex.destroy();
// });
