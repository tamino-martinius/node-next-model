import { describe, expect, it } from 'vitest';
import {
  defineSchema,
  KeyType,
  MemoryConnector,
  Model,
} from '../index.js';

describe('Model construction with explicit primary key value', () => {
  it('legacy: passing id through init does not throw "Cannot redefine property"', async () => {
    const connector = new MemoryConnector({ storage: {} });
    class User extends Model({
      tableName: 'users',
      connector,
      keys: { id: KeyType.number },
      timestamps: false,
      init: (props: { id?: number; name: string }) => props,
    }) {}

    // Pre-fix this would throw: TypeError: Cannot redefine property: id
    const u = new User({ id: 42, name: 'Ada' });
    expect(u.name).toBe('Ada');
  });

  it('schema-mode: passing id through init does not throw "Cannot redefine property"', async () => {
    const schema = defineSchema({
      users: {
        columns: {
          id: { type: 'integer', primary: true },
          name: { type: 'string' },
        },
      },
    });
    const connector = new MemoryConnector({ storage: {} }, { schema });
    class User extends Model({
      connector,
      tableName: 'users',
      timestamps: false,
      init: (props: { id?: number; name: string }) => props,
    }) {}

    const u = new User({ id: 42, name: 'Ada' });
    expect(u.name).toBe('Ada');
  });
});
