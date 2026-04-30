import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { Model, defineSchema } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

// One on-disk sqlite database shared by every request — survives `next dev`
// HMR via a globalThis cache so we don't re-open the file on every reload.
declare global {
  // eslint-disable-next-line no-var
  var __nm_demo_db: { connector: SqliteConnector; ready: Promise<void> } | undefined;
}

const DB_PATH = './.data/nextjs-todo.sqlite';

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
      title: { type: 'string' },
      done: { type: 'boolean', default: false },
      userId: { type: 'integer' },
    },
  },
});

function bootstrap(): { connector: SqliteConnector; ready: Promise<void> } {
  if (globalThis.__nm_demo_db) return globalThis.__nm_demo_db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const connector = new SqliteConnector(DB_PATH, { schema });
  const ready = (async () => {
    if (!(await connector.hasTable('users'))) {
      await connector.createTable('users', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('name');
      });
      // Seed two users so the picker has something to pick.
      await User.create({ name: 'ada' });
      await User.create({ name: 'linus' });
    }
    if (!(await connector.hasTable('tasks'))) {
      await connector.createTable('tasks', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('title');
        t.boolean('done', { default: false });
        t.integer('userId');
      });
    }
  })();
  const cached = { connector, ready };
  globalThis.__nm_demo_db = cached;
  return cached;
}

const cached = bootstrap();
export const connector = cached.connector;
export const dbReady = cached.ready;

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
