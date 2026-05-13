'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { dbReady, Task, User } from './db';

const USER_COOKIE = 'nm-todo-user';

export async function setCurrentUser(name: string): Promise<void> {
  await dbReady;
  const jar = await cookies();
  jar.set(USER_COOKIE, name, { httpOnly: false, sameSite: 'lax', path: '/' });
  revalidatePath('/');
}

export async function createUser(name: string): Promise<void> {
  await dbReady;
  const trimmed = name.trim();
  if (!trimmed) return;
  await User.create({ name: trimmed });
  revalidatePath('/');
}

export async function renameUser(id: number, name: string): Promise<void> {
  await dbReady;
  const trimmed = name.trim();
  if (!trimmed) return;
  const user = await User.find(id);
  if (!user) return;
  await user.update({ name: trimmed });
  revalidatePath('/');
}

export async function deleteUser(id: number): Promise<void> {
  await dbReady;
  // Cascade: wipe the user's tasks first, then the user itself.
  await Task.filterBy({ userId: id }).deleteAll();
  const user = await User.find(id);
  if (user) await user.delete();
  const jar = await cookies();
  const current = jar.get(USER_COOKIE)?.value;
  const deleted = user?.name;
  if (deleted && current === deleted) jar.delete(USER_COOKIE);
  revalidatePath('/');
}

export async function addTask(userId: number, title: string): Promise<void> {
  await dbReady;
  const trimmed = title.trim();
  if (!trimmed || !Number.isFinite(userId)) return;
  await Task.create({ title: trimmed, done: false, userId });
  revalidatePath('/');
}

export async function toggleTask(id: number): Promise<void> {
  await dbReady;
  if (!Number.isFinite(id)) return;
  const task = await Task.find(id);
  if (task) await task.update({ done: !task.done });
  revalidatePath('/');
}

export async function deleteTask(id: number): Promise<void> {
  await dbReady;
  if (!Number.isFinite(id)) return;
  const task = await Task.find(id);
  if (task) await task.delete();
  revalidatePath('/');
}
