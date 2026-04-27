import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ModelClass } from '../Model.js';

class Role extends ModelClass {
  static tableName = 'roles';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

class UserRole extends ModelClass {
  static tableName = 'userRoles';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

class User extends ModelClass {
  static tableName = 'users';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
  static associations = {
    roles: {
      hasManyThrough: () => Role,
      through: () => UserRole,
    } as any,
  };
}

describe('hasManyThrough association traversal', () => {
  it('User.first().roles returns CollectionQuery on Role with nested parent chain', () => {
    const q = (CollectionQuery.fromModel(User as any).first() as any).roles;
    expect(q).toBeInstanceOf(CollectionQuery);
    expect(q.model.tableName).toBe('roles');

    // Nested chain: leaf (Role) → parent (UserRole) → parent (User-instance).
    expect(q.state.parent).toBeDefined();
    const userRoleParent = q.state.parent;
    expect(userRoleParent.via.childColumn).toBe('id');         // Role.id
    expect(userRoleParent.via.parentColumn).toBe('roleId');    // UserRole.roleId

    const userRoleUpstream = userRoleParent.upstream.state;
    expect(userRoleUpstream.Model.tableName).toBe('userRoles');
    expect(userRoleUpstream.parent).toBeDefined();
    const userParent = userRoleUpstream.parent;
    expect(userParent.via.childColumn).toBe('userId');         // UserRole.userId
    expect(userParent.via.parentColumn).toBe('id');            // User.id
  });

  it('honours explicit foreignKey overrides', () => {
    class UserExplicit extends ModelClass {
      static tableName = 'users';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        roles: {
          hasManyThrough: () => Role,
          through: () => UserRole,
          throughForeignKey: 'memberId',
          targetForeignKey: 'permissionId',
        } as any,
      };
    }
    const q = (CollectionQuery.fromModel(UserExplicit as any).first() as any).roles;
    const userRoleParent = q.state.parent;
    expect(userRoleParent.via.parentColumn).toBe('permissionId');
    expect(userRoleParent.upstream.state.parent.via.childColumn).toBe('memberId');
  });
});
