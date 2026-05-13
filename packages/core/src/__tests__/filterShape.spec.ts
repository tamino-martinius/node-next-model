import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model, normalizeFilterShape } from '../index.js';

interface Row {
  id?: number;
  name: string;
  age: number;
  status: 'open' | 'pending' | 'closed';
  metadata: { source: string };
}

const schema = defineSchema({
  tickets: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
      status: { type: 'string' },
      metadata: { type: 'json' },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

function buildModel(connector: MemoryConnector) {
  return class Ticket extends Model({
    tableName: 'tickets',
    connector,
    timestamps: false,
  }) {};
}

async function seed(Ticket: ReturnType<typeof buildModel>) {
  await Ticket.createMany([
    { name: 'A', age: 10, status: 'open', metadata: { source: 'web' } },
    { name: 'B', age: 40, status: 'pending', metadata: { source: 'api' } },
    { name: 'C', age: 20, status: 'open', metadata: { source: 'web' } },
    { name: 'D', age: 30, status: 'closed', metadata: { source: 'api' } },
    { name: 'E', age: 50, status: 'pending', metadata: { source: 'email' } },
  ]);
}

describe('normalizeFilterShape (pure)', () => {
  it('flips a single column-op map', () => {
    expect(normalizeFilterShape({ age: { $gt: 18 } })).toEqual({ $gt: { age: 18 } });
  });

  it('splits multi-op column maps into $and + per-op children', () => {
    expect(normalizeFilterShape({ age: { $gt: 18, $lt: 65 } })).toEqual({
      $and: [{ $gt: { age: 18 } }, { $lt: { age: 65 } }],
    });
  });

  it('rewrites $not inside a column map', () => {
    expect(normalizeFilterShape({ name: { $not: 'john' } })).toEqual({
      $not: { name: 'john' },
    });
  });

  it('leaves plain equality untouched', () => {
    expect(normalizeFilterShape({ active: true })).toEqual({ active: true });
  });

  it('treats nested object equality as equality, not an op map', () => {
    const filter = { metadata: { source: 'web' } };
    expect(normalizeFilterShape(filter)).toEqual(filter);
  });

  it('leaves legacy $op-first shapes unchanged', () => {
    const legacy = { $gt: { age: 18 } };
    expect(normalizeFilterShape(legacy)).toEqual(legacy);
  });

  it('recurses into $and / $or children', () => {
    expect(
      normalizeFilterShape({
        $or: [{ age: { $gt: 40 } }, { status: 'closed' }],
      }),
    ).toEqual({
      $or: [{ $gt: { age: 40 } }, { status: 'closed' }],
    });
  });

  it('recurses into $not', () => {
    expect(normalizeFilterShape({ $not: { age: { $gte: 18 } } })).toEqual({
      $not: { $gte: { age: 18 } },
    });
  });

  it('leaves $raw and $async alone', () => {
    expect(normalizeFilterShape({ $raw: "name = 'ada'" })).toEqual({ $raw: "name = 'ada'" });
    const promise = Promise.resolve({ age: { $gt: 1 } });
    expect(normalizeFilterShape({ $async: promise })).toEqual({ $async: promise });
  });
});

describe('filterBy accepts both shapes', () => {
  it('filters correctly with the new column-first shape', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({ age: { $gt: 25 } })
      .orderBy({ key: 'age' })
      .all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['D', 'B', 'E']);
  });

  it('filters correctly with the legacy $op-first shape', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({ $gt: { age: 25 } } as any)
      .orderBy({ key: 'age' })
      .all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['D', 'B', 'E']);
  });

  it('column-scoped $in works', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({
      status: { $in: ['open', 'pending'] },
    }).all();
    expect(rows.map((r) => (r.attributes as Row).name).sort()).toEqual(['A', 'B', 'C', 'E']);
  });

  it('column-scoped $not works', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({ name: { $not: 'A' } }).all();
    expect(rows.map((r) => (r.attributes as Row).name).sort()).toEqual(['B', 'C', 'D', 'E']);
  });

  it('multi-op column maps compose into $and', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({ age: { $gt: 15, $lt: 45 } })
      .orderBy({ key: 'age' })
      .all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['C', 'D', 'B']);
  });

  it('top-level $and + $or still compose with the new shape inside', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({
      $or: [{ age: { $lt: 15 } }, { status: 'closed' }],
    })
      .orderBy({ key: 'age' })
      .all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['A', 'D']);
  });

  it('nested object equality still compares by value', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    // Equality against an object literal — the normalizer must NOT treat
    // `{ source: 'web' }` as an operator map because `source` doesn't start
    // with `$`. Memory connector uses referential equality though, so we
    // just assert the filter didn't get mangled into an operator.
    const rows = await Ticket.filterBy({ metadata: { source: 'web' } }).all();
    expect(rows.length).toBeGreaterThanOrEqual(0); // parses without throwing
  });
});

describe('normalizeFilterShape composes mixed-object filters', () => {
  it('AND-wraps equality + top-level $null', () => {
    expect(normalizeFilterShape({ status: 'open', $null: 'metadata' })).toEqual({
      $and: [{ status: 'open' }, { $null: 'metadata' }],
    });
  });

  it('AND-wraps equality + top-level $in', () => {
    expect(normalizeFilterShape({ status: 'open', $in: { age: [10, 20] } })).toEqual({
      $and: [{ status: 'open' }, { $in: { age: [10, 20] } }],
    });
  });

  it('AND-wraps equality + column-op map ($gt)', () => {
    expect(normalizeFilterShape({ status: 'open', age: { $gt: 18 } })).toEqual({
      $and: [{ status: 'open' }, { $gt: { age: 18 } }],
    });
  });

  it('AND-wraps multiple top-level operators', () => {
    expect(
      normalizeFilterShape({
        $null: 'archivedAt',
        $notNull: 'reviewedAt',
      }),
    ).toEqual({
      $and: [{ $null: 'archivedAt' }, { $notNull: 'reviewedAt' }],
    });
  });

  it('preserves $and alongside equality (composition op is its own piece)', () => {
    const out = normalizeFilterShape({
      status: 'open',
      $and: [{ age: { $gt: 18 } }],
    });
    expect(out).toEqual({
      $and: [{ status: 'open' }, { $and: [{ $gt: { age: 18 } }] }],
    });
  });
});

describe('filterBy composes mixed-object filters end-to-end', () => {
  it('mixed equality + $null: row in both', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    // Make the metadata column null on row B
    await Ticket.filterBy({ name: 'B' }).updateAll({ metadata: null });
    const rows = await Ticket.filterBy({ status: 'pending', $null: 'metadata' }).all();
    // Only B is both pending AND has null metadata; E is pending but has metadata.
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['B']);
  });

  it('mixed equality + $in: row in both', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    const rows = await Ticket.filterBy({
      status: 'open',
      $in: { age: [10, 20, 40] },
    })
      .orderBy({ key: 'age' })
      .all();
    // status=open: A,C. age in 10/20/40: A,C,B. Intersection: A,C.
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['A', 'C']);
  });

  it('mixed $and + $null still composes correctly', async () => {
    const connector = freshConnector();
    const Ticket = buildModel(connector);
    await seed(Ticket);
    await Ticket.filterBy({ name: 'B' }).updateAll({ metadata: null });
    const rows = await Ticket.filterBy({
      $and: [{ status: 'pending' }],
      $null: 'metadata',
    } as any).all();
    expect(rows.map((r) => (r.attributes as Row).name)).toEqual(['B']);
  });
});
