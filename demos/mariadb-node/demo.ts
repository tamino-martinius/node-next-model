import { Model } from '@next-model/core';
import { MariaDbConnector } from '@next-model/mariadb-connector';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'mysql://root:mariadb@127.0.0.1:3306/nextmodel_demo';

const connector = new MariaDbConnector(DATABASE_URL);

class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string; preferences: object }) => props,
}) {}

await connector.dropTable('users');
await connector.createTable('users', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  // On MariaDB, json columns become `LONGTEXT CHECK (JSON_VALID(...))`.
  // Inserting non-JSON text would be rejected by the CHECK constraint.
  t.json('preferences');
});

// batchInsert uses MariaDB's INSERT ... RETURNING * (10.5+) — single
// round-trip, full rows back. The MySQL connector would have to expand
// insertId + re-fetch.
const inserted = await User.createMany([
  { name: 'Ada', preferences: { theme: 'dark' } },
  { name: 'Linus', preferences: { theme: 'light' } },
]);
console.log(
  'inserted via INSERT ... RETURNING:',
  inserted.map((u) => ({ id: u.id, name: u.name, prefs: u.preferences })),
);

// deleteAll uses DELETE ... RETURNING * (10.0+) — same shortcut.
const deleted = await User.filterBy({ name: 'Linus' }).deleteAll();
console.log(
  'deleted via DELETE ... RETURNING:',
  deleted.map((u) => u.name),
);

// updateAll falls through to the inherited SELECT-then-UPDATE because
// MariaDB does NOT support UPDATE ... RETURNING (yet).
const updated = await User.filterBy({ name: 'Ada' }).updateAll({
  preferences: { theme: 'auto' },
});
console.log(
  'updated (via SELECT-then-UPDATE):',
  updated.map((u) => ({ name: u.name, prefs: u.preferences })),
);

await connector.destroy();
