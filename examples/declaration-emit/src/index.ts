/**
 * Acceptance test: downstream packages must be able to re-export
 * a class extending `Model({...})` and emit clean `.d.ts` declarations.
 *
 * Before the fix the build below would fail with:
 *   TS7056: The inferred type of this node exceeds the maximum length the
 *           compiler will serialize. An explicit type annotation is needed.
 *   TS2742 / TS2883: The inferred type of 'X' cannot be named without a
 *           reference to '@next-model/core/...'. This is likely not portable.
 *
 * Build this fixture with `tsc --emitDeclarationOnly --declaration true` and
 * make sure it succeeds.
 */
import { defineSchema, MemoryConnector, Model } from '@next-model/core';

const schema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
      age: { type: 'integer', null: true },
      role: { type: 'string' },
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' },
    },
    associations: {
      posts: { hasMany: 'posts', foreignKey: 'userId' },
    },
  },
  posts: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      title: { type: 'string' },
      body: { type: 'text', null: true },
      userId: { type: 'integer' },
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' },
    },
    associations: {
      author: { belongsTo: 'users', foreignKey: 'userId' },
    },
  },
});

export const connector = new MemoryConnector({ storage: {} }, { schema });

/**
 * Downstream re-export — extends a Model class produced by the factory and is
 * itself exported. This is the shape that previously broke `.d.ts` emission
 * because TS could not name the internal `CollectionQuery` / `InstanceQuery`
 * / `ColumnQuery` / `ScalarQuery` types referenced by the factory's
 * inferred return type.
 */
export class User extends Model({
  connector,
  tableName: 'users',
  scopes: {
    adults: { $gte: { age: 18 } } as const,
  },
  enums: {
    role: ['admin', 'user'] as const,
  },
}) {
  /** Domain method on the subclass to make sure subclass surface still works. */
  greet(): string {
    const attrs = this.attributes as { name: string };
    return `hi, I'm ${attrs.name}`;
  }
}

export class Post extends Model({
  connector,
  tableName: 'posts',
}) {}
