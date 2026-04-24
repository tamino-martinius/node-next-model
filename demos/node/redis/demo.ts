import { Model } from '@next-model/core';
import { RedisConnector } from '@next-model/redis-connector';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const connector = new RedisConnector({
  client: { url: REDIS_URL },
  prefix: 'nm-demo:',
});

await connector.connect();

class Note extends Model({
  tableName: 'notes',
  connector,
  timestamps: false,
  init: (props: { title: string; body: string; tags: string[] }) => props,
}) {}

// Wipe the prefix so the demo is idempotent.
let cursor = 0;
do {
  const { cursor: next, keys } = await connector.client.scan(cursor, {
    MATCH: 'nm-demo:*',
    COUNT: 100,
  });
  cursor = Number(next);
  if (keys.length > 0) await connector.client.del(keys);
} while (cursor !== 0);

await connector.createTable('notes', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('title');
  t.text('body');
  t.json('tags');
});

await Note.create({ title: 'shopping', body: 'milk, bread, beans', tags: ['errand'] });
await Note.create({ title: 'lace patterns', body: 'study, repeat', tags: ['craft', 'wip'] });
await Note.create({ title: 'design notes', body: 'engine first, lace later', tags: ['craft'] });

console.log('total notes:', await Note.count());

// Filters / aggregates run client-side over the rows fetched from Redis,
// since Redis itself can't express the full filter DSL.
const craft = await Note.filterBy({ $like: { title: '%pattern%' } }).all();
console.log(
  'matching "%pattern%":',
  craft.map((n) => n.title),
);

// JSON / boolean / Date values round-trip cleanly through the HASH thanks
// to the connector's JSON encoding.
console.log(
  'tags survive round-trip:',
  (await Note.all()).map((n) => ({ title: n.title, tags: n.tags })),
);

// Snapshot transaction — note this is NOT MULTI/EXEC; concurrent clients
// writing to the same prefix could be silently overwritten on rollback.
try {
  await connector.transaction(async () => {
    await Note.create({ title: 'doomed', body: 'bye', tags: [] });
    throw new Error('rollback');
  });
} catch {
  // expected
}
console.log('after rollback, count:', await Note.count());

await connector.destroy();
