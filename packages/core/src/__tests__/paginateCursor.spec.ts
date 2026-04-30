import { beforeEach, describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model } from '../index.js';

const schema = defineSchema({
  leaderboard: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      score: { type: 'integer' },
      createdAt: { type: 'string' },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

function buildModel(connector: MemoryConnector) {
  return class Leaderboard extends Model({
    tableName: 'leaderboard',
    connector,
    timestamps: false,
  }) {};
}

describe('paginateCursor with non-id order keys', () => {
  let Leaderboard: ReturnType<typeof buildModel>;

  beforeEach(async () => {
    const connector = freshConnector();
    Leaderboard = buildModel(connector);
    // Scores intentionally out of insertion order so id ordering ≠ score ordering.
    await Leaderboard.createMany([
      { name: 'A', score: 10, createdAt: '2026-01-01' },
      { name: 'B', score: 40, createdAt: '2026-01-02' },
      { name: 'C', score: 20, createdAt: '2026-01-03' },
      { name: 'D', score: 30, createdAt: '2026-01-04' },
      { name: 'E', score: 50, createdAt: '2026-01-05' },
    ]);
  });

  it('walks forward in ascending score order', async () => {
    const first = await Leaderboard.orderBy({ key: 'score' }).paginateCursor({ limit: 2 });
    expect(first.items.map((r) => r.name)).toEqual(['A', 'C']);
    expect(first.hasMore).toBe(true);

    const second = await Leaderboard.orderBy({ key: 'score' }).paginateCursor({
      after: first.nextCursor,
      limit: 2,
    });
    expect(second.items.map((r) => r.name)).toEqual(['D', 'B']);

    const third = await Leaderboard.orderBy({ key: 'score' }).paginateCursor({
      after: second.nextCursor,
      limit: 2,
    });
    expect(third.items.map((r) => r.name)).toEqual(['E']);
    expect(third.hasMore).toBe(false);
  });

  it('walks forward in descending score order', async () => {
    const chain = Leaderboard.orderBy({ key: 'score', dir: -1 });
    const first = await chain.paginateCursor({ limit: 2 });
    expect(first.items.map((r) => r.name)).toEqual(['E', 'B']);

    const second = await chain.paginateCursor({ after: first.nextCursor, limit: 2 });
    expect(second.items.map((r) => r.name)).toEqual(['D', 'C']);

    const third = await chain.paginateCursor({ after: second.nextCursor, limit: 2 });
    expect(third.items.map((r) => r.name)).toEqual(['A']);
  });

  it('walks backward via `before` with non-id order', async () => {
    const chain = Leaderboard.orderBy({ key: 'score' });
    const first = await chain.paginateCursor({ limit: 2 });
    const second = await chain.paginateCursor({ after: first.nextCursor, limit: 2 });
    // Walking backward from the second page's first row should land back on
    // the first page.
    const prev = await chain.paginateCursor({ before: second.prevCursor, limit: 2 });
    expect(prev.items.map((r) => r.name)).toEqual(first.items.map((r) => r.name));
  });
});

describe('paginateCursor with tied order values', () => {
  it('uses the primary key as tie-breaker so duplicates paginate without dropouts', async () => {
    const connector = freshConnector();
    const Leaderboard = buildModel(connector);
    // Every row shares score=5 — pagination must fall back to the id
    // tie-breaker or we'd skip rows.
    await Leaderboard.createMany(
      Array.from({ length: 5 }, (_unused, i) => ({
        name: `row-${i + 1}`,
        score: 5,
        createdAt: `2026-01-0${i + 1}`,
      })),
    );
    const chain = Leaderboard.orderBy({ key: 'score' });
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i += 1) {
      const page = await chain.paginateCursor({ after: cursor, limit: 2 });
      seen.push(...page.items.map((r) => r.name));
      if (!page.hasMore) break;
      cursor = page.nextCursor;
    }
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual(['row-1', 'row-2', 'row-3', 'row-4', 'row-5']);
  });
});

describe('paginateCursor falls back to primary key when no order is set', () => {
  it('produces id-sorted pages with hasMore transitions', async () => {
    const connector = freshConnector();
    const Leaderboard = buildModel(connector);
    await Leaderboard.createMany([
      { name: 'A', score: 10, createdAt: '2026-01-01' },
      { name: 'B', score: 40, createdAt: '2026-01-02' },
      { name: 'C', score: 20, createdAt: '2026-01-03' },
    ]);
    const first = await Leaderboard.paginateCursor({ limit: 2 });
    expect(first.items.map((r) => r.name)).toEqual(['A', 'B']);
    const second = await Leaderboard.paginateCursor({ after: first.nextCursor, limit: 2 });
    expect(second.items.map((r) => r.name)).toEqual(['C']);
  });
});
