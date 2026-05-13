import { defineSchema, MemoryConnector, Model } from '@next-model/core';
import { describe, expect, it } from 'vitest';

import { buildModelResource, composeSchema } from '../index.js';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      userId: { type: 'integer' },
    },
  },
});

function buildUser(connector: MemoryConnector) {
  return class User extends Model({
    tableName: 'users',
    connector,
    timestamps: false,
  }) {};
}

function buildPost(connector: MemoryConnector) {
  return class Post extends Model({
    tableName: 'posts',
    connector,
    timestamps: false,
  }) {};
}

describe('composeSchema', () => {
  it('merges typeDefs + resolver maps from multiple resources', () => {
    const connector = new MemoryConnector({ storage: {}, lastIds: {} }, { schema });
    const userResource = buildModelResource({
      Model: buildUser(connector),
      name: 'User',
      fields: { id: { type: 'Int!' }, name: { type: 'String!' } },
    });
    const postResource = buildModelResource({
      Model: buildPost(connector),
      name: 'Post',
      fields: {
        id: { type: 'Int!' },
        title: { type: 'String!' },
        userId: { type: 'Int!' },
      },
    });
    const { typeDefs, resolvers } = composeSchema([userResource, postResource]);
    expect(typeDefs).toContain('type User {');
    expect(typeDefs).toContain('type Post {');
    expect(typeDefs).toContain('type Query {');
    expect(typeDefs).toContain('type Mutation {');
    expect(resolvers.Query.users).toBeDefined();
    expect(resolvers.Query.posts).toBeDefined();
    expect(resolvers.Mutation.createUser).toBeDefined();
    expect(resolvers.Mutation.createPost).toBeDefined();
  });

  it('composeSchema with empty list still emits root stubs', () => {
    const { typeDefs, resolvers } = composeSchema([]);
    expect(typeDefs).toContain('type Query {');
    expect(typeDefs).toContain('type Mutation {');
    expect(Object.keys(resolvers.Query)).toHaveLength(0);
  });
});
