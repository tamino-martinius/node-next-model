import { describe, expect, it } from 'vitest';
import { mergeFilters, mergeOrders, type QueryState } from '../query/QueryState.js';

describe('mergeFilters', () => {
  it('returns the new filter when current is undefined', () => {
    expect(mergeFilters(undefined, { active: true })).toEqual({ active: true });
  });

  it('returns the current filter when next is empty', () => {
    expect(mergeFilters({ active: true }, {})).toEqual({ active: true });
  });

  it('AND-merges disjoint column filters into a flat object', () => {
    expect(mergeFilters({ active: true }, { role: 'admin' })).toEqual({
      active: true,
      role: 'admin',
    });
  });

  it('AND-wraps when both filters share a column', () => {
    expect(mergeFilters({ active: true }, { active: false })).toEqual({
      $and: [{ active: true }, { active: false }],
    });
  });

  it('AND-wraps when either side has special operators', () => {
    expect(mergeFilters({ $null: 'email' as any }, { active: true })).toEqual({
      $and: [{ $null: 'email' }, { active: true }],
    });
  });
});

describe('mergeOrders', () => {
  it('appends new order columns onto existing ones', () => {
    expect(
      mergeOrders([{ key: 'a' as any }], [{ key: 'b' as any }, { key: 'c' as any }]),
    ).toEqual([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
  });
});
