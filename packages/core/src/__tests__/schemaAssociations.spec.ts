import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineSchema,
  type DatabaseSchema,
  type SchemaAssociationProp,
  type SchemaAssociations,
  type SchemaProps,
} from '../typedSchema.js';
import type { CollectionQuery } from '../query/CollectionQuery.js';
import type { InstanceQuery } from '../query/InstanceQuery.js';
import { Model } from '../Model.js';
import { MemoryConnector } from '../MemoryConnector.js';

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

const userTaskSchema = defineSchema({
  users: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      name: { type: 'string' },
    },
    associations: { tasks: { hasMany: 'tasks', foreignKey: 'userId' } },
  },
  tasks: {
    columns: {
      id: { type: 'integer', primary: true, autoIncrement: true },
      userId: { type: 'integer' },
      title: { type: 'string' },
    },
    associations: { user: { belongsTo: 'users', foreignKey: 'userId' } },
  },
});

type S = typeof userTaskSchema;
type UserRow = SchemaProps<S, 'users'>;
type TaskRow = SchemaProps<S, 'tasks'>;

describe('SchemaAssociations — accessor types (no registry)', () => {
  it('hasMany maps to CollectionQuery of target row shape', () => {
    type UserAssoc = SchemaAssociations<S, 'users'>;
    expectTypeOf<UserAssoc['tasks']>().toEqualTypeOf<CollectionQuery<TaskRow[]>>();
  });

  it('belongsTo maps to InstanceQuery of target row shape | undefined', () => {
    type TaskAssoc = SchemaAssociations<S, 'tasks'>;
    expectTypeOf<TaskAssoc['user']>().toEqualTypeOf<InstanceQuery<UserRow | undefined>>();
  });

  it('a single accessor type is exported via SchemaAssociationProp', () => {
    expectTypeOf<SchemaAssociationProp<S, 'users', 'tasks'>>().toEqualTypeOf<
      CollectionQuery<TaskRow[]>
    >();
  });
});

describe('ModelRegistry — augmentation upgrades accessors to class instance types', () => {
  // Synthetic class-shaped types (would normally come from `class User extends Model(...)`)
  class _UserClass {
    id!: number;
    name!: string;
    fullGreeting() {
      return `Hi, ${this.name}`;
    }
  }
  class _TaskClass {
    id!: number;
    userId!: number;
    title!: string;
    isOverdue() {
      return false;
    }
  }

  // Local registry augmentation — works because `ModelRegistry` is open via
  // declaration merging. In real apps this lives in a single `models/index.ts`
  // file that imports `type` only from each model file.
  // (We use a sub-namespace to avoid leaking into other test files.)
  type LocalRegistry = { users: _UserClass; tasks: _TaskClass };

  it('with the registry, hasMany returns the registered class instance type', () => {
    type Mapped = SchemaAssociationProp<S, 'users', 'tasks', LocalRegistry>;
    expectTypeOf<Mapped>().toEqualTypeOf<CollectionQuery<_TaskClass[]>>();
  });

  it('with the registry, belongsTo returns the registered class instance type | undefined', () => {
    type Mapped = SchemaAssociationProp<S, 'tasks', 'user', LocalRegistry>;
    expectTypeOf<Mapped>().toEqualTypeOf<InstanceQuery<_UserClass | undefined>>();
  });

  it('without the registry, accessor falls back to row shape', () => {
    type Mapped = SchemaAssociationProp<S, 'users', 'tasks'>;
    expectTypeOf<Mapped>().toEqualTypeOf<CollectionQuery<TaskRow[]>>();
  });
});

describe('Model({ connector, tableName }) — instance accessors are typed', () => {
  it('user.tasks is typed as CollectionQuery<TaskRow[]> (no registry)', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: userTaskSchema });
    class User extends Model({ connector, tableName: 'users' }) {}
    class Task extends Model({ connector, tableName: 'tasks' }) {}

    const user = await User.create({ name: 'Ada' });
    expectTypeOf(user.tasks).toEqualTypeOf<CollectionQuery<TaskRow[]>>();

    const task = await Task.create({ userId: 1, title: 't' });
    expectTypeOf(task.user).toEqualTypeOf<InstanceQuery<UserRow | undefined>>();
  });

  it('rejects unknown association names at .includes() / .joins() / .whereMissing()', () => {
    // Type-only test. The body is intentionally never invoked — TypeScript still
    // type-checks it, and `@ts-expect-error` annotations are still validated.
    // We don't run it at runtime because Task 4 wires the runtime auto-accessor;
    // until then `User.includes('tasks')` throws PersistenceError.
    const _typeAssertions = () => {
      const connector = new MemoryConnector({ storage: {} }, { schema: userTaskSchema });
      class User extends Model({ connector, tableName: 'users' }) {}
      User.includes('tasks');
      User.joins('tasks');
      User.whereMissing('tasks');
      // @ts-expect-error 'orders' is not declared on users.associations
      User.includes('orders');
      // @ts-expect-error 'orders' is not declared on users.associations
      User.joins('orders');
      // @ts-expect-error 'orders' is not declared on users.associations
      User.whereMissing('orders');
    };
    void _typeAssertions;
  });
});

describe('Model({ connector, tableName }) — runtime end-to-end', () => {
  it('user.tasks resolves to a CollectionQuery and loads the rows', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: userTaskSchema });
    class User extends Model({ connector, tableName: 'users' }) {}
    class Task extends Model({ connector, tableName: 'tasks' }) {}

    const ada = await User.create({ name: 'Ada' });
    await Task.create({ userId: ada.id, title: 'walk' });
    await Task.create({ userId: ada.id, title: 'run' });

    const tasks = await ada.tasks.all();
    expect(tasks.map((t) => t.title).sort()).toEqual(['run', 'walk']);
  });

  it('task.user resolves to the parent User row', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema: userTaskSchema });
    class User extends Model({ connector, tableName: 'users' }) {}
    class Task extends Model({ connector, tableName: 'tasks' }) {}

    const ada = await User.create({ name: 'Ada' });
    const t = await Task.create({ userId: ada.id, title: 'walk' });

    const owner = await t.user;
    expect(owner?.name).toBe('Ada');
  });
});
