import { MemoryConnector, Model } from '@next-model/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitterFor } from '../instanceState.js';
import { wrapInstance } from '../ReactiveInstance.js';

const connector = new MemoryConnector({ storage: {} });
class Todo extends Model({
  tableName: 'todos',
  connector,
  init: (props: { title: string; done: boolean }) => props,
  timestamps: false,
}) {}

beforeEach(async () => {
  await connector.dropTable('todos').catch(() => undefined);
  await connector.createTable('todos', (t) => {
    t.integer('id', { primary: true, autoIncrement: true, null: false });
    t.string('title');
    t.boolean('done', { default: false });
  });
});

describe('wrapInstance', () => {
  it('reads attributes through the proxy', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const reactive = wrapInstance(todo);
    expect((reactive as any).title).toBe('a');
  });

  it('forwards property writes to the underlying setter', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const reactive = wrapInstance(todo);
    (reactive as any).title = 'b';
    expect((todo as any).title).toBe('b');
    expect(todo.isChanged()).toBe(true);
  });

  it('emits exactly once per assign() write', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const reactive = wrapInstance(todo);
    const cb = vi.fn();
    emitterFor(todo).subscribe(cb);
    (reactive as any).title = 'b';
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('emits once when assign() applies multiple keys', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const reactive = wrapInstance(todo);
    const cb = vi.fn();
    emitterFor(todo).subscribe(cb);
    (reactive as any).assign({ title: 'b', done: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('forwards methods (isChanged, errors) through the proxy', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const reactive = wrapInstance(todo);
    expect((reactive as any).isChanged()).toBe(false);
    (reactive as any).title = 'b';
    expect((reactive as any).isChanged()).toBe(true);
    expect((reactive as any).errors).toBeDefined();
  });

  it('returns the same proxy when wrapping twice', () => {
    const todo = Todo.build({ title: 'a', done: false });
    const a = wrapInstance(todo);
    const b = wrapInstance(todo);
    expect(a).toBe(b);
  });

  it('emits after save() resolves', async () => {
    const reactive = wrapInstance(Todo.build({ title: 'a', done: false })) as any;
    const cb = vi.fn();
    emitterFor(reactive).subscribe(cb);
    await reactive.save();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('emits even when save() rejects (validation error path)', async () => {
    class StrictTodo extends Model({
      tableName: 'todos',
      connector,
      init: (p: { title: string; done: boolean }) => p,
      validators: [(t: any) => Boolean(t.attributes.title)],
      timestamps: false,
    }) {}
    const reactive = wrapInstance(StrictTodo.build({ title: '', done: false })) as any;
    const cb = vi.fn();
    emitterFor(reactive).subscribe(cb);
    await reactive.save().catch(() => undefined);
    expect(cb).toHaveBeenCalled();
  });
});
