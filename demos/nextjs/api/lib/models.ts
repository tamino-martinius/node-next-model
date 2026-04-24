import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { Model } from '@next-model/core';
import { SqliteConnector } from '@next-model/sqlite-connector';

declare global {
  // eslint-disable-next-line no-var
  var __nm_nextjs_api_db: { connector: SqliteConnector; ready: Promise<void> } | undefined;
}

const DB_PATH = './.data/nextjs-api.sqlite';

function bootstrap(): { connector: SqliteConnector; ready: Promise<void> } {
  if (globalThis.__nm_nextjs_api_db) return globalThis.__nm_nextjs_api_db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const connector = new SqliteConnector(DB_PATH);
  const ready = (async () => {
    if (!(await connector.hasTable('users'))) {
      await connector.createTable('users', (t) => {
        t.integer('id', { primary: true, autoIncrement: true, null: false });
        t.string('name');
        t.string('role');
        t.boolean('active', { default: true });
        t.datetime('createdAt');
        t.datetime('updatedAt');
      });
      await User.createMany([
        { name: 'Ada', role: 'admin', active: true },
        { name: 'Linus', role: 'member', active: true },
      ]);
    }
  })();
  const cached = { connector, ready };
  globalThis.__nm_nextjs_api_db = cached;
  return cached;
}

const cached = bootstrap();
export const connector = cached.connector;
export const dbReady = cached.ready;

export class User extends Model({
  tableName: 'users',
  connector,
  timestamps: true,
  init: (props: { name: string; role: 'admin' | 'member'; active: boolean }) => props,
}) {}
