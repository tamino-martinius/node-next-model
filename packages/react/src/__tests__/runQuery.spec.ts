import { beforeEach, describe, expect, it } from 'vitest';
import { ReactiveQuery } from '../ReactiveQuery.js';
import { runQuery } from '../runQuery.js';
import { makeFixtures } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
  await Todo.create({ title: 'a', done: false });
  await Todo.create({ title: 'b', done: true });
});

describe('runQuery', () => {
  it('all returns array', async () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    const data = await runQuery(q, 'all', []);
    expect((data as unknown[]).length).toBe(2);
  });

  it('count returns number', async () => {
    const q = ReactiveQuery.fromModel(Todo as any).filterBy({ done: false });
    expect(await runQuery(q, 'count', [])).toBe(1);
  });

  it('find returns instance or undefined', async () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    expect(await runQuery(q, 'find', [1])).toBeDefined();
    expect(await runQuery(q, 'find', [999])).toBeUndefined();
  });

  it('findBy applies filter', async () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    const found = await runQuery(q, 'findBy', [{ title: 'a' }]) as { title: string } | undefined;
    expect(found?.title).toBe('a');
  });

  it('exists returns boolean', async () => {
    const q = ReactiveQuery.fromModel(Todo as any).filterBy({ done: true });
    expect(await runQuery(q, 'exists', [])).toBe(true);
  });

  it('pluck returns column array', async () => {
    const q = ReactiveQuery.fromModel(Todo as any).orderBy({ key: 'id' });
    expect(await runQuery(q, 'pluck', ['title'])).toEqual(['a', 'b']);
  });

  it('throws on build terminal (sync only)', async () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    await expect(runQuery(q, 'build', [])).rejects.toThrow();
  });
});
