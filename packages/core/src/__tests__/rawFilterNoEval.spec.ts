/**
 * Acceptance tests for the no-eval refactor:
 *
 *  - `$raw.$query` as a predicate function works end-to-end against the
 *    in-memory connector (the recommended CSP-safe form).
 *  - `$raw.$query` as a JavaScript-source string throws a clear migration
 *    error rather than silently compiling the string at runtime.
 *  - `MemoryConnector.execute` with a function operates on the storage map
 *    directly.
 *  - `MemoryConnector.execute` with a string throws a clear migration error.
 *
 * Pairs with the static `dist/`-grep in
 * `.github/scripts/no-eval-in-dist.test.mjs` that asserts no dynamic-code
 * evaluation call sites remain in the published bundles.
 */
import { describe, expect, it } from 'vitest';

import { FilterError, MemoryConnector, UnsupportedOperationError } from '../index.js';

interface Row {
  id?: number;
  name: string;
  age: number;
}

const seed = async (): Promise<MemoryConnector> => {
  const connector = new MemoryConnector({ storage: {}, lastIds: {} });
  await connector.batchInsert('people', { id: 1 as any }, [
    { name: 'ada', age: 36 },
    { name: 'grace', age: 79 },
    { name: 'linus', age: 25 },
  ] as any);
  return connector;
};

describe('FilterEngine $raw without dynamic compilation', () => {
  it('accepts a predicate function as $query', async () => {
    const connector = await seed();
    const rows = (await connector.query({
      tableName: 'people',
      filter: {
        $raw: {
          $query: (item: Row, min: number) => item.age >= min,
          $bindings: [30],
        },
      },
    })) as Row[];
    expect(rows.map((r) => r.name).sort()).toEqual(['ada', 'grace']);
  });

  it('accepts a predicate with named bindings object', async () => {
    const connector = await seed();
    const rows = (await connector.query({
      tableName: 'people',
      filter: {
        $raw: {
          $query: (item: Row, opts: { min: number; max: number }) =>
            item.age >= opts.min && item.age <= opts.max,
          $bindings: { min: 30, max: 70 } as any,
        },
      },
    })) as Row[];
    expect(rows.map((r) => r.name)).toEqual(['ada']);
  });

  it('accepts a predicate with no bindings', async () => {
    const connector = await seed();
    const rows = (await connector.query({
      tableName: 'people',
      filter: {
        $raw: {
          $query: (item: Row) => item.name.startsWith('g'),
        },
      },
    })) as Row[];
    expect(rows.map((r) => r.name)).toEqual(['grace']);
  });

  it('rejects JS-source string with a migration hint instead of compiling it', async () => {
    const connector = await seed();
    await expect(
      connector.query({
        tableName: 'people',
        filter: {
          $raw: {
            $query: '(item) => item.age > 30',
          },
        },
      }),
    ).rejects.toBeInstanceOf(FilterError);

    await expect(
      connector.query({
        tableName: 'people',
        filter: {
          $raw: {
            $query: '(item) => item.age > 30',
          },
        },
      }),
    ).rejects.toThrow(/predicate function/);
  });

  it('rejects non-string non-function $query with a clear error', async () => {
    const connector = await seed();
    await expect(
      connector.query({
        tableName: 'people',
        filter: {
          $raw: {
            $query: 42 as any,
          },
        },
      }),
    ).rejects.toBeInstanceOf(FilterError);
  });
});

describe('MemoryConnector.execute without dynamic compilation', () => {
  it('accepts a function that walks the storage map', async () => {
    const connector = await seed();
    const adults = await connector.execute(
      (storage: any, min: number) => (storage.people as Row[]).filter((r) => r.age >= min),
      [30],
    );
    expect(adults.map((r) => r.name).sort()).toEqual(['ada', 'grace']);
  });

  it('accepts a function with a scalar (non-array) bindings argument', async () => {
    const connector = await seed();
    const rows = await connector.execute(
      (storage: any, n: number) => (storage.people as Row[]).slice(0, n),
      2 as any,
    );
    expect(rows).toHaveLength(2);
  });

  it('rejects JS-source string with a migration hint instead of compiling it', async () => {
    const connector = await seed();
    await expect(
      connector.execute('(storage) => storage.people', [] as any),
    ).rejects.toBeInstanceOf(UnsupportedOperationError);

    await expect(connector.execute('(storage) => storage.people', [] as any)).rejects.toThrow(
      /no longer accepts JavaScript-source strings/,
    );
  });
});
