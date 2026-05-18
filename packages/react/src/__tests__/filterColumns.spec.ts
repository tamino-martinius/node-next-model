import { describe, expect, it } from 'vitest';
import { extractFilterColumns, filterColumnsOf } from '../filterColumns.js';
import type { QueryPlan } from '../ReactiveQuery.js';

const plan = (steps: QueryPlan['steps']): QueryPlan => ({
  ModelClass: { tableName: 't' },
  steps,
});

describe('extractFilterColumns', () => {
  it('adds plain column predicates', () => {
    const cols = new Set<string>();
    extractFilterColumns({ projectId: 'p1', state: 'open' }, cols);
    expect([...cols].sort()).toEqual(['projectId', 'state']);
  });

  it('handles $null / $notNull keyed by a column name string', () => {
    const cols = new Set<string>();
    extractFilterColumns({ $null: 'archivedAt' }, cols);
    extractFilterColumns({ $notNull: 'closedAt' }, cols);
    expect([...cols].sort()).toEqual(['archivedAt', 'closedAt']);
  });

  it('handles $in / $notIn / $between keyed by column → values', () => {
    const cols = new Set<string>();
    extractFilterColumns({ $in: { id: [1, 2] } }, cols);
    extractFilterColumns({ $notIn: { state: ['done'] } }, cols);
    extractFilterColumns({ $between: { age: [10, 20] } }, cols);
    expect([...cols].sort()).toEqual(['age', 'id', 'state']);
  });

  it('recurses into $and / $or arrays', () => {
    const cols = new Set<string>();
    extractFilterColumns({ $and: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }] }, cols);
    expect([...cols].sort()).toEqual(['a', 'b', 'c']);
  });

  it('recurses into $not', () => {
    const cols = new Set<string>();
    extractFilterColumns({ $not: { x: 1 } }, cols);
    expect([...cols]).toEqual(['x']);
  });

  it('skips unknown $-operators without throwing', () => {
    const cols = new Set<string>();
    extractFilterColumns({ $unknown: 'foo', name: 'n' }, cols);
    expect([...cols]).toEqual(['name']);
  });

  it('ignores non-objects', () => {
    const cols = new Set<string>();
    extractFilterColumns(null, cols);
    extractFilterColumns(undefined, cols);
    extractFilterColumns(42, cols);
    expect(cols.size).toBe(0);
  });
});

describe('filterColumnsOf', () => {
  it('returns empty for a plan with no filters', () => {
    expect(filterColumnsOf(plan([]))).toEqual(new Set());
  });

  it('walks every filterBy step', () => {
    const cols = filterColumnsOf(
      plan([
        { method: 'filterBy', args: [{ projectId: 'p1' }] },
        { method: 'filterBy', args: [{ $null: 'archivedAt' }] },
      ]),
    );
    expect([...cols].sort()).toEqual(['archivedAt', 'projectId']);
  });

  it('includes whereMissing column names', () => {
    const cols = filterColumnsOf(plan([{ method: 'whereMissing', args: ['parentId'] }]));
    expect([...cols]).toEqual(['parentId']);
  });

  it('ignores non-filter chain methods (orderBy, limit, etc.)', () => {
    const cols = filterColumnsOf(
      plan([
        { method: 'orderBy', args: [{ key: 'createdAt', dir: 1 }] },
        { method: 'limit', args: [10] },
      ]),
    );
    expect(cols.size).toBe(0);
  });
});
