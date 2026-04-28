import { MemoryConnector, Model } from '@next-model/core';
import { type ReactNode } from 'react';
import { NextModelProvider } from '../Provider.js';

export function makeFixtures() {
  const connector = new MemoryConnector({ storage: {} });
  class Todo extends Model({
    tableName: 'todos',
    connector,
    init: (props: { title: string; done: boolean; userId?: number }) => ({
      done: false,
      ...props,
    }),
    timestamps: false,
  }) {}
  class User extends Model({
    tableName: 'users',
    connector,
    init: (props: { name: string }) => props,
    timestamps: false,
  }) {}

  const reset = async () => {
    await connector.dropTable('todos').catch(() => undefined);
    await connector.dropTable('users').catch(() => undefined);
    await connector.createTable('todos', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('title');
      t.boolean('done', { default: false });
      t.integer('userId', { null: true });
    });
    await connector.createTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name');
    });
  };

  return { connector, Todo, User, reset };
}

export const wrapWithProvider = ({ children }: { children: ReactNode }) => (
  <NextModelProvider>{children}</NextModelProvider>
);
