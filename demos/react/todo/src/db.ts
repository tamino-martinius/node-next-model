import { Model } from '@next-model/core';
import { LocalStorageConnector } from '@next-model/local-storage-connector';

/**
 * Shared connector + two Models with a foreign key (`Task.userId → User.id`).
 * Everything lives under the `nm-todo-v2:` prefix so older single-user demo
 * data stored under `nm-todo:<user>:*` is left alone.
 */
export const connector = new LocalStorageConnector({ prefix: 'nm-todo-v2:' });

export type UserProps = { name: string };
export type TaskProps = { userId: number; text: string; done: boolean };

export class User extends Model({
  tableName: 'users',
  connector,
  timestamps: false,
  init: (props: UserProps) => props,
}) {}

export class Task extends Model({
  tableName: 'tasks',
  connector,
  timestamps: false,
  init: (props: TaskProps) => props,
}) {}

let bootstrapped: Promise<void> | undefined;

/** Idempotent schema + seed. Called once at app boot. */
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

export interface UserRow {
  id: number;
  name: string;
}

export interface TaskRow {
  id: number;
  userId: number;
  text: string;
  done: boolean;
}

function asUserRow(instance: User): UserRow {
  const attrs = instance.attributes() as { id: number; name: string };
  return { id: attrs.id, name: attrs.name };
}

function asTaskRow(instance: Task): TaskRow {
  const attrs = instance.attributes() as {
    id: number;
    userId: number;
    text: string;
    done: boolean;
  };
  return { id: attrs.id, userId: attrs.userId, text: attrs.text, done: attrs.done };
}

export async function loadUsers(): Promise<UserRow[]> {
  await ensureBoot();
  return (await User.orderBy({ key: 'id' }).all()).map(asUserRow);
}

export async function loadTasks(userId: number): Promise<TaskRow[]> {
  await ensureBoot();
  return (await Task.filterBy({ userId }).orderBy({ key: 'id' }).all()).map(asTaskRow);
}

export async function createUser(name: string): Promise<UserRow> {
  await ensureBoot();
  const user = await User.create({ name });
  return asUserRow(user as unknown as User);
}

export async function renameUser(id: number, name: string): Promise<UserRow> {
  await ensureBoot();
  const user = await User.find(id);
  await (user as unknown as User).update({ name });
  return asUserRow(user as unknown as User);
}

export async function deleteUser(id: number): Promise<void> {
  await ensureBoot();
  // Cascade: wipe the user's tasks first, then the user itself.
  await Task.filterBy({ userId: id }).deleteAll();
  const user = await User.find(id);
  await (user as unknown as User).delete();
}

export async function createTask(userId: number, text: string): Promise<TaskRow> {
  await ensureBoot();
  const task = await Task.create({ userId, text, done: false });
  return asTaskRow(task as unknown as Task);
}

export async function toggleTask(id: number): Promise<TaskRow> {
  await ensureBoot();
  const task = await Task.find(id);
  const attrs = (task as unknown as Task).attributes() as { done: boolean };
  await (task as unknown as Task).update({ done: !attrs.done });
  return asTaskRow(task as unknown as Task);
}

export async function deleteTask(id: number): Promise<void> {
  await ensureBoot();
  const task = await Task.find(id);
  await (task as unknown as Task).delete();
}
