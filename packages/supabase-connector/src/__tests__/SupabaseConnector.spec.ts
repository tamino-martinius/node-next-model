import { defineSchema } from '@next-model/core';
import { describe, expect, it } from 'vitest';
import { MockSupabaseClient } from '../MockSupabaseClient.js';
import { SupabaseConnector } from '../SupabaseConnector.js';

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
