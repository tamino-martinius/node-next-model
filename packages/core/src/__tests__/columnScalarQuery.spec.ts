import { describe, expect, it } from 'vitest';
import { ColumnQuery } from '../query/ColumnQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';

const FakeModel = { tableName: 't', keys: { id: 1 } };

describe('ColumnQuery', () => {
  it('resolves to a list of values', async () => {
    const q = new ColumnQuery(FakeModel as any, 'email', async () => ['a@b', 'c@d']);
    expect(await q).toEqual(['a@b', 'c@d']);
  });
});

describe('ScalarQuery', () => {
  it('resolves to 0 for count aggregate (stub)', async () => {
    const state = {
      Model: FakeModel,
      filter: undefined,
      order: [],
      selectedIncludes: [],
      includeStrategy: 'preload' as const,
      pendingJoins: [],
      softDelete: false as const,
    };
    const q = new ScalarQuery(FakeModel as any, state as any, { kind: 'aggregate', op: 'count' });
    expect(await q).toBe(0);
  });

  it('resolves to undefined for non-count aggregate (stub)', async () => {
    const state = {
      Model: FakeModel,
      filter: undefined,
      order: [],
      selectedIncludes: [],
      includeStrategy: 'preload' as const,
      pendingJoins: [],
      softDelete: false as const,
    };
    const q = new ScalarQuery(FakeModel as any, state as any, { kind: 'aggregate', op: 'sum', column: 'amount' });
    expect(await q).toBeUndefined();
  });
});
