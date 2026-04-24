import { MemoryConnector, Model } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { createCollectionHandlers, createMemberHandlers } from '../index.js';

interface UserShape {
  id?: number;
  name: string;
  age: number;
  active: boolean;
}

function freshConnector(): MemoryConnector {
  return new MemoryConnector({ storage: {}, lastIds: {} });
}

function buildUser(connector: MemoryConnector) {
  return class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
    init: (props: UserShape) => props,
  }) {};
}

async function seed(User: ReturnType<typeof buildUser>) {
  await User.createMany([
    { name: 'Ada', age: 36, active: true },
    { name: 'Linus', age: 12, active: true },
    { name: 'Old', age: 99, active: false },
  ]);
}

function collectionReq(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

async function json(res: Response): Promise<any> {
  if (res.status === 204) return null;
  return await res.json();
}

describe('createCollectionHandlers', () => {
  it('GET /users returns every record', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const res = await GET(collectionReq('/api/users'));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.map((u: UserShape) => u.name)).toEqual(['Ada', 'Linus', 'Old']);
  });

  it('GET /users?filter=... filters', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const filter = encodeURIComponent(JSON.stringify({ active: true }));
    const res = await GET(collectionReq(`/api/users?filter=${filter}`));
    const body = await json(res);
    expect(body).toHaveLength(2);
  });

  it('GET /users?order=-age sorts descending', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const res = await GET(collectionReq('/api/users?order=-age'));
    const body = await json(res);
    expect(body.map((u: UserShape) => u.age)).toEqual([99, 36, 12]);
  });

  it('GET /users?page=1&perPage=2 wraps with meta', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const res = await GET(collectionReq('/api/users?page=1&perPage=2'));
    const body = await json(res);
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 1, perPage: 2, total: 3, totalPages: 2 });
  });

  it('GET /users?after= triggers cursor mode', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const first = await json(await GET(collectionReq('/api/users?limit=2&after=')));
    expect(first.data).toHaveLength(2);
    expect(first.meta.hasMore).toBe(true);
    const second = await json(
      await GET(
        collectionReq(`/api/users?limit=2&after=${encodeURIComponent(first.meta.nextCursor)}`),
      ),
    );
    expect(second.data).toHaveLength(1);
    expect(second.meta.hasMore).toBe(false);
  });

  it('GET /users/count returns filtered count', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User);
    const filter = encodeURIComponent(JSON.stringify({ name: 'Ada' }));
    const res = await GET(collectionReq(`/api/users/count?filter=${filter}`));
    expect(await json(res)).toEqual({ count: 1 });
  });

  it('POST /users creates a record', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    const { POST } = createCollectionHandlers(User);
    const res = await POST(
      collectionReq('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'Grace', age: 85, active: true }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('Grace');
    expect(await User.count()).toBe(1);
  });

  it('GET /users returns 400 on invalid filter JSON', async () => {
    const { GET } = createCollectionHandlers(buildUser(freshConnector()));
    const res = await GET(collectionReq('/api/users?filter=not-json'));
    expect(res.status).toBe(400);
  });

  it('disabled action returns 404', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    const { POST } = createCollectionHandlers(User, { actions: { create: false } });
    const res = await POST(
      collectionReq('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'x', age: 1, active: true }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('createMemberHandlers', () => {
  it('GET /:id returns the record', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createMemberHandlers(User);
    const res = await GET(collectionReq('/api/users/2'), { params: { id: '2' } });
    const body = await json(res);
    expect(body.name).toBe('Linus');
  });

  it('GET /:id supports promise-wrapped params (Next 15 style)', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createMemberHandlers(User);
    const res = await GET(collectionReq('/api/users/1'), { params: Promise.resolve({ id: '1' }) });
    expect((await json(res)).name).toBe('Ada');
  });

  it('GET /:id returns 404 when missing', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    const { GET } = createMemberHandlers(User);
    const res = await GET(collectionReq('/api/users/999'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id mutates the record', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { PATCH } = createMemberHandlers(User);
    const res = await PATCH(
      collectionReq('/api/users/1', {
        method: 'PATCH',
        body: JSON.stringify({ age: 37 }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: '1' } },
    );
    expect(res.status).toBe(200);
    const reloaded = await User.find(1);
    expect((reloaded as unknown as UserShape).age).toBe(37);
  });

  it('DELETE /:id returns 204', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { DELETE } = createMemberHandlers(User);
    const res = await DELETE(collectionReq('/api/users/1', { method: 'DELETE' }), {
      params: { id: '1' },
    });
    expect(res.status).toBe(204);
    expect(await User.count()).toBe(2);
  });
});

describe('authorization + mapping', () => {
  it('global authorize denies every action', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User, { authorize: () => false });
    const res = await GET(collectionReq('/api/users'));
    expect(res.status).toBe(401);
  });

  it('per-action authorize gates delete by a header', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { DELETE } = createMemberHandlers(User, {
      actions: {
        delete: { authorize: ({ req }) => req.headers.get('x-admin') === '1' },
      },
    });
    const denied = await DELETE(collectionReq('/api/users/1', { method: 'DELETE' }), {
      params: { id: '1' },
    });
    expect(denied.status).toBe(401);
    const allowed = await DELETE(
      collectionReq('/api/users/1', { method: 'DELETE', headers: { 'x-admin': '1' } }),
      { params: { id: '1' } },
    );
    expect(allowed.status).toBe(204);
  });

  it('per-row serialize is applied', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createMemberHandlers(User, {
      serialize: (row: UserShape) => ({ id: row.id, shout: row.name.toUpperCase() }),
    });
    const res = await GET(collectionReq('/api/users/1'), { params: { id: '1' } });
    expect(await json(res)).toEqual({ id: 1, shout: 'ADA' });
  });

  it('envelope wraps every response', async () => {
    const connector = freshConnector();
    const User = buildUser(connector);
    await seed(User);
    const { GET } = createCollectionHandlers(User, {
      envelope: ({ action, data, meta }) => ({ action, data, meta }),
    });
    const body = await json(await GET(collectionReq('/api/users')));
    expect(body.action).toBe('index');
    expect(Array.isArray(body.data)).toBe(true);
  });
});
