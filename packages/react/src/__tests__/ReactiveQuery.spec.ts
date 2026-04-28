import { describe, expect, it } from 'vitest';
import { ReactiveQuery } from '../ReactiveQuery.js';
import { makeFixtures } from './helpers.js';

const { Todo } = makeFixtures();

describe('ReactiveQuery', () => {
  it('chain produces new instances (immutable)', () => {
    const a = ReactiveQuery.fromModel(Todo as any);
    const b = a.filterBy({ done: false });
    expect(a).not.toBe(b);
  });

  it('hash is stable across structurally equal chains', () => {
    const a = ReactiveQuery.fromModel(Todo as any).filterBy({ done: false });
    const b = ReactiveQuery.fromModel(Todo as any).filterBy({ done: false });
    expect(a.hash('all')).toEqual(b.hash('all'));
  });

  it('hash differs when arg-shape differs', () => {
    const a = ReactiveQuery.fromModel(Todo as any).filterBy({ done: false });
    const b = ReactiveQuery.fromModel(Todo as any).filterBy({ done: true });
    expect(a.hash('all')).not.toEqual(b.hash('all'));
  });

  it('hash differs by terminal kind', () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    expect(q.hash('all')).not.toEqual(q.hash('first'));
  });

  it('hash includes terminal args (find pk)', () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    expect(q.hash('find', [1])).not.toEqual(q.hash('find', [2]));
  });

  it('hash includes watch keys', () => {
    const q = ReactiveQuery.fromModel(Todo as any);
    expect(q.hash('all', [], { watchKeys: ['todos'] })).not.toEqual(
      q.hash('all', [], { watchKeys: ['users'] }),
    );
  });
});
