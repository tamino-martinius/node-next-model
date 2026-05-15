import { describe, expect, it } from 'vitest';

import { defineSchema, MemoryConnector, Model } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      bio: { type: 'string', null: true },
      // Default-timestamps inference looks for these columns; declare them so
      // the test schema keeps the historical createdAt/updatedAt enabled.
      createdAt: { type: 'datetime', null: true },
      updatedAt: { type: 'datetime', null: true },
    },
  },
});

function buildUser() {
  const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
  return class User extends Model({ tableName: 'users', connector }) {};
}

describe('Model instance — column accessor enumerability', () => {
  it('exposes schema columns as enumerable own properties', async () => {
    const User = buildUser();
    const u = await User.create({ name: 'Ada' });
    const keys = Object.keys(u);
    expect(keys).toEqual(expect.arrayContaining(['id', 'name', 'bio', 'createdAt', 'updatedAt']));
  });

  it('column getters are accessor descriptors, not data fields', async () => {
    // The accessor identity matters: writes through `instance.col = v` must
    // still flow through `assign(...)`, not become plain own data props that
    // bypass dirty tracking.
    const User = buildUser();
    const u = await User.create({ name: 'Ada' });
    const desc = Object.getOwnPropertyDescriptor(u, 'name');
    expect(desc?.enumerable).toBe(true);
    expect(typeof desc?.get).toBe('function');
    expect(typeof desc?.set).toBe('function');
  });

  it('survives structuredClone with the column values at the top level', async () => {
    // Electron IPC, Web Workers and BroadcastChannel all use the structured
    // clone algorithm. Receivers across that boundary must see the column
    // shape — historically the clone only carried `persistentProps`,
    // `changedProps`, `lastSavedChanges`, `keys` because column getters were
    // non-enumerable.
    const User = buildUser();
    const u = await User.create({ name: 'Ada', bio: 'mathematician' });
    const clone = structuredClone(u) as Record<string, unknown>;
    expect(clone.name).toBe('Ada');
    expect(clone.bio).toBe('mathematician');
    expect(typeof clone.id).toBe('number');
  });

  it('exposes storeAccessor sub-keys as enumerable own properties', async () => {
    // JSON-column sub-key accessors are installed on every instance via the
    // `storeAccessors` factory option. They should follow the same
    // enumerability rule as ordinary column accessors so consumers can
    // discover them via `Object.keys` / `structuredClone`.
    const localSchema = defineSchema({
      profiles: {
        columns: {
          id: { type: 'integer', primary: true, autoIncrement: true },
          settings: { type: 'json', null: true },
        },
      },
    });
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema: localSchema });
    class Profile extends Model({
      tableName: 'profiles',
      connector,
      timestamps: false,
      storeAccessors: { settings: ['theme', 'locale'] },
    }) {}
    const p = await Profile.create({ settings: { theme: 'dark', locale: 'en' } });
    const keys = Object.keys(p);
    expect(keys).toContain('theme');
    expect(keys).toContain('locale');
    const themeDesc = Object.getOwnPropertyDescriptor(p, 'theme');
    expect(themeDesc?.enumerable).toBe(true);
  });
});
