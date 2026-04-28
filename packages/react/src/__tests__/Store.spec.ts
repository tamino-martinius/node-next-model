import { describe, expect, it, vi } from 'vitest';
import { Store } from '../Store.js';

const fakeInstance = (id: number) => ({ id }) as unknown as object;

describe('Store identity map', () => {
  it('register/acquire round-trip', () => {
    const s = new Store();
    const inst = fakeInstance(1);
    s.register('todos', { id: 1 }, inst as any);
    expect(s.acquire('todos', { id: 1 })).toBe(inst);
  });

  it('register returns the existing entry on duplicate insert', () => {
    const s = new Store();
    const a = fakeInstance(1);
    const b = fakeInstance(1);
    expect(s.register('todos', { id: 1 }, a as any)).toBe(a);
    expect(s.register('todos', { id: 1 }, b as any)).toBe(a);
  });

  it('refcount: register sets to 1, retain bumps, release decrements', () => {
    const s = new Store();
    s.register('todos', { id: 1 }, fakeInstance(1) as any);
    expect(s.refcount('todos', { id: 1 })).toBe(1);
    s.retain('todos', { id: 1 });
    expect(s.refcount('todos', { id: 1 })).toBe(2);
    s.release('todos', { id: 1 });
    expect(s.refcount('todos', { id: 1 })).toBe(1);
  });

  it('release evicts when refcount drops below 1', () => {
    const s = new Store();
    s.register('todos', { id: 1 }, fakeInstance(1) as any);
    s.release('todos', { id: 1 });
    expect(s.acquire('todos', { id: 1 })).toBeUndefined();
  });

  it('softRegister keeps refcount at 0', () => {
    const s = new Store();
    s.softRegister('todos', { id: 1 }, fakeInstance(1) as any);
    expect(s.refcount('todos', { id: 1 })).toBe(0);
    expect(s.acquire('todos', { id: 1 })).toBeDefined();
  });

  it('softRegister is a no-op when entry already exists', () => {
    const s = new Store();
    const a = fakeInstance(1);
    const b = fakeInstance(1);
    s.softRegister('todos', { id: 1 }, a as any);
    expect(s.softRegister('todos', { id: 1 }, b as any)).toBe(a);
    expect(s.refcount('todos', { id: 1 })).toBe(0);
  });

  it('drop removes the entry regardless of refcount', () => {
    const s = new Store();
    s.register('todos', { id: 1 }, fakeInstance(1) as any);
    s.retain('todos', { id: 1 });
    s.drop('todos', { id: 1 });
    expect(s.acquire('todos', { id: 1 })).toBeUndefined();
  });

  it('refcount returns 0 for absent rows', () => {
    const s = new Store();
    expect(s.refcount('todos', { id: 99 })).toBe(0);
  });
});

describe('Store pub/sub', () => {
  it('subscribe/publish round-trip', () => {
    const s = new Store();
    const cb = vi.fn();
    s.subscribe('k', cb);
    s.publish('k');
    expect(cb).toHaveBeenCalledOnce();
  });

  it('subscribe returns unsubscribe', () => {
    const s = new Store();
    const cb = vi.fn();
    const off = s.subscribe('k', cb);
    off();
    s.publish('k');
    expect(cb).not.toHaveBeenCalled();
  });

  it('publishRow uses canonicalised row key', () => {
    const s = new Store();
    const cb = vi.fn();
    s.subscribe('row:todos:{"id":1}', cb);
    s.publishRow('todos', { id: 1 });
    expect(cb).toHaveBeenCalled();
  });

  it('publishKeys broadcasts to each key supplied', () => {
    const s = new Store();
    const a = vi.fn();
    const b = vi.fn();
    const sym = Symbol('shared');
    s.subscribe('alpha', a);
    s.subscribe(sym, b);
    s.publishKeys(['alpha', sym]);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('callbacks that throw do not block siblings', () => {
    const s = new Store();
    const a = vi.fn(() => { throw new Error('boom'); });
    const b = vi.fn();
    s.subscribe('k', a);
    s.subscribe('k', b);
    expect(() => s.publish('k')).not.toThrow();
    expect(b).toHaveBeenCalled();
  });

  it('dispose flips isDisposed and silences future publishes', () => {
    const s = new Store();
    const cb = vi.fn();
    s.subscribe('k', cb);
    expect(s.isDisposed()).toBe(false);
    s.dispose();
    expect(s.isDisposed()).toBe(true);
    s.publish('k');
    expect(cb).not.toHaveBeenCalled();
  });
});
