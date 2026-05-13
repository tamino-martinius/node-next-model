import { describe, expect, it } from 'vitest';
import { pkKey, rowKey } from '../pkKey.js';

describe('pkKey', () => {
  it('serialises a single-key object', () => {
    expect(pkKey({ id: 1 })).toBe('{"id":1}');
  });

  it('canonicalises composite keys by sorting property names', () => {
    expect(pkKey({ a: 1, b: 2 })).toBe(pkKey({ b: 2, a: 1 }));
    expect(pkKey({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  it('handles non-primitive values via JSON.stringify', () => {
    expect(pkKey({ id: 'x', tenant: 't' })).toBe('{"id":"x","tenant":"t"}');
  });
});

describe('rowKey', () => {
  it('prefixes by tableName', () => {
    expect(rowKey('todos', { id: 1 })).toBe('row:todos:{"id":1}');
  });
});
