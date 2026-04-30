import { defineSchema, Model } from '@next-model/core';
import { ValkeyConnector } from '@next-model/valkey-connector';

const VALKEY_URL = process.env.VALKEY_URL ?? 'redis://127.0.0.1:6379';

const schema = defineSchema({
  cats: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      lives: { type: 'integer' },
    },
  },
});

const connector = new ValkeyConnector(
  {
    client: { url: VALKEY_URL },
    prefix: 'nm-vk-demo:',
  },
  { schema },
);

await connector.connect();

class Cat extends Model({
  tableName: 'cats',
  connector,
  timestamps: false,
}) {}

let cursor = 0;
do {
  const result = await connector.client.scan(cursor, { MATCH: 'nm-vk-demo:*', COUNT: 100 });
  cursor = Number(result.cursor);
  if (result.keys.length > 0) await connector.client.del(result.keys);
} while (cursor !== 0);

await connector.createTable('cats', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('name');
  t.integer('lives');
});

await Cat.createMany([
  { name: 'Whiskers', lives: 9 },
  { name: 'Mittens', lives: 7 },
  { name: 'Goner', lives: 0 },
]);

console.log(
  'survivors:',
  (await Cat.filterBy({ $gt: { lives: 0 } }).all()).map((c) => c.name),
);

// Valkey is wire-compatible with Redis; this PING goes straight to the
// Valkey server.
const [pong] = await connector.execute('PING', []);
console.log('valkey says:', String(pong));

await connector.destroy();
