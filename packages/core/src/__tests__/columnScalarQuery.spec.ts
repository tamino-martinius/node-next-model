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
  it('resolves to a single scalar', async () => {
    const q = new ScalarQuery(FakeModel as any, async () => 42);
    expect(await q).toBe(42);
  });
});
