import {
  ModelStatic,
  StrictSchema,
  StrictBelongsTo,
  StrictHasOne,
  StrictHasMany,
  staticImplements,
  Schema,
  QueryBy,
  FindBy,
  Filter,
  BelongsTo,
  HasOne,
  HasMany,
  Identifiable,
  ConnectorConstructor,
  Validator,
} from './types';

import {
  Connector,
} from './connector'

import {
} from './util'

export class PropertyNotDefinedError implements Error {
  name: string = 'PropertyNotDefinedError';
  message: string;

  constructor(name: string, isStatic: boolean = true, isReadonly: boolean = true) {
    this.message = 'Please define ';
    if (isStatic) this.message += 'static ';
    if (isReadonly) this.message += 'readonly ';
    this.message += `property '${name}' on your model`;
  }
};

export class LowerBoundsError implements Error {
  name: string = 'LowerBoundsError';
  message: string;

  constructor(name: string, lowerBound: number) {
    this.message = `
      Property '${name}' is expected to be greater or equal to '${lowerBound}'
    `;
  }
};

export class MinLengthError implements Error {
  name: string = 'MinLengthError';
  message: string;

  constructor(name: string, minLength: number) {
    this.message = `
      Property '${name}' length is expected to be longer or equal to '${minLength}'
    `;
  }
};

export class TypeError implements Error {
  name: string = 'TypeError';
  message: string;

  constructor(name: string, type: string) {
    this.message = `
      Property '${name}' is expected to an '${type}'
    `;
  }
};

export function NextModel<S extends Identifiable>(): ModelStatic<S> {
  @staticImplements<ModelStatic<S>>()
  class Model {
    private static readonly DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
    private static readonly DEFAULT_SKIP = 0;

    id: any;

    static get identifier(): string {
      return 'id';
    }

    static get modelName(): string {
      throw new PropertyNotDefinedError('modelName');
    }

    static get lowerModelName(): string {
      const name = this.modelName;
      return name.substr(0, 1).toLowerCase() + name.substr(1);
    }

    static get collectionName(): string | undefined {
      return undefined;
    }

    static get connector(): ConnectorConstructor<S> {
      return new Connector<S>();
    }

    static get schema(): Schema<S> {
      throw new PropertyNotDefinedError('schema');
    }

    static get filter(): Filter<S> {
      return {};
    }

    static get limit(): number {
      return this.DEFAULT_LIMIT;
    }

    static get skip(): number {
      return this.DEFAULT_SKIP;
    }

    static get keys(): (keyof S)[] {
      const keys: (keyof S)[] = [];
      for (const key in this.strictSchema) {
        keys.push(key);
      }
      return keys;
    }


    static get belongsTo(): BelongsTo {
      return {};
    }

    static get hasOne(): HasOne {
      return {};
    }

    static get hasMany(): HasMany {
      return {};
    }

    static get validators(): Validator<S>[] {
      return [];
    }


    static get strictSchema(): StrictSchema<S> {
      const schema = <StrictSchema<S>>this.schema;

      for (const key in schema) {
        if (!('defaultValue' in schema[key])) {
          schema[key].defaultValue = undefined;
        }
      }
      return schema;
    }

    static get strictFilter(): Filter<S> {
      return this.filter || {};
    }

    static get strictBelongsTo(): StrictBelongsTo {
      const belongsTo: StrictBelongsTo = {};
      for (const name in this.belongsTo) {
        const relation = this.belongsTo[name];
        const model = relation.model;
        const foreignKey = relation.foreignKey || model.lowerModelName + 'Id';
        belongsTo[name] = {
          foreignKey,
          model: relation.model,
        };
      }
      return belongsTo;
    }

    static get strictHasOne(): StrictHasOne {
      const hasOne: StrictHasOne = {};
      for (const name in this.hasOne) {
        const relation = this.hasOne[name];
        const foreignKey = relation.foreignKey || this.lowerModelName + 'Id';
        hasOne[name] = {
          foreignKey,
          model: relation.model,
        };
      }
      return hasOne;
    }

    static get strictHasMany(): StrictHasMany {
      const hasMany: StrictHasMany = {};
      for (const name in this.hasMany) {
        const relation = this.hasMany[name];
        const foreignKey = relation.foreignKey || this.lowerModelName + 'Id';
        hasMany[name] = {
          foreignKey,
          model: relation.model,
        };
      }
      return hasMany;
    }


    static limitBy(amount: number): typeof Model {
      // [TODO] Validate input (!NaN && x >= 0  && x < Infinity)
      return class extends this {
        static get limit(): number {
          return amount;
        }
      };
    }

    static get unlimited(): typeof Model {
      return class extends this {
        static get limit(): number {
          return this.DEFAULT_LIMIT;
        }
      };
    }

    static skipBy(amount: number): typeof Model {
      // [TODO] Validate input (!NaN && x >= 0  && x < Infinity)
      return class extends this {
        static get skip(): number {
          return amount;
        }
      };
    }

    static get unskipped(): typeof Model {
      return class extends this {
        static get skip(): number {
          return this.DEFAULT_SKIP;
        }
      };
    }

    static query(filterBy: Filter<S>): typeof Model {
      let filter = filterBy;
      if (this.filter !== undefined) {
        filter = {
          $and: [filterBy, this.filter],
        };
      }
      return class extends this {
        static get filter(): Filter<S> {
          return filter;
        }
      };
    }

    static get queryBy(): QueryBy<S> {
      const queryBy = <QueryBy<S>>{};
      for (const key in this.strictSchema) {
        queryBy[key] = (value) => {
          const filter = Array.isArray(value) ?
            { [key]: value } : { $in: { [key]: value } };
          return this.query(<Filter<S>>filter);
        };
      };
      return queryBy;
    }

    static get first(): Promise<Model | undefined> {
      return Promise.resolve(new Model({}));
    }

    static find(filterBy: Filter<S>): Promise<Model | undefined> {
      return this.query(filterBy).first;
    }

    static get findBy(): FindBy<S>  {
      const findBy = <FindBy<S>>{};
      for (const key in this.strictSchema) {
        findBy[key] = (value) => {
          const filter = Array.isArray(value) ?
            { [key]: value } : { $in: { [key]: value } };
          return this.find(<Filter<S>>filter);
        };
      };
      return findBy;
    }

    constructor(attrs: Partial<S> | undefined) {
      if (attrs !== undefined) {
        for (const key in attrs) {
          // @ts-ignore
          this[key] = attrs[key];
        }
      }
    }

    get model(): typeof Model {
      return <typeof Model>this.constructor;
    }

    get attributes(): S {
      const attrs: S = <S>{};
      for (const key in this.model.schema) {
        // @ts-ignore
        attrs[key] = this[key];
      }
      return attrs;
    }
  };

  return Model;
};

// interface UserSchema {
//   firstName: string;
//   lastName: string;
// }

// class User extends NextModel<UserSchema>() {;
//   firstName: string;
//   lastName: string;
//   // [key: string]: any;

//   static get modelName() {
//     return 'User';
//   }

//   static get schema() {
//     return {
//       firstName: { type: 'string' },
//       lastName: { type: 'string' },
//     };
//   }
// }

// const u = new User({firstName: 'test'});
// console.log(u);
// User.findBy('firstName', 1)
