import { Model } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

// `LocalStorageConnector` reaches for `globalThis.localStorage` in browsers.
// In Node we hand it any object that satisfies the Web Storage interface.
class NodeLocalStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const connector = new LocalStorageConnector({
  localStorage: new NodeLocalStorage(),
  prefix: 'demo:',
});

class Note extends Model({
  tableName: 'notes',
  connector,
  init: (props: { title: string; body: string }) => props,
}) {}

await connector.createTable('notes', (t) => {
  t.integer('id', { primary: true, autoIncrement: true, null: false });
  t.string('title');
  t.text('body');
});

await Note.create({ title: 'shopping', body: 'milk, bread, beans' });
await Note.create({ title: 'feedback for ada', body: 'great talk on lace' });

console.log(
  'all notes:',
  (await Note.all()).map((n) => n.title),
);

console.log(
  'matching "shop%":',
  (await Note.filterBy({ $like: { title: 'shop%' } }).all()).map((n) => n.title),
);

// Transactions roll back to the snapshot taken at the start of the block.
try {
  await connector.transaction(async () => {
    await Note.create({ title: 'doomed', body: 'will not be persisted' });
    throw new Error('rollback please');
  });
} catch {
  // expected
}
console.log('after rollback, count:', await Note.count());
