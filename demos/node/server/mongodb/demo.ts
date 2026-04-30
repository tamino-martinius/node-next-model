import { defineSchema, Model } from '@next-model/core';
import { MongoDbConnector } from '@next-model/mongodb-connector';

const URL = process.env.MONGODB_URL ?? 'mongodb://127.0.0.1:27017';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
      tags: { type: 'json' },
    },
  },
});

const connector = new MongoDbConnector({ url: URL, database: 'nm_demo' }, { schema });

await connector.connect();

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
}) {}

// Wipe every collection so the demo is idempotent.
const collections = await connector.db.listCollections().toArray();
for (const c of collections) {
  await connector.db
    .collection(c.name)
    .drop()
    .catch(() => {});
}

await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('age');
  t.json('tags');
});

await User.createMany([
  { name: 'Ada', age: 36, tags: ['math', 'design'] },
  { name: 'Linus', age: 12, tags: ['games'] },
  { name: 'Dennis', age: 55, tags: ['unix', 'c'] },
]);

console.log('total users:', await User.count());

// Filter operators map straight onto MongoDB's native query language.
console.log(
  'adults:',
  (await User.filterBy({ $gte: { age: 18 } }).all()).map((u) => u.name),
);

// $like becomes a regex on the server.
console.log(
  'name starts with A:',
  (await User.filterBy({ $like: { name: 'A%' } }).all()).map((u) => u.name),
);

// $raw is the escape hatch for things the core DSL doesn't cover yet —
// pass any JSON-encoded mongo filter document.
const withCTag = await User.filterBy({
  $raw: { $query: '{"tags": {"$elemMatch": {"$eq": "c"}}}' } as any,
}).all();
console.log(
  '$raw $elemMatch:',
  withCTag.map((u) => u.name),
);

await connector.destroy();
