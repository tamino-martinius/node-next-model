import { describe, expect, it } from 'vitest';
import { MemoryConnector } from '../MemoryConnector.js';
import { Model } from '../Model.js';
import { defineSchema } from '../typedSchema.js';

describe('class getter overrides the auto-accessor', () => {
  const schema = defineSchema({
    users: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        name: { type: 'string' },
      },
      associations: {
        tasks: { hasMany: 'tasks', foreignKey: 'userId' },
      },
    },
    tasks: {
      columns: {
        id: { type: 'integer', primary: true, autoIncrement: true },
        userId: { type: 'integer' },
        title: { type: 'string' },
      },
      associations: {
        user: { belongsTo: 'users', foreignKey: 'userId' },
      },
    },
  });

  it('runs the class getter when one is defined', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });

    class Task extends Model({ connector, tableName: 'tasks', timestamps: false }) {}

    let getterCalls = 0;
    class User extends Model({ connector, tableName: 'users', timestamps: false }) {
      get tasks() {
        getterCalls += 1;
        return this.hasMany(Task, { foreignKey: 'userId' });
      }
    }

    const u = await User.create({ name: 'Ada' });
    await Task.create({ userId: u.id, title: 'walk' });

    // The fix's invariant: when a class getter exists on the prototype, the
    // auto-accessor must NOT install an own-property on the instance (which
    // would shadow the getter).
    expect(Object.getOwnPropertyDescriptor(u, 'tasks')).toBeUndefined();

    const got = await u.tasks.all();
    expect(got).toHaveLength(1);
    expect(getterCalls).toBeGreaterThan(0);
  });

  it('runs the class getter for belongsTo associations too', async () => {
    const connector = new MemoryConnector({ storage: {} }, { schema });

    class User extends Model({ connector, tableName: 'users', timestamps: false }) {}

    let getterCalls = 0;
    class Task extends Model({ connector, tableName: 'tasks', timestamps: false }) {
      get user() {
        getterCalls += 1;
        return this.belongsTo(User, { foreignKey: 'userId' });
      }
    }

    const ada = await User.create({ name: 'Ada' });
    const t = await Task.create({ userId: ada.id, title: 'walk' });

    expect(Object.getOwnPropertyDescriptor(t, 'user')).toBeUndefined();

    const owner = await t.user;
    expect(owner?.name).toBe('Ada');
    expect(getterCalls).toBeGreaterThan(0);
  });
});
