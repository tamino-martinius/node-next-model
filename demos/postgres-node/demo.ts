import { Model } from '@next-model/core';
import { PostgresConnector } from '@next-model/postgres-connector';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/nextmodel_demo';

const connector = new PostgresConnector({ connectionString: DATABASE_URL, max: 4 });

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; age: number }) => props,
}) {}

class Post extends Model({
  tableName: 'posts',
  connector,
  timestamps: false,
  init: (props: { title: string; userId: number; payload: object }) => props,
}) {}

// Recreate schema each run so the demo is idempotent.
await connector.dropTable('posts');
await connector.dropTable('users');
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('age');
});
await connector.createTable('posts', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('title');
  t.integer('userId');
  t.json('payload'); // becomes JSONB on Postgres
});

const ada = await User.create({ name: 'Ada', age: 36 });
await User.create({ name: 'Linus', age: 12 });

await Post.create({ title: 'On lace', userId: ada.id, payload: { tags: ['craft'] } });
await Post.create({ title: 'Engine notes', userId: ada.id, payload: { tags: ['math', 'design'] } });

console.log(
  'all users:',
  (await User.all()).map((u) => u.name),
);

const adultPosts = await ada.hasMany(Post, { foreignKey: 'userId' }).all();
console.log(
  "ada's posts (JSONB intact):",
  adultPosts.map((p) => ({ title: p.title, payload: p.payload })),
);

// Cursor pagination over posts ordered by id.
const page = await Post.paginateCursor({ limit: 1 });
console.log('page1 title:', page.items[0].title, 'hasMore:', page.hasMore);

// Real Postgres transaction — rolls back the bad insert and Ada survives.
await connector.transaction(async () => {
  await User.filterBy({ id: ada.id }).updateAll({ age: 37 });
  console.log('inside tx, ada.age =', (await User.find(ada.id))?.age);
});
console.log('after commit, ada.age =', (await User.find(ada.id))?.age);

await connector.destroy();
