import { describe, expect, it } from 'vitest';
import { ModelClass } from '../Model.js';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { InstanceQuery } from '../query/InstanceQuery.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
  static associations = {
    user: { belongsTo: () => User, foreignKey: 'userId' } as any,
  };
}

class User extends ModelClass {
  static tableName = 'users';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
  static associations = {
    todos: { hasMany: () => Todo, foreignKey: 'userId' } as any,
    profile: { hasOne: () => Profile, foreignKey: 'userId' } as any,
  };
}

class Profile extends ModelClass {
  static tableName = 'profiles';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('InstanceQuery association accessors', () => {
  it('User.findBy(...).todos returns CollectionQuery scoped by parent link (hasMany)', () => {
    const q = (CollectionQuery.fromModel(User as any).findBy({ email: 'a@b' }) as any).todos;
    expect(q).toBeInstanceOf(CollectionQuery);
    expect(q.state.parent?.via.direction).toBe('hasMany');
    expect(q.state.parent?.via.childColumn).toBe('userId');
    expect(q.model.tableName).toBe('todos');
  });

  it('Todo.first().user returns InstanceQuery for User (belongsTo)', () => {
    const q = (CollectionQuery.fromModel(Todo as any).first() as any).user;
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.state.parent?.via.direction).toBe('belongsTo');
    expect(q.model.tableName).toBe('users');
  });

  it('User.first().profile returns InstanceQuery for Profile (hasOne)', () => {
    const q = (CollectionQuery.fromModel(User as any).first() as any).profile;
    expect(q).toBeInstanceOf(InstanceQuery);
    expect(q.state.parent?.via.direction).toBe('hasOne');
  });

  it('association accessor on a fresh chain has limit:1 from upstream first()', () => {
    const q = (CollectionQuery.fromModel(Todo as any).first() as any).user;
    expect(q.state.limit).toBe(1); // hasOne / belongsTo always single-record
  });
});
