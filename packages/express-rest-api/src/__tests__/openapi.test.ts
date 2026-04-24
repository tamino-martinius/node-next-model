import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../openapi.js';

const USER_RESOURCE = {
  name: 'User',
  pluralPath: 'users',
  basePath: '/api/users',
  fields: {
    id: { type: 'integer' as const },
    name: { type: 'string' as const },
    age: { type: 'integer' as const },
    role: { type: 'string' as const, enum: ['admin', 'member'] as const },
    createdAt: { type: 'datetime' as const },
    metadata: { type: 'json' as const, nullable: true },
  },
};

describe('buildOpenApiDocument', () => {
  it('emits a 3.1 document with info + servers + paths + schemas', () => {
    const doc = buildOpenApiDocument({
      title: 'NextModel Sample API',
      version: '1.0.0',
      servers: [{ url: 'http://localhost:3000' }],
      resources: [USER_RESOURCE],
    }) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toMatchObject({ title: 'NextModel Sample API', version: '1.0.0' });
    expect(doc.servers).toEqual([{ url: 'http://localhost:3000' }]);
    expect(doc.paths['/api/users']).toBeDefined();
    expect(doc.components.schemas.User).toBeDefined();
  });

  it('generates every default path for a resource', () => {
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [USER_RESOURCE],
    }) as any;
    const paths = Object.keys(doc.paths);
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/users/count');
    expect(paths).toContain('/api/users/first');
    expect(paths).toContain('/api/users/last');
    expect(paths).toContain('/api/users/{id}');
  });

  it('respects a restricted action set', () => {
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [{ ...USER_RESOURCE, actions: ['index', 'show'] }],
    }) as any;
    expect(doc.paths['/api/users'].get).toBeDefined();
    expect(doc.paths['/api/users'].post).toBeUndefined();
    expect(doc.paths['/api/users/{id}'].get).toBeDefined();
    expect(doc.paths['/api/users/{id}'].patch).toBeUndefined();
    expect(doc.paths['/api/users/count']).toBeUndefined();
  });

  it('generates a Create/Update/Filter input schema per resource', () => {
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [USER_RESOURCE],
    }) as any;
    const schemas = doc.components.schemas;
    expect(schemas.UserCreateInput).toBeDefined();
    expect(schemas.UserUpdateInput).toBeDefined();
    expect(schemas.UserFilterInput).toBeDefined();
    expect(schemas.UserList).toBeDefined();
  });

  it('propagates enum + format on field definitions', () => {
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [USER_RESOURCE],
    }) as any;
    const userSchema = doc.components.schemas.User;
    expect(userSchema.properties.role.enum).toEqual(['admin', 'member']);
    expect(userSchema.properties.createdAt.format).toBe('date-time');
    // Nullable fields widen the `type` tuple to include 'null'.
    expect(Array.isArray(userSchema.properties.metadata.type)).toBe(true);
    expect(userSchema.properties.metadata.type).toContain('null');
  });

  it('collects every Error response slot with the shared schema reference', () => {
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [USER_RESOURCE],
    }) as any;
    const responses = doc.paths['/api/users'].get.responses;
    for (const code of ['400', '401', '404', '422']) {
      expect(responses[code].content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/Error',
      });
    }
  });

  it('combines multiple resources into one document', () => {
    const postResource = {
      name: 'Post',
      pluralPath: 'posts',
      basePath: '/api/posts',
      fields: {
        id: { type: 'integer' as const },
        title: { type: 'string' as const },
        body: { type: 'text' as const },
      },
    };
    const doc = buildOpenApiDocument({
      title: 'x',
      version: '1',
      resources: [USER_RESOURCE, postResource],
    }) as any;
    expect(doc.paths['/api/users']).toBeDefined();
    expect(doc.paths['/api/posts']).toBeDefined();
    expect(doc.components.schemas.User).toBeDefined();
    expect(doc.components.schemas.Post).toBeDefined();
    expect(doc.tags.map((t: { name: string }) => t.name)).toEqual(['User', 'Post']);
  });
});
