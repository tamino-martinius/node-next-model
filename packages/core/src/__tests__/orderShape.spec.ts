import { describe, expect, it } from 'vitest';

import { MemoryConnector } from '../MemoryConnector.js';
import { normalizeOrderEntry, SortDirection, type Storage } from '../types.js';

describe('normalizeOrderEntry', () => {
  it('passes strict { key, dir: Asc } through', () => {
    expect(normalizeOrderEntry({ key: 'name', dir: SortDirection.Asc })).toEqual({
      key: 'name',
      dir: SortDirection.Asc,
    });
  });

  it('passes strict { key, dir: Desc } through', () => {
    expect(normalizeOrderEntry({ key: 'name', dir: SortDirection.Desc })).toEqual({
      key: 'name',
      dir: SortDirection.Desc,
    });
  });

  it('defaults strict { key } (no dir) to ASC', () => {
    expect(normalizeOrderEntry({ key: 'name' })).toEqual({ key: 'name', dir: SortDirection.Asc });
  });

  it('parses loose { [col]: "asc" } as ASC', () => {
    expect(normalizeOrderEntry({ createdAt: 'asc' })).toEqual({
      key: 'createdAt',
      dir: SortDirection.Asc,
    });
  });

  it('parses loose { [col]: "desc" } as DESC', () => {
    expect(normalizeOrderEntry({ createdAt: 'desc' })).toEqual({
      key: 'createdAt',
      dir: SortDirection.Desc,
    });
  });

  it('parses loose uppercase "DESC"', () => {
    expect(normalizeOrderEntry({ createdAt: 'DESC' })).toEqual({
      key: 'createdAt',
      dir: SortDirection.Desc,
    });
  });

  it('parses strict shape with string dir', () => {
    expect(normalizeOrderEntry({ key: 'name', dir: 'desc' })).toEqual({
      key: 'name',
      dir: SortDirection.Desc,
    });
  });

  it('throws on shapes it cannot recognise', () => {
    expect(() => normalizeOrderEntry({ key: 'a', extra: 'b', other: 'c' })).not.toThrow();
    expect(() => normalizeOrderEntry({})).toThrow(/orderBy entry/);
    expect(() => normalizeOrderEntry(null as any)).toThrow();
    expect(() => normalizeOrderEntry('asc' as any)).toThrow();
  });
});

describe('MemoryConnector order shape compatibility', () => {
  function seeded(): MemoryConnector<undefined> {
    const storage: Storage = {
      items: [
        { id: 1, label: 'b', createdAt: 200 },
        { id: 2, label: 'a', createdAt: 300 },
        { id: 3, label: 'c', createdAt: 100 },
      ],
    };
    return new MemoryConnector({ storage });
  }

  it('strict ascending sorts correctly', async () => {
    const c = seeded();
    const rows = await c.query({
      tableName: 'items',
      order: [{ key: 'createdAt', dir: SortDirection.Asc }],
    });
    expect(rows.map((r) => r.label)).toEqual(['c', 'b', 'a']);
  });

  it('loose { col: "desc" } sorts descending', async () => {
    const c = seeded();
    const rows = await c.query({
      tableName: 'items',
      order: [{ createdAt: 'desc' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
  });

  it('loose { col: "asc" } sorts ascending', async () => {
    const c = seeded();
    const rows = await c.query({
      tableName: 'items',
      order: [{ createdAt: 'asc' } as any],
    });
    expect(rows.map((r) => r.label)).toEqual(['c', 'b', 'a']);
  });
});
