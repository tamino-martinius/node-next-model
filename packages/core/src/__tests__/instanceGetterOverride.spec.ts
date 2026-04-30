import { describe, expect, it } from 'vitest';
import { Model } from '../Model.js';
import { defineSchema } from '../typedSchema.js';
import { MemoryConnector } from '../MemoryConnector.js';

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

    const got = await u.tasks.all();
    expect(got).toHaveLength(1);
    expect(getterCalls).toBeGreaterThan(0);
  });
});
