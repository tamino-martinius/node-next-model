'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { dbReady, Task } from './db';

const USER_COOKIE = 'nm-todo-user';

export async function setCurrentUser(name: string): Promise<void> {
  await dbReady;
  const jar = await cookies();
  jar.set(USER_COOKIE, name, { httpOnly: false, sameSite: 'lax', path: '/' });
  revalidatePath('/');
}

export async function addTask(formData: FormData): Promise<void> {
  await dbReady;
  const userId = Number(formData.get('userId'));
  const title = String(formData.get('title') ?? '').trim();
  if (!title || !Number.isFinite(userId)) return;
  await Task.create({ title, done: false, userId });
  revalidatePath('/');
}

export async function toggleTask(formData: FormData): Promise<void> {
  await dbReady;
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const task = await Task.find(id);
  if (task) await task.update({ done: !task.done });
  revalidatePath('/');
}

export async function deleteTask(formData: FormData): Promise<void> {
  await dbReady;
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const task = await Task.find(id);
  if (task) await task.delete();
  revalidatePath('/');
}
