import { describe, expect, it } from 'vitest';
import { ColumnQuery } from '../query/ColumnQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';

const FakeModel = { tableName: 't', keys: { id: 1 } };

const stubState = {
  Model: FakeModel,
  filter: undefined,
  order: [],
  selectedIncludes: [],
  includeStrategy: 'preload' as const,
  pendingJoins: [],
  softDelete: false as const,
};

describe('ColumnQuery', () => {
  it('resolves to empty array (stub materialize)', async () => {
    const q = new ColumnQuery(FakeModel as any, 'email', stubState as any, { kind: 'column', column: 'email' });
    expect(await q).toEqual([]);
  });

  it('exposes column and projection', () => {
    const q = new ColumnQuery(FakeModel as any, 'email', stubState as any, { kind: 'column', column: 'email' });
    expect(q.column).toBe('email');
    expect(q.projection).toEqual({ kind: 'column', column: 'email' });
  });

  it('resolves via StubMaterialize subclass', async () => {
    class StubMaterialize extends ColumnQuery<string[]> {
      protected override materialize() {
        return Promise.resolve(['a@b', 'c@d']);
      }
    }
    const q = new StubMaterialize(FakeModel as any, 'email', stubState as any, { kind: 'column', column: 'email' });
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
