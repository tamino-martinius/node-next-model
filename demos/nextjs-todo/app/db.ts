import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

// One on-disk sqlite database shared by every request — survives `next dev`
// HMR via a globalThis cache so we don't re-open the file on every reload.
declare global {
  // eslint-disable-next-line no-var
  var __nm_demo_db: { connector: SqliteConnector; ready: Promise<void> } | undefined;
}

const DB_PATH = './.data/nextjs-todo.sqlite';

function bootstrap(): { connector: SqliteConnector; ready: Promise<void> } {
  if (globalThis.__nm_demo_db) return globalThis.__nm_demo_db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const connector = new SqliteConnector(DB_PATH);
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
  init: (props: { name: string }) => props,
}) {}

export class Task extends Model({
  tableName: 'tasks',
  connector,
  timestamps: false,
  init: (props: { title: string; done: boolean; userId: number }) => props,
}) {}
