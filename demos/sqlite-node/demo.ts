import { Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

// In-memory sqlite — wipe by exit. For a file-backed DB pass a path instead.
const connector = new SqliteConnector(':memory:');

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; age: number; active: boolean }) => props,
}) {}

await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('age');
  t.boolean('active', { default: true });
});

await User.createMany([
  { name: 'Ada', age: 36, active: true },
  { name: 'Linus', age: 12, active: true },
  { name: 'Old Account', age: 99, active: false },
]);

console.log(
  'all users:',
  (await User.all()).map((u) => u.name),
);

console.log(
  'active adults:',
  (
    await User.filterBy({ active: true })
      .filterBy({ $gte: { age: 18 } })
      .all()
  ).map((u) => u.name),
);

console.log('avg age:', await User.avg('age'));

// Cursor pagination shines when the table has lots of rows; it works the
// same way against any backend.
const page = await User.orderBy({ key: 'age' }).paginateCursor({ limit: 2 });
console.log(
  'first page:',
  page.items.map((u) => u.name),
  'hasMore:',
  page.hasMore,
);

// Native SQL escape hatch via execute() — sqlite syntax.
const rows = await connector.execute('SELECT COUNT(*) AS c FROM users WHERE active = ?', [1]);
console.log('raw count of active:', rows[0].c);

connector.destroy();
