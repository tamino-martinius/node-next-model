import { defineSchema } from '@next-model/core';
import { describe, expect, it } from 'vitest';
import { applyFilters } from '../filters.js';
import { MockSupabaseClient } from '../MockSupabaseClient.js';
import { SupabaseConnector } from '../SupabaseConnector.js';
import type { PostgrestBuilderLike } from '../types.js';

const schema = defineSchema({
  cats: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

describe('SupabaseConnector construction', () => {
  it('accepts a bare client', () => {
    const c = new SupabaseConnector(new MockSupabaseClient());
    expect(c).toBeInstanceOf(SupabaseConnector);
  });
  it('accepts a { client } wrapper and exposes the attached schema', () => {
    const c = new SupabaseConnector({ client: new MockSupabaseClient() }, { schema });
    expect(c.schema).toBe(schema);
  });
  it('resolves the primary key from the attached schema', () => {
    const c = new SupabaseConnector(new MockSupabaseClient(), { schema }) as unknown as {
      pk(t: string): string;
    };
    expect(c.pk('cats')).toBe('id');
    expect(c.pk('unknown')).toBe('id');
  });
});

describe('applyFilters', () => {
  function recorder() {
    const calls: Array<[string, unknown[]]> = [];
    const b = new Proxy({} as PostgrestBuilderLike, {
      get(_t, prop: string) {
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return b;
        };
      },
    });
    return { b, calls };
  }

  it('maps equality and comparison operators', () => {
    const { b, calls } = recorder();
    applyFilters(b, { name: 'ada', $gte: { age: 5 }, $lt: { age: 10 } });
    expect(calls).toContainEqual(['eq', ['name', 'ada']]);
    expect(calls).toContainEqual(['gte', ['age', 5]]);
    expect(calls).toContainEqual(['lt', ['age', 10]]);
  });

  it('maps $in / $null / $between / $or', () => {
    const { b, calls } = recorder();
    applyFilters(b, { $in: { age: [1, 2] } });
    expect(calls).toContainEqual(['in', ['age', [1, 2]]]);
    const r2 = recorder();
    applyFilters(r2.b, { $null: 'name' });
    expect(r2.calls).toContainEqual(['is', ['name', null]]);
    const r3 = recorder();
    applyFilters(r3.b, { $between: { age: [1, 9] } });
    expect(r3.calls).toContainEqual(['gte', ['age', 1]]);
    expect(r3.calls).toContainEqual(['lte', ['age', 9]]);
    const r4 = recorder();
    applyFilters(r4.b, { $or: [{ name: 'a' }, { $gt: { age: 3 } }] });
    expect(r4.calls).toContainEqual(['or', ['name.eq.a,age.gt.3']]);
  });

  it('throws FilterError on $raw', () => {
    const { b } = recorder();
    expect(() => applyFilters(b, { $raw: { $query: 'age > 1' } } as never)).toThrow();
  });
});
