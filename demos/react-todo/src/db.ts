import { Model } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

// Multi-user via per-user `prefix:`. Each user gets their own slice of
// localStorage and the schema lives independently per user.
const connectors = new Map<string, LocalStorageConnector>();

const SCHEMAS = new WeakSet<LocalStorageConnector>();

async function ensureSchema(connector: LocalStorageConnector) {
  if (SCHEMAS.has(connector)) return;
  if (!(await connector.hasTable('todos'))) {
    await connector.createTable('todos', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('text');
      t.boolean('done', { default: false });
    });
  }
  SCHEMAS.add(connector);
}

function connectorFor(user: string): LocalStorageConnector {
  let c = connectors.get(user);
  if (!c) {
    c = new LocalStorageConnector({ prefix: `nm-todo:${user}:` });
    connectors.set(user, c);
  }
  return c;
}

export type TodoProps = { text: string; done: boolean };

export function todoModelFor(user: string) {
  const connector = connectorFor(user);
  return {
    connector,
    Todo: class extends Model({
      tableName: 'todos',
      connector,
      timestamps: false,
      init: (props: TodoProps) => props,
    }) {},
  };
}

export async function loadTodos(user: string) {
  const { Todo, connector } = todoModelFor(user);
  await ensureSchema(connector);
  return Todo.orderBy({ key: 'id' }).all();
}

export async function addTodo(user: string, text: string) {
  const { Todo, connector } = todoModelFor(user);
  await ensureSchema(connector);
  await Todo.create({ text, done: false });
}

export async function toggleTodo(user: string, id: number) {
  const { Todo, connector } = todoModelFor(user);
  await ensureSchema(connector);
  const todo = await Todo.find(id);
  if (todo) await todo.update({ done: !todo.done });
}

export async function removeTodo(user: string, id: number) {
  const { Todo, connector } = todoModelFor(user);
  await ensureSchema(connector);
  const todo = await Todo.find(id);
  if (todo) await todo.delete();
}
