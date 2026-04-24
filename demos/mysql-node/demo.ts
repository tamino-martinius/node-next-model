import { Model } from '@next-model/core';
import { MysqlConnector } from '@next-model/mysql-connector';

const DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://root:mysql@127.0.0.1:3306/nextmodel_demo';

const connector = new MysqlConnector(DATABASE_URL);

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
  init: (props: { title: string; userId: number }) => props,
}) {}

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
});

const ada = await User.create({ name: 'Ada', age: 36 });
await User.createMany([
  { name: 'Linus', age: 12 },
  { name: 'Old Account', age: 99 },
]);

await Post.createMany([
  { title: 'On lace', userId: ada.id },
  { title: 'Engine notes', userId: ada.id },
  { title: 'Punch cards', userId: ada.id },
]);

console.log('total users:', await User.count());

// MySQL has no INSERT ... RETURNING, so the connector expands the first
// auto-increment id to consecutive ids and re-fetches every row in one
// WHERE id IN (...). `createMany` returns full instances regardless.
console.log(
  "ada's posts:",
  (await ada.hasMany(Post, { foreignKey: 'userId' }).all()).map((p) => p.title),
);

// Real MySQL transaction.
await connector.transaction(async () => {
  await User.filterBy({ id: ada.id }).updateAll({ age: 37 });
});
console.log('ada is now', (await User.find(ada.id))?.age);

await connector.destroy();
