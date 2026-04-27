import { MemoryConnector, Model } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { buildModelResource } from '../index.js';

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

interface Ctx {
  role?: 'admin' | 'member';
}

function makeResource(
  connector: MemoryConnector = freshConnector(),
  options: Partial<Parameters<typeof buildModelResource<Ctx>>[0]> = {},
) {
  const User = buildUser(connector);
  const resource = buildModelResource<Ctx>({
    Model: User,
    name: 'User',
    fields: {
      id: { type: 'Int!' },
      name: { type: 'String!' },
      age: { type: 'Int!' },
      active: { type: 'Boolean!' },
    },
    ...options,
  });
  return { User, resource };
}

async function seed(User: ReturnType<typeof buildUser>) {
  await User.createMany([
    { name: 'Ada', age: 36, active: true },
    { name: 'Linus', age: 12, active: true },
    { name: 'Old', age: 99, active: false },
  ]);
}

const fakeInfo = {} as never;

async function call(
  fn: (...a: any[]) => any,
  args: Record<string, unknown> = {},
  context: Ctx = {},
) {
  return await fn(undefined, args, context, fakeInfo);
}

describe('buildModelResource — typeDefs', () => {
  it('contains output + input + filter + order + list types', () => {
    const { resource } = makeResource();
    expect(resource.typeDefs).toContain('type User {');
    expect(resource.typeDefs).toContain('input UserCreateInput');
    expect(resource.typeDefs).toContain('input UserUpdateInput');
    expect(resource.typeDefs).toContain('input UserFilterInput');
    expect(resource.typeDefs).toContain('input UserOrderInput');
    expect(resource.typeDefs).toContain('type UserList');
    expect(resource.typeDefs).toContain('extend type Query');
    expect(resource.typeDefs).toContain('extend type Mutation');
  });

  it('update input drops trailing `!` so every field is optional', () => {
    const { resource } = makeResource();
    const match = /input UserUpdateInput \{([\s\S]*?)\}/m.exec(resource.typeDefs);
    expect(match).not.toBeNull();
    const lines = match ? match[1] : '';
    expect(lines).not.toMatch(/:\s*\w+!/);
  });

  it('omits operations marked `false`', () => {
    const { resource } = makeResource(freshConnector(), {
      operations: { delete: false, create: false },
    });
    expect(resource.resolvers.Mutation.createUser).toBeUndefined();
    expect(resource.resolvers.Mutation.deleteUser).toBeUndefined();
    expect(resource.resolvers.Mutation.updateUser).toBeDefined();
  });
});

describe('buildModelResource — queries', () => {
  it('list resolver returns every record', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = (await call(resource.resolvers.Query.users)) as {
      items: UserShape[];
      meta: Record<string, unknown>;
    };
    expect(out.items).toHaveLength(3);
    expect(out.items.map((u) => u.name)).toEqual(['Ada', 'Linus', 'Old']);
  });

  it('list resolver applies filter + order', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = (await call(resource.resolvers.Query.users, {
      filter: { active: true },
      order: [{ key: 'age', dir: 'DESC' }],
    })) as { items: UserShape[] };
    expect(out.items.map((u) => u.name)).toEqual(['Ada', 'Linus']);
  });

  it('list resolver — offset pagination sets meta', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = (await call(resource.resolvers.Query.users, {
      page: 1,
      perPage: 2,
    })) as { items: UserShape[]; meta: Record<string, number> };
    expect(out.items).toHaveLength(2);
    expect(out.meta).toMatchObject({ page: 1, perPage: 2, total: 3, totalPages: 2 });
  });

  it('list resolver — cursor pagination sets nextCursor + hasMore', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const first = (await call(resource.resolvers.Query.users, { limit: 2, after: '' })) as {
      items: UserShape[];
      meta: { hasMore: boolean; nextCursor: string | null };
    };
    expect(first.items).toHaveLength(2);
    expect(first.meta.hasMore).toBe(true);
    expect(first.meta.nextCursor).toBeTruthy();
    const second = (await call(resource.resolvers.Query.users, {
      limit: 2,
      after: first.meta.nextCursor ?? '',
    })) as { items: UserShape[]; meta: { hasMore: boolean } };
    expect(second.items).toHaveLength(1);
    expect(second.meta.hasMore).toBe(false);
  });

  it('get resolver returns a single record', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = (await call(resource.resolvers.Query.user, { id: 2 })) as UserShape;
    expect(out.name).toBe('Linus');
  });

  it('get resolver returns null when missing', async () => {
    const { resource } = makeResource();
    const out = await call(resource.resolvers.Query.user, { id: 99 });
    expect(out).toBeNull();
  });

  it('count resolver respects filters', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = await call(resource.resolvers.Query.userCount, { filter: { name: 'Ada' } });
    expect(out).toBe(1);
  });
});

describe('buildModelResource — mutations', () => {
  it('create persists and returns', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    const out = (await call(resource.resolvers.Mutation.createUser, {
      input: { name: 'Grace', age: 85, active: true },
    })) as UserShape;
    expect(out.name).toBe('Grace');
    expect(await User.count()).toBe(1);
  });

  it('update mutates the record', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = (await call(resource.resolvers.Mutation.updateUser, {
      id: 1,
      input: { age: 37 },
    })) as UserShape;
    expect(out.age).toBe(37);
  });

  it('delete removes the record', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector);
    await seed(User);
    const out = await call(resource.resolvers.Mutation.deleteUser, { id: 1 });
    expect(out).toBe(true);
    expect(await User.count()).toBe(2);
  });

  it('update on missing id surfaces a GraphQLError with NOT_FOUND', async () => {
    const { resource } = makeResource();
    await expect(
      call(resource.resolvers.Mutation.updateUser, { id: 99, input: { age: 10 } }),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});

describe('buildModelResource — authorization', () => {
  it('global authorize false denies every resolver', async () => {
    const { resource } = makeResource(freshConnector(), { authorize: () => false });
    await expect(call(resource.resolvers.Query.users)).rejects.toMatchObject({
      extensions: { code: 'UNAUTHORIZED' },
    });
  });

  it('per-operation authorize can gate by context.role', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector, {
      operations: { delete: { authorize: (ctx) => ctx.context.role === 'admin' } },
    });
    await seed(User);
    await expect(
      call(resource.resolvers.Mutation.deleteUser, { id: 1 }, { role: 'member' }),
    ).rejects.toMatchObject({ extensions: { code: 'UNAUTHORIZED' } });
    const out = await call(resource.resolvers.Mutation.deleteUser, { id: 1 }, { role: 'admin' });
    expect(out).toBe(true);
    expect(await User.count()).toBe(2);
  });
});

describe('buildModelResource — serialize', () => {
  it('per-row serialize reshapes the response', async () => {
    const connector = freshConnector();
    const { User, resource } = makeResource(connector, {
      serialize: async (row) => {
        const attrs = (row as { attributes: UserShape }).attributes;
        return { ...attrs, name: attrs.name.toUpperCase() };
      },
    });
    await seed(User);
    const out = (await call(resource.resolvers.Query.user, { id: 1 })) as UserShape;
    expect(out.name).toBe('ADA');
  });
});
