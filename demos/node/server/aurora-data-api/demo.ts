import { DataApiConnector } from '@next-model/aurora-data-api-connector';
import { MockDataApiClient } from '@next-model/aurora-data-api-connector/mock-client';
import { Model } from '@next-model/core';

// In production you'd hand `DataApiConnector` your AWS Aurora Serverless v1
// secret/cluster ARNs. For local development the package ships
// `MockDataApiClient` (under the `/mock-client` sub-export) — it speaks the
// same DataApiClient interface but executes the SQL against an in-memory
// sqlite database via knex. Drop-in replacement, no AWS bill.
const client = new MockDataApiClient();
const connector = new DataApiConnector({ client });

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; age: number }) => props,
}) {}

await connector.dropTable('users');
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('age');
});

await User.createMany([
  { name: 'Ada', age: 36 },
  { name: 'Linus', age: 12 },
  { name: 'Dennis', age: 55 },
]);

console.log('total users:', await User.count());

console.log(
  'adults:',
  (await User.filterBy({ $gte: { age: 18 } }).all()).map((u) => u.name),
);

// The Aurora Data API supports transactions natively; the mock client
// does too — beginTransaction returns an opaque id which the connector
// pins for the duration of the callback.
await connector.transaction(async () => {
  await User.filterBy({ name: 'Ada' }).updateAll({ age: 37 });
  console.log('inside tx, ada =', (await User.filterBy({ name: 'Ada' }).first())?.age);
});
console.log('after commit, ada =', (await User.filterBy({ name: 'Ada' }).first())?.age);

await client.destroy();
await connector.knex.destroy();

// Switching to real AWS is a one-line change:
//
//   const connector = new DataApiConnector({
//     secretArn: process.env.AURORA_SECRET_ARN,
//     resourceArn: process.env.AURORA_CLUSTER_ARN,
//     database: 'app_production',
//   });
