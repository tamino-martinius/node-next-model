import { Model } from '@next-model/core';
import { KnexConnector } from '@next-model/knex-connector';

const CLIENT = process.env.KNEX_DEMO_CLIENT ?? 'sqlite3';

function buildConnector(): KnexConnector {
  switch (CLIENT) {
    case 'sqlite3':
      return new KnexConnector({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });
    case 'pg':
      return new KnexConnector({
        client: 'pg',
        connection:
          process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/nextmodel_demo',
      });
    case 'mysql2':
      return new KnexConnector({
        client: 'mysql2',
        connection: process.env.DATABASE_URL ?? 'mysql://root:mysql@127.0.0.1:3306/nextmodel_demo',
      });
    default:
      throw new Error(`Unknown KNEX_DEMO_CLIENT: ${CLIENT}`);
  }
}

const connector = buildConnector();

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; age: number }) => props,
}) {}

console.log(`>> using knex-connector with client=${CLIENT}`);

await connector.dropTable('users');
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('age');
});

const inserted = await User.createMany([
  { name: 'Ada', age: 36 },
  { name: 'Linus', age: 12 },
  { name: 'Dennis', age: 55 },
]);
console.log(
  'inserted ids:',
  inserted.map((u) => u.id),
);

console.log('count:', await User.count());

console.log(
  'adults:',
  (
    await User.filterBy({ $gte: { age: 18 } })
      .orderBy({ key: 'age' })
      .all()
  ).map((u) => u.name),
);

// Real DB transaction (sqlite uses BEGIN/COMMIT, pg/mysql do too).
await connector.transaction(async () => {
  await User.filterBy({ name: 'Ada' }).updateAll({ age: 37 });
});
console.log('ada is now', (await User.filterBy({ name: 'Ada' }).first())?.age);

await connector.knex.destroy();
