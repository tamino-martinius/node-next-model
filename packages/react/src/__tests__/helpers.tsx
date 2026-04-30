import { defineSchema, MemoryConnector, Model } from '@next-model/core';
import type { ReactNode } from 'react';
import { NextModelProvider } from '../Provider.js';

const helpersSchema = defineSchema({
  todos: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      done: { type: 'boolean', default: false },
      userId: { type: 'integer', null: true },
    },
  },
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

export function makeFixtures() {
  const connector = new MemoryConnector({ storage: {} }, { schema: helpersSchema });
  class Todo extends Model({ connector, tableName: 'todos', timestamps: false }) {}
  class User extends Model({ connector, tableName: 'users', timestamps: false }) {}

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
