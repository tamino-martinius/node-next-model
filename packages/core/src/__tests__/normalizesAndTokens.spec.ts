import { generateSecureToken, KeyType, MemoryConnector, Model, type Storage } from '../index.js';

describe('normalizes', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage });

  function makeUser() {
    return Model({
      tableName: 'users',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { email?: string; phone?: string }) => ({
        email: p.email ?? '',
        phone: p.phone ?? '',
      }),
      normalizes: {
        email: (v: any) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
        phone: (v: any) => (typeof v === 'string' ? v.replace(/\D/g, '') : v),
      },
    });
  }

  beforeEach(() => {
    storage = { users: [] };
  });

  afterEach(() => {
    storage = {};
  });

  it('runs normalizers on assign() (and the property setter)', async () => {
    const User = makeUser();
    const u: any = User.build({});
    u.email = '  Foo@BAR.com\n';
    u.phone = '+1 (555) 123-4567';
    expect(u.email).toBe('foo@bar.com');
    expect(u.phone).toBe('15551234567');
  });

  it('writing through the setter normalizes (build() leaves init output untouched)', async () => {
    const User = makeUser();
    const u: any = User.build({ email: '  ALICE@EXAMPLE.com ' });
    // build() stores whatever init returned untouched — the setter is what
    // runs the normalizer. Re-assigning the raw value triggers it.
    const raw = u.email;
    u.email = raw;
    expect(u.email).toBe('alice@example.com');
  });

  it('runs normalizers on update()', async () => {
    const User = makeUser();
    storage.users = [{ id: 1, email: 'old@old.com', phone: '' }];
    const u: any = await User.find(1);
    await u.update({ email: '  NEW@NEW.com ' });
    expect(u.email).toBe('new@new.com');
    expect(storage.users[0].email).toBe('new@new.com');
  });

  it('skips columns without a registered normalizer', async () => {
    const User = Model({
      tableName: 'users',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { email?: string; bio?: string }) => ({ email: p.email ?? '', bio: p.bio ?? '' }),
      normalizes: { email: (v: any) => (typeof v === 'string' ? v.trim().toLowerCase() : v) },
    });
    const u: any = User.build({});
    u.email = '  X@X.COM ';
    u.bio = '  RAW  ';
    expect(u.email).toBe('x@x.com');
    expect(u.bio).toBe('  RAW  ');
  });
});

describe('secureTokens', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage });

  beforeEach(() => {
    storage = { invites: [] };
  });

  afterEach(() => {
    storage = {};
  });

  it('auto-fills the column on insert when blank', async () => {
    const Invite = Model({
      tableName: 'invites',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { token?: string; email?: string }) => ({
        token: p.token ?? '',
        email: p.email ?? '',
      }),
      secureTokens: ['token'],
    });
    const created = (await Invite.create({ email: 'a@a.com' })) as any;
    expect(typeof created.token).toBe('string');
    expect(created.token.length).toBeGreaterThan(0);
    expect(storage.invites[0].token).toBe(created.token);
  });

  it('respects per-column length option', async () => {
    const Invite = Model({
      tableName: 'invites',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { token?: string }) => ({ token: p.token ?? '' }),
      secureTokens: { token: { length: 6 } },
    });
    const created = (await Invite.create({})) as any;
    // base64url of 6 bytes is 8 chars
    expect(created.token.length).toBe(8);
  });

  it('does not overwrite an explicitly provided value', async () => {
    const Invite = Model({
      tableName: 'invites',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { token?: string }) => ({ token: p.token ?? '' }),
      secureTokens: ['token'],
    });
    const created = (await Invite.create({ token: 'manual' })) as any;
    expect(created.token).toBe('manual');
  });

  it('generates unique tokens across rows', async () => {
    const Invite = Model({
      tableName: 'invites',
      connector: connector(),
      keys: { id: KeyType.number },
      init: (p: { token?: string }) => ({ token: p.token ?? '' }),
      secureTokens: ['token'],
    });
    const a = (await Invite.create({})) as any;
    const b = (await Invite.create({})) as any;
    expect(a.token).not.toBe(b.token);
  });

  describe('generateSecureToken (exported helper)', () => {
    it('returns a base64url string of the requested byte length', () => {
      const tok = generateSecureToken(12);
      // base64url of 12 bytes is 16 chars (no padding)
      expect(tok).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(tok.length).toBe(16);
    });

    it('defaults to 24 bytes', () => {
      const tok = generateSecureToken();
      expect(tok.length).toBe(32);
    });
  });
});
