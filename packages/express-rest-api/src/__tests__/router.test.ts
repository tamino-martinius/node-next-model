import { defineSchema, MemoryConnector, Model } from '@next-model/core';
import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRestRouter } from '../index.js';

interface UserShape {
  id?: number;
  name: string;
  age: number;
  active: boolean;
}

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer' },
      active: { type: 'boolean' },
    },
  },
  strict_users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
});

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
}

function buildUser(connector: MemoryConnector) {
  return class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
  }) {};
}

function makeApp(connector: MemoryConnector = freshConnector(), opts = {}) {
  const User = buildUser(connector);
  const app = express();
  // `extended` lets qs parse `?filter[name]=Ada` as `{ filter: { name: 'Ada' } }`.
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use('/users', createRestRouter(User, opts));
  return { app, User, connector };
}

async function seedUsers(User: ReturnType<typeof buildUser>) {
  await User.createMany([
    { name: 'Ada', age: 36, active: true },
    { name: 'Linus', age: 12, active: true },
    { name: 'Old', age: 99, active: false },
  ]);
}

describe('createRestRouter — index', () => {
  it('returns every record as an array', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((u: UserShape) => u.name)).toEqual(['Ada', 'Linus', 'Old']);
  });

  it('honours filter query (JSON form)', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const filter = encodeURIComponent(JSON.stringify({ active: true }));
    const res = await request(app).get(`/users?filter=${filter}`);
    expect(res.status).toBe(200);
    expect(res.body.map((u: UserShape) => u.name)).toEqual(['Ada', 'Linus']);
  });

  it('honours filter query (bracket form)', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    // Bracket-form query strings come through as strings; filter against the
    // string `name` field so the comparison doesn't depend on coercion.
    const res = await request(app)
      .get('/users')
      .query({ filter: { name: 'Ada' } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Ada');
  });

  it('returns 400 on invalid filter JSON', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).get('/users?filter=not-json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BadRequestError');
  });

  it('supports order query with descending prefix', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).get('/users?order=-age');
    expect(res.body.map((u: UserShape) => u.age)).toEqual([99, 36, 12]);
  });

  it('applies offset pagination envelope', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).get('/users?page=1&perPage=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, perPage: 2, total: 3, totalPages: 2 });
  });

  it('applies cursor pagination envelope', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const first = await request(app).get('/users?limit=2&after=');
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta.hasMore).toBe(true);
    const next = await request(app).get(
      `/users?limit=2&after=${encodeURIComponent(first.body.meta.nextCursor)}`,
    );
    expect(next.body.data).toHaveLength(1);
    expect(next.body.meta.hasMore).toBe(false);
  });

  it('clamps limit to maxLimit', async () => {
    const { app, User } = makeApp(freshConnector(), { maxLimit: 2 });
    await seedUsers(User);
    const res = await request(app).get('/users?limit=50');
    expect(res.body).toHaveLength(2);
  });
});

describe('createRestRouter — member actions', () => {
  it('show returns a single record', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).get('/users/2');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Linus');
  });

  it('show returns 404 when record missing', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/users/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFoundError');
  });

  it('update mutates the record', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).patch('/users/1').send({ age: 37 });
    expect(res.status).toBe(200);
    expect(res.body.age).toBe(37);
    const reloaded = await User.find(1);
    expect((reloaded as unknown as UserShape).age).toBe(37);
  });

  it('delete returns 204 and removes the record', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(204);
    expect(await User.count()).toBe(2);
  });
});

describe('createRestRouter — create', () => {
  it('create returns 201 with the persisted record', async () => {
    const { app, User } = makeApp();
    const res = await request(app).post('/users').send({ name: 'Grace', age: 85, active: true });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Grace');
    expect(await User.count()).toBe(1);
  });
});

describe('createRestRouter — aggregates', () => {
  it('count respects filters', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const res = await request(app)
      .get('/users/count')
      .query({ filter: { name: 'Ada' } });
    expect(res.body).toEqual({ count: 1 });
  });

  it('first + last', async () => {
    const { app, User } = makeApp();
    await seedUsers(User);
    const first = await request(app).get('/users/first');
    const last = await request(app).get('/users/last');
    expect(first.body.name).toBe('Ada');
    expect(last.body.name).toBe('Old');
  });

  it('first returns null envelope when empty', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/users/first');
    expect(res.body).toBeNull();
  });
});

describe('createRestRouter — authorization', () => {
  it('global authorize blocks every action', async () => {
    const connector = freshConnector();
    const { app } = makeApp(connector, { authorize: () => false });
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('per-action authorize blocks only that action', async () => {
    const connector = freshConnector();
    const { app, User } = makeApp(connector, {
      actions: { delete: { authorize: (ctx: { req: Request }) => ctx.req.get('x-admin') === '1' } },
    });
    await seedUsers(User);
    const reader = await request(app).get('/users');
    expect(reader.status).toBe(200);
    const forbidden = await request(app).delete('/users/1');
    expect(forbidden.status).toBe(401);
    const allowed = await request(app).delete('/users/1').set('x-admin', '1');
    expect(allowed.status).toBe(204);
  });

  it('opting out of an action via `false` yields 404 from express', async () => {
    const connector = freshConnector();
    const { app, User } = makeApp(connector, { actions: { delete: false } });
    await seedUsers(User);
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(404);
    expect(await User.count()).toBe(3);
  });
});

describe('createRestRouter — response mapping', () => {
  it('per-row serialize is applied', async () => {
    const connector = freshConnector();
    const { app, User } = makeApp(connector, {
      serialize: (row: UserShape) => ({ id: row.id, shout: row.name.toUpperCase() }),
    });
    await seedUsers(User);
    const res = await request(app).get('/users/1');
    expect(res.body).toEqual({ id: 1, shout: 'ADA' });
  });

  it('envelope wraps responses consistently', async () => {
    const connector = freshConnector();
    const { app, User } = makeApp(connector, {
      envelope: ({ data, meta, action }: { data: unknown; meta?: unknown; action: string }) => ({
        action,
        data,
        meta,
      }),
    });
    await seedUsers(User);
    const res = await request(app).get('/users');
    expect(res.body.action).toBe('index');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('before hook runs after authorize and can see the resolved context', async () => {
    const connector = freshConnector();
    let seenAction = '';
    let seenUrl = '';
    const { app, User } = makeApp(connector, {
      actions: {
        index: {
          authorize: () => true,
          before: (ctx: { action: string; req: Request }) => {
            seenAction = ctx.action;
            seenUrl = ctx.req.originalUrl;
          },
        },
      },
    });
    await seedUsers(User);
    const res = await request(app).get('/users');
    expect(seenAction).toBe('index');
    expect(seenUrl).toBe('/users');
    expect(res.body).toHaveLength(3);
  });
});

describe('createRestRouter — validation errors', () => {
  beforeEach(() => {});

  it('maps ValidationError to 422', async () => {
    const connector = freshConnector();
    class StrictUser extends Model({
      tableName: 'strict_users',
      connector,
      timestamps: false,
      validators: [
        (instance) => {
          const name = (instance.attributes as { name: string }).name;
          return typeof name === 'string' && name.length >= 2;
        },
      ],
    }) {}
    const app = express();
    app.use(express.json());
    app.use('/users', createRestRouter(StrictUser));
    const res = await request(app).post('/users').send({ name: 'A' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ValidationError');
  });
});
