import { defineSchema, MemoryConnector, Model, type Storage } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      settings: { type: 'json' },
      preferences: { type: 'json' },
    },
  },
});

describe('storeAccessors (typed JSON sub-attribute accessors)', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage }, { schema });

  function makeUser() {
    return Model({
      tableName: 'users',
      connector: connector(),
      storeAccessors: {
        settings: ['theme', 'locale', 'fontSize'],
        preferences: ['emailFreq', 'tz'],
      },
    });
  }

  beforeEach(() => {
    storage = {
      users: [{ id: 1, name: 'Alice', settings: { theme: 'dark', locale: 'en' }, preferences: {} }],
    };
  });

  afterEach(() => {
    storage = {};
  });

  it('reads sub-keys from the JSON column', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    expect(u.theme).toBe('dark');
    expect(u.locale).toBe('en');
    expect(u.fontSize).toBeUndefined();
  });

  it('writing a sub-key updates the underlying JSON column', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    u.theme = 'light';
    expect(u.theme).toBe('light');
    expect(u.attributes.settings).toEqual({ theme: 'light', locale: 'en' });
  });

  it('initializes the JSON column when writing into a missing/undefined bag', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    u.emailFreq = 'daily';
    expect(u.attributes.preferences).toEqual({ emailFreq: 'daily' });
    u.tz = 'UTC';
    expect(u.attributes.preferences).toEqual({ emailFreq: 'daily', tz: 'UTC' });
  });

  it('persists changes through save() and reload()', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    u.theme = 'system';
    u.locale = 'de';
    await u.save();
    expect(storage.users[0].settings).toEqual({ theme: 'system', locale: 'de' });
    const fresh = (await User.find(1)) as any;
    expect(fresh.theme).toBe('system');
    expect(fresh.locale).toBe('de');
  });

  it('multiple stores coexist without interfering', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    u.theme = 'light';
    u.emailFreq = 'weekly';
    expect(u.attributes.settings).toEqual({ theme: 'light', locale: 'en' });
    expect(u.attributes.preferences).toEqual({ emailFreq: 'weekly' });
  });

  it('does not clobber persistent column accessors when a sub-key matches a column name', async () => {
    // 'name' is both a column AND we re-declare it as a storeAccessor sub-key.
    // The column accessor should win; the storeAccessor must skip the duplicate.
    const Demo = Model({
      tableName: 'users',
      connector: connector(),
      storeAccessors: { settings: ['name', 'theme'] },
    });
    const u = (await Demo.find(1)) as any;
    expect(u.name).toBe('Alice'); // top-level column wins
    u.theme = 'dark';
    expect(u.theme).toBe('dark'); // non-colliding sub-key still works
  });

  it('isChangedBy reports the JSON column as changed when a sub-key is set', async () => {
    const User = makeUser() as any;
    const u = (await User.find(1)) as any;
    expect(u.isChangedBy('settings')).toBe(false);
    u.theme = 'light';
    expect(u.isChangedBy('settings')).toBe(true);
  });
});
