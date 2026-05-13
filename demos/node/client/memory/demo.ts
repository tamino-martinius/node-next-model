import { defineSchema, MemoryConnector, Model } from '@next-model/core';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      userId: { type: 'integer' },
    },
  },
});

const connector = new MemoryConnector({ storage: {} }, { schema });

class User extends Model({
  tableName: 'users',
  connector,
  scopes: {
    adults: { $gte: { age: 18 } },
  },
}) {}

class Post extends Model({
  tableName: 'posts',
  connector,
}) {}

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

// CRUD
const ada = await User.create({ name: 'Ada', age: 36 });
const linus = await User.create({ name: 'Linus', age: 12 });
console.log('created:', { id: ada.id, name: ada.name });

// Update + reload
await ada.update({ age: 37 });
console.log('after birthday:', ada.age);

// Filter chain + named scope
const grownUps = await User.adults().orderBy({ key: 'age' }).all();
console.log(
  'adults:',
  grownUps.map((u) => u.name),
);

// Aggregates
console.log('total users:', await User.count());
console.log('average age:', await User.avg('age'));

// Associations
await Post.create({ title: 'Notes on lace', userId: ada.id });
await Post.create({ title: 'Ode to the analytical engine', userId: ada.id });
const posts = await ada.hasMany(Post, { foreignKey: 'userId' }).all();
console.log(
  'ada wrote:',
  posts.map((p) => p.title),
);

// Cursor pagination
const page1 = await Post.paginateCursor({ limit: 1 });
console.log('first page title:', page1.items[0].title, 'hasMore:', page1.hasMore);
const page2 = await Post.paginateCursor({ after: page1.nextCursor, limit: 1 });
console.log('second page title:', page2.items[0].title);

// Transactions — rollback wins
try {
  await connector.transaction(async () => {
    await User.create({ name: 'Doomed', age: 99 });
    throw new Error('oops');
  });
} catch {
  // expected
}
console.log('after rollback, users:', await User.count(), '(linus survived:', linus.name, ')');
