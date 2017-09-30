import NextModel from '../NextModel';
import {
  Connector,
  SchemaAttribute,
} from '../types';

export class User extends NextModel {
  static get modelName() {
    return 'User';
  }

  static get hasMany() {
    return {
      userAddresses: { model: UserAddress },
    };
  }

  static get schema() {
    return {
      firstName: <SchemaAttribute<string>>{ defaultValue: '' },
      lastName: <SchemaAttribute<string>>{ defaultValue: '' },
    };
  }
};

export class Address extends NextModel {
  static get modelName() {
    return 'Address';
  }

  static get hasMany() {
    return {
      userAddresses: { model: UserAddress },
    };
  }

  static get schema() {
    return {
      street: <SchemaAttribute<string>>{ defaultValue: '' },
      number: <SchemaAttribute<number>>{ defaultValue: null },
      postalCode: <SchemaAttribute<string>>{ defaultValue: '' },
    };
  }
};

export class UserAddress extends NextModel {
  static get modelName() {
    return 'UserAddress';
  }

  static get schema() {
    return {
    };
  }

  static get belongsTo() {
    return {
      user: { model: User },
      address: { model: Address },
    };
  }
};
