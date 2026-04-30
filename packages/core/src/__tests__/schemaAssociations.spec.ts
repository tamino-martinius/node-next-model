import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineSchema, type DatabaseSchema } from '../typedSchema.js';

describe('TypedAssociation — schema can carry associations', () => {
  it('compiles when a table declares associations', () => {
    const schema = defineSchema({
      users: {
        columns: { id: { type: 'integer', primary: true } },
        associations: {
          tasks: { hasMany: 'tasks', foreignKey: 'userId' },
        },
      },
      tasks: {
        columns: {
          id: { type: 'integer', primary: true },
          userId: { type: 'integer' },
        },
        associations: {
          user: { belongsTo: 'users', foreignKey: 'userId' },
        },
      },
    });

    // Schema is generic so the literal types are preserved
    expectTypeOf(schema).toMatchTypeOf<DatabaseSchema<any>>();

    // Runtime carries associations on tableDefinitions
    expect(schema.tableDefinitions.users.associations).toEqual({
      tasks: { hasMany: 'tasks', foreignKey: 'userId' },
    });
    expect(schema.tableDefinitions.tasks.associations).toEqual({
      user: { belongsTo: 'users', foreignKey: 'userId' },
    });
  });
});
