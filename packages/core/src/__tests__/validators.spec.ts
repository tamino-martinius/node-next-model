import {
  defineSchema,
  MemoryConnector,
  Model,
  type Storage,
  ValidationError,
  validateConfirmation,
  validateExclusion,
  validateFormat,
  validateInclusion,
  validateLength,
  validateNumericality,
  validatePresence,
  validateUniqueness,
} from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string', default: '' },
      code: { type: 'string', default: '' },
      email: { type: 'string', null: true, default: null },
      password: { type: 'string', default: '' },
      tenantId: { type: 'integer', default: 0 },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      role: { type: 'string', default: 'user' },
      username: { type: 'string', default: '' },
    },
  },
  rows: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string', default: '' },
      code: { type: 'string', default: '' },
      age: { type: 'integer', null: true, default: null },
      count: { type: 'integer', null: true, default: null },
      draft: { type: 'boolean', default: false },
    },
  },
});

describe('validator registry', () => {
  let storage: Storage = {};
  const connector = () => new MemoryConnector({ storage }, { schema });

  afterEach(() => {
    storage = {};
  });

  describe('validatePresence', () => {
    it('flags blank values', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validatePresence(['name', 'email'])],
      });
      const u = User.build({});
      expect(await u.isValid()).toBe(false);
      expect(u.errors.on('name')).toEqual(['cannot be blank']);
      expect(u.errors.on('email')).toEqual(['cannot be blank']);
      expect(u.errors.full()).toEqual(['name cannot be blank', 'email cannot be blank']);
    });

    it('passes when every key is present', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validatePresence('name')],
      });
      const u = User.build({ name: 'a' });
      expect(await u.isValid()).toBe(true);
      expect(u.errors.any()).toBe(false);
    });
  });

  describe('validateFormat', () => {
    it('rejects values that do not match', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateFormat('email', { with: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })],
      });
      const u = User.build({ email: 'not-an-email' });
      expect(await u.isValid()).toBe(false);
      expect(u.errors.on('email')).toEqual(['is invalid']);
    });

    it('allowNull skips null/undefined', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateFormat('email', { with: /@/, allowNull: true })],
      });
      const u = User.build({ email: null });
      expect(await u.isValid()).toBe(true);
    });
  });

  describe('validateLength', () => {
    it('reports min / max / is violations', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateLength('name', { min: 3, max: 5 }), validateLength('code', { is: 4 })],
      });
      const tooShort = User.build({ name: 'a', code: '123' });
      expect(await tooShort.isValid()).toBe(false);
      expect(tooShort.errors.on('name')).toEqual(['is too short (minimum 3)']);
      expect(tooShort.errors.on('code')).toEqual(['is the wrong length (should be 4)']);

      const tooLong = User.build({ name: 'abcdef', code: '1234' });
      expect(await tooLong.isValid()).toBe(false);
      expect(tooLong.errors.on('name')).toEqual(['is too long (maximum 5)']);

      const ok = User.build({ name: 'abc', code: '1234' });
      expect(await ok.isValid()).toBe(true);
    });
  });

  describe('validateInclusion / validateExclusion', () => {
    it('flags values outside / inside the list', async () => {
      const Post = Model({
        tableName: 'posts',
        connector: connector(),
        validators: [
          validateInclusion('role', ['admin', 'user', 'guest']),
          validateExclusion('username', ['admin', 'root']),
        ],
      });
      const bad = Post.build({ role: 'nope', username: 'admin' });
      expect(await bad.isValid()).toBe(false);
      expect(bad.errors.on('role')).toEqual(['is not included in the list']);
      expect(bad.errors.on('username')).toEqual(['is reserved']);
      const ok = Post.build({ role: 'user', username: 'alice' });
      expect(await ok.isValid()).toBe(true);
    });
  });

  describe('validateNumericality', () => {
    it('catches non-numbers and range violations', async () => {
      const Row = Model({
        tableName: 'rows',
        connector: connector(),
        validators: [
          validateNumericality('age', { integer: true, min: 0, max: 120, allowNull: true }),
          validateNumericality('count', { greaterThan: 0, allowNull: true }),
        ],
      });
      const nonNum = Row.build({ age: 'abc', count: 0 });
      expect(await nonNum.isValid()).toBe(false);
      expect(nonNum.errors.on('age')).toEqual(['is not a number']);
      expect(nonNum.errors.on('count')).toEqual(['must be greater than 0']);

      const outOfRange = Row.build({ age: 121, count: 5 });
      expect(await outOfRange.isValid()).toBe(false);
      expect(outOfRange.errors.on('age')).toContain('must be less than or equal to 120');

      const ok = Row.build({ age: 30, count: 5 });
      expect(await ok.isValid()).toBe(true);
    });
  });

  describe('validateConfirmation', () => {
    it('fails when the *Confirmation attribute differs', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateConfirmation('password')],
      });
      const u: any = User.build({ password: 'abc' });
      u.passwordConfirmation = 'xyz';
      expect(await u.isValid()).toBe(false);
      expect(u.errors.on('passwordConfirmation')).toEqual(['does not match confirmation']);
      u.passwordConfirmation = 'abc';
      expect(await u.isValid()).toBe(true);
    });
  });

  describe('validateUniqueness', () => {
    it('fails when another row already has the value', async () => {
      storage = {
        users: [
          { id: 1, email: 'a@a.com' },
          { id: 2, email: 'b@b.com' },
        ],
      };
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateUniqueness('email')],
      });
      const dup = User.build({ email: 'a@a.com' });
      expect(await dup.isValid()).toBe(false);
      expect(dup.errors.on('email')).toEqual(['has already been taken']);
    });

    it('excludes the record itself on update', async () => {
      storage = { users: [{ id: 1, email: 'a@a.com' }] };
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateUniqueness('email')],
      });
      const existing = await User.find(1);
      expect(await existing!.isValid()).toBe(true);
    });

    it('respects the scope option', async () => {
      storage = {
        users: [
          { id: 1, email: 'a@a.com', tenantId: 1 },
          { id: 2, email: 'a@a.com', tenantId: 2 },
        ],
      };
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validateUniqueness('email', { scope: ['tenantId'] })],
      });
      const newInTenant1 = User.build({ email: 'a@a.com', tenantId: 1 });
      expect(await newInTenant1.isValid()).toBe(false);
      const newInTenant3 = User.build({ email: 'a@a.com', tenantId: 3 });
      expect(await newInTenant3.isValid()).toBe(true);
    });
  });

  describe('conditional if/unless + message overrides', () => {
    it('skips when if returns false', async () => {
      const Row = Model({
        tableName: 'rows',
        connector: connector(),
        validators: [validatePresence('name', { unless: (r: any) => r.draft })],
      });
      const draft = Row.build({ name: '', draft: true });
      expect(await draft.isValid()).toBe(true);
      const final = Row.build({ name: '', draft: false });
      expect(await final.isValid()).toBe(false);
    });

    it('honours custom message', async () => {
      const Row = Model({
        tableName: 'rows',
        connector: connector(),
        validators: [validatePresence('name', { message: 'is required' })],
      });
      const r = Row.build({});
      expect(await r.isValid()).toBe(false);
      expect(r.errors.on('name')).toEqual(['is required']);
    });
  });

  describe('mixed factory + function-form validators', () => {
    it('runs both and collects per-key errors for factory-form', async () => {
      const Row = Model({
        tableName: 'rows',
        connector: connector(),
        validators: [validatePresence('name'), (r: any) => r.name !== 'banned'],
      });
      const a = Row.build({ name: '' });
      expect(await a.isValid()).toBe(false);
      const b = Row.build({ name: 'banned' });
      expect(await b.isValid()).toBe(false);
      const c = Row.build({ name: 'ok' });
      expect(await c.isValid()).toBe(true);
    });
  });

  describe('ValidationError carries structured errors', () => {
    it('throws ValidationError whose .errors contains the collected payload', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validatePresence(['name', 'email'])],
      });
      const u = User.build({});
      let thrown: ValidationError | undefined;
      try {
        await u.save();
      } catch (e) {
        thrown = e as ValidationError;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect(thrown?.errors).toEqual({
        name: ['cannot be blank'],
        email: ['cannot be blank'],
      });
    });

    it('the thrown error message includes every offending field name', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validatePresence(['name', 'email'])],
      });
      await expect(User.create({} as any)).rejects.toThrow(/name/);
      await expect(User.create({} as any)).rejects.toThrow(/email/);
    });

    it('the thrown error message follows "Validation failed: <field>: <reason>" form', async () => {
      const User = Model({
        tableName: 'users',
        connector: connector(),
        validators: [validatePresence(['name'])],
      });
      let thrown: ValidationError | undefined;
      try {
        await User.create({} as any);
      } catch (e) {
        thrown = e as ValidationError;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect(thrown?.message).toMatch(/^Validation failed:.*name:/);
      expect(thrown?.message).toContain('cannot be blank');
    });

    it('accepts the single-argument shape (errors only)', () => {
      const e = new ValidationError({ name: ['cannot be blank'] });
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.errors).toEqual({ name: ['cannot be blank'] });
      expect(e.message).toMatch(/Validation failed/);
      expect(e.message).toMatch(/name/);
    });

    it('preserves the plain string message when no error map is supplied', () => {
      const e = new ValidationError('something custom');
      expect(e.message).toBe('something custom');
      expect(e.errors).toBeUndefined();
    });

    it('joins multiple reasons per field with a comma', () => {
      const e = new ValidationError({
        name: ['cannot be blank', 'must be at least 3 characters'],
      });
      expect(e.message).toContain('name: cannot be blank, must be at least 3 characters');
    });
  });

  describe('Errors utility', () => {
    it('add / on / any / count / clear / toJSON / full', async () => {
      const Row = Model({
        tableName: 'rows',
        connector: connector(),
        validators: [validatePresence('name')],
      });
      const r = Row.build({});
      await r.isValid();
      expect(r.errors.any()).toBe(true);
      expect(r.errors.count()).toBe(1);
      expect(r.errors.on('name')).toEqual(['cannot be blank']);
      expect(r.errors.on('missing')).toEqual([]);
      expect(r.errors.toJSON()).toEqual({ name: ['cannot be blank'] });
      expect(r.errors.full()).toEqual(['name cannot be blank']);
      r.errors.clear();
      expect(r.errors.any()).toBe(false);
    });
  });
});
