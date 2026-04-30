import { Model, defineSchema } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
  tasks: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      text: { type: 'string' },
      done: { type: 'boolean', default: false },
    },
  },
});

export const connector = new LocalStorageConnector({ prefix: 'nm-todo-v2:' }, { schema });

export class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
}) {}

export class Task extends Model({
  tableName: 'tasks',
  connector,
  timestamps: false,
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
