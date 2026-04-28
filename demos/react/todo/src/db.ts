import { Model } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

export const connector = new LocalStorageConnector({ prefix: 'nm-todo-v2:' });

export class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: { name: string }) => props,
}) {}

export class Task extends Model({
  tableName: 'tasks',
  connector,
  timestamps: false,
  init: (props: { userId: number; text: string; done: boolean }) => props,
}) {}

let bootstrapped: Promise<void> | undefined;

export function ensureBoot(): Promise<void> {
  if (bootstrapped) return bootstrapped;
  bootstrapped = (async () => {
    if (!(await connector.hasTable('users'))) {
      await connector.createTable('users', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('name');
      });
      await User.createMany([{ name: 'ada' }, { name: 'linus' }, { name: 'dennis' }]);
    }
    if (!(await connector.hasTable('tasks'))) {
      await connector.createTable('tasks', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.integer('userId');
        t.string('text');
        t.boolean('done', { default: false });
      });
    }
  })();
  return bootstrapped;
}
