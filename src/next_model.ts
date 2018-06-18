import {
  ModelConstructor,
  ModelStatic,
  ModelConstructorClass,
  ModelStaticClass,
  StrictSchema,
  Schema,
  QueryBy,
  FindBy,
  Filter,
  Identifiable,
  ConnectorConstructor,
  Validator,
  Changes,
  Order,
  RelationOptions,
  QueryByModel,
  FindByModel,
} from './types';

import {
  Connector,
} from './connector';

import { plural } from 'pluralize';
import { staticImplements } from '.';

export class PropertyNotDefinedError extends Error {
  name: string = 'PropertyNotDefinedError';

  constructor(name: string, isStatic: boolean = true, isReadonly: boolean = true) {
    super(
      `Please define ${isStatic ? 'static ' : ''} ${isReadonly ? 'readonly ' : ''}property '${name}' on your model`);
    );
  }
};

export class LowerBoundsError extends Error {
  name: string = 'LowerBoundsError';

  constructor(name: string, lowerBound: number) {
    super(this.message = `
      Property '${name}' is expected to be greater or equal to '${lowerBound}'
    `);
  }
};

export class MinLengthError extends Error {
  name: string = 'MinLengthError';

  constructor(name: string, minLength: number) {
    super(`
      Property '${name}' length is expected to be longer or equal to '${minLength}'
    `);
  }
};

export class TypeError extends Error {
  name: string = 'TypeError';

  constructor(name: string, type: string) {
    super(`
      Property '${name}' is expected to an '${type}'
    `);
  }
};

export function NextModel<S extends Identifiable>(): ModelStatic<S> {
  @staticImplements<ModelStatic<S>>()
  class Model {
    private static readonly DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
    private static readonly DEFAULT_SKIP = 0;
    private cachedPersistentAttributes: Partial<S>;

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

    static get underscoreModelName(): string {
      const lowerName = this.lowerModelName;
      return lowerName.replace(/([A-Z])/g, (_x, y) => '_' + y.toLowerCase());
    }

    static get pluralModelName(): string {
      return plural(this.underscoreModelName);
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

    static get order(): Partial<Order<S>>[] {
      return [];
    }

    static get keys(): (keyof S)[] {
      const keys: (keyof S)[] = [];
      for (const key in this.strictSchema) {
        keys.push(key);
      }
      return keys;
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

    static getTyped<M extends ModelStatic<S>, I extends ModelConstructor<S>>(): NextModelStatic<S, M, I> {
      return new NextModelStatic<S, M, I>(<any>this);
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

    static orderBy(order: Partial<Order<S>>): typeof Model {
      const newOrder: Partial<Order<S>>[] = []
      newOrder.push(...this.order, order);

      return class extends this {
        static get order(): Partial<Order<S>>[] {
          return newOrder;
        }
      };
    }

    static reorder(order: Partial<Order<S>>): typeof Model {
      return class extends this {
        static get order(): Partial<Order<S>>[] {
          return [order];
        }
      };
    }

    static get unordered(): typeof Model {
      return class extends this {
        static get order(): Partial<Order<S>>[] {
          return [];
        }
      };
    }

    static query(filterBy: Filter<S>): typeof Model {
      let filter = filterBy;
      if (this.filter !== undefined && Object.keys(this.filter).length > 0)  {
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

    static onlyQuery(filter: Filter<S>): typeof Model {
      return class extends this {
        static get filter(): Filter<S> {
          return filter;
        }
      };
    }

    static get queryBy(): QueryBy<S> {
      const queryBy = <QueryBy<S>>{};
      for (const key in this.strictSchema) {
        queryBy[key] = (value) => this.query(
          Array.isArray(value)
            ? <Filter<any>>{ $in: { [key]: value } }
            : <Filter<any>>{ [key]: value }
        );
      };
      return queryBy;
    }

    static get unfiltered(): typeof Model {
      return class extends this {
        static get filter(): Filter<S> {
          return {};
        }
      };
    }


    static get all(): Promise<Model[]> {
      return <Promise<Model[]>>this.connector.query(this).then(instances => {
        instances.forEach(instance => (<Model>instance).setPersistentAttributes());
        return instances;
      });
    }

    static async updateAll(attrs: Partial<S>): Promise<typeof Model> {
      await this.connector.updateAll(this, attrs);
      return this;
    }

    static async deleteAll(): Promise<typeof Model> {
      await this.connector.deleteAll(this);
      return this;
    }

    static async inBatchesOf(amount: number): Promise<Promise<Model[]>[]> {
      const count = await this.count;
      const batchCount = Math.ceil(count / amount);
      if (batchCount > 0 && batchCount < Number.MAX_SAFE_INTEGER) {
        const subqueries: Promise<Model[]>[] = [];
        for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
          const skip = this.skip + batchIndex * amount;
          const limit = batchIndex !== batchCount - 1 ? amount : count - (batchCount - 1) * amount;
          subqueries.push(this.skipBy(skip).limitBy(limit).all);
        }
        return subqueries;
      } else {
        return [];
      }
    }

    static get first(): Promise<Model | undefined> {
      return this.limitBy(1).all.then(instances => instances[0]);
    }

    static find(filterBy: Filter<S>): Promise<Model | undefined> {
      return this.query(filterBy).first;
    }

    static get findBy(): FindBy<S>  {
      const findBy = <FindBy<S>>{};
      for (const key in this.strictSchema) {
        findBy[key] = (value) => this.find(Array.isArray(value)
            ? <Filter<any>>{ $in: { [key]: value } }
            : <Filter<any>>{ [key]: value }
        );
      };
      return findBy;
    }

    static get count(): Promise<number> {
      return this.connector.count(this);
    }

    static async pluck(key: keyof S): Promise<S[keyof S][]> {
      const arr: any[][] = await this.connector.select(this, key);
      return arr.map(items => items[0]);
    }

    static select(key: keyof S): Promise<S[keyof S][][]> {
      return this.connector.select(this, key);
    }

    constructor(attrs: Partial<S> | undefined) {
      this.cachedPersistentAttributes = {};
      if (attrs !== undefined) {
        for (const key in attrs) {
          (<Partial<S>><any>this)[key] = attrs[key];
        }
      }
    }

    static build(attrs: Partial<S> | undefined): Model {
      return new this(attrs);
    }

    static create(attrs: Partial<S> | undefined): Promise<Model> {
      return new this(attrs).save();
    }

    get model(): typeof Model {
      return <typeof Model>this.constructor;
    }

    get attributes(): Partial<S> {
      const self = <Partial<S>><any>this;
      const attrs: Partial<S> = {};
      for (const key in this.model.schema) {
        attrs[key] = self[key];
      }
      return attrs;
    }

    setPersistentAttributes() {
      this.cachedPersistentAttributes = this.attributes;
    }

    get persistentAttributes(): Partial<S> {
      return this.cachedPersistentAttributes;
    }

    get isNew(): boolean {
      return this.id === undefined || this.id === null;
    }

    get isPersistent(): boolean {
      return !this.isNew;
    }

    get isChanged(): boolean {
      return Object.keys(this.changes).length > 0;
    }

    get isValid(): Promise<boolean> {
      const promises = this.model.validators.map(validator => validator(this));
      return Promise.all(promises).then(validations => {
        for (const isValid of validations) {
          if (!isValid) return false;
        }
        return true;
      });
    }

    get changes(): Partial<Changes<S>> {
      const self = <Partial<S>><any>this;
      const changes: Partial<Changes<S>> = {};
      for (const key of this.model.keys) {
        if (self[key] !== this.persistentAttributes[key]) {
          changes[key] = { from: this.persistentAttributes[key], to: self[key] };
        }
      }
      return changes;
    }

    belongsTo<M extends ModelStatic<any>>(model: M, options?: RelationOptions): M {
      const relOptions: RelationOptions = options || {};
      const foreignKey = relOptions.foreignKey || `${model.lowerModelName}Id}`;
      const identifier = model.identifier;
      const through = relOptions.through;
      let filter: Filter<any>;
      if (through) {
        filter = {
          $async: async () => ({
            [identifier]: await through.pluck(foreignKey),
          })
        };
      } else {
        filter = {
          [identifier]: (<any>this)[foreignKey],
        };
      }
      return <any>model.query(filter).limitBy(1).unskipped;
    }

    hasMany<M extends ModelStatic<any>>(model: M, options?: RelationOptions): M {
      const relOptions: RelationOptions = options || {};
      const through = relOptions.through;
      let filter: Filter<any>;
      if (through) {
        const foreignKey = relOptions.foreignKey || `${through.lowerModelName}Id`;
        filter = {
          $async: async () => ({
            [foreignKey]: await through.pluck(through.identifier),
          })
        };
      } else {
        const foreignKey = relOptions.foreignKey || `${this.model.lowerModelName}Id`;
        filter = {
          [foreignKey]: this.id,
        };
      }
      return <any>model.query(filter).unlimited.unskipped;
    }

    hasOne<M extends ModelStatic<any>>(model: M, options?: RelationOptions): M {
      const relOptions: RelationOptions = options || {};
      const through = relOptions.through;
      let filter: Filter<any>;
      if (through) {
        const foreignKey = relOptions.foreignKey || `${through.lowerModelName}Id`;
        filter = {
          $async: async () => ({
            [foreignKey]: await through.pluck(through.identifier),
          })
        };
      } else {
        const foreignKey = relOptions.foreignKey || `${this.model.lowerModelName}Id`;
        filter = {
          [foreignKey]: this.id,
        };
      }
      return <any>model.query(filter).limitBy(1).unskipped;
    }

    getTyped<M extends ModelStatic<S>, I extends ModelConstructor<S>>(): NextModelConstructor<S, M, I> {
      return new NextModelConstructor<S, M, I>(<any>this);
    }

    assign(attrs: Partial<S>): Model {
      for (const key in attrs) {
        (<Partial<S>><any>this)[key] = attrs[key];
      }
      return this;
    }

    revertChange(key: keyof S): Model {
      (<Partial<S>><any>this)[key] = this.persistentAttributes[key];
      return this;
    }

    revertChanges(): Model {
      for (const key of this.model.keys) {
        this.revertChange(key);
      }
      return this;
    }

    async save(): Promise<Model> {
      try {
        let instance: Model;
        if (this.isNew) {
          instance = await <Promise<Model>>this.model.connector.create(this);
        } else {
          instance = await <Promise<Model>>this.model.connector.update(this);
        }
        instance.setPersistentAttributes();
        return instance;
      } catch (error) {
        throw error;
      }
    }

    async delete(): Promise<Model> {
      try {
        const instance = await <Promise<Model>>this.model.connector.delete(this);
        instance.setPersistentAttributes();
        return instance;
      } catch (error) {
        throw error;
      }
    }

    reload(): Promise<Model | undefined> {
      return this.model.limitBy(1).onlyQuery({[this.model.identifier]: this.id}).first;
    }
  };

  return Model;
};


export class NextModelStatic<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> extends ModelStaticClass<S, M, I> {
  constructor(public model: M) {
    super();
  }

  limitBy(amount: number): M {
    return <any>this.model.limitBy(amount);
  }

  get unlimited(): M {
    return <any>this.model.unlimited;
  }

  skipBy(amount: number): M {
    return <any>this.model.skipBy(amount);
  }

  get unskipped(): M {
    return <any>this.model.unskipped;
  }

  orderBy(order: Partial<Order<S>>): M {
    return <any>this.model.orderBy(order);
  }

  reorder(order: Partial<Order<S>>): M {
    return <any>this.model.reorder(order);
  }

  get unordered(): M {
    return <any>this.model.unordered;
  }

  query(query: Filter<S>): M {
    return <any>this.model.query(query);
  }

  onlyQuery(query: Filter<S>): M {
    return <any>this.model.onlyQuery(query);
  };

  get queryBy(): QueryByModel<S, M> {
    return <any>this.model.queryBy;
  }

  get unfiltered(): M {
    return <any>this.model.unfiltered;
 }

  get all(): Promise<I[]> {
    return <any>this.model.all;
  }

  pluck(key: keyof S): Promise<S[keyof S][]> {
    return this.model.pluck(key);
  }

  select(...keys: (keyof S)[]): Promise<S[keyof S][][]> {
    return this.model.select(...keys);
  }

  updateAll(attrs: Partial<S>): Promise<M> {
    return <any>this.model.updateAll(attrs);
  }

  deleteAll(): Promise<I> {
    return <any>this.model.deleteAll();
  }

  inBatchesOf(amount: number): Promise<Promise<I[]>[]> {
    return <any>this.model.inBatchesOf(amount);
  }

  get first(): Promise<I | undefined> {
    return <any>this.model.first;
  }

  find(query: Filter<S>): Promise<I | undefined> {
    return <any>this.model.find(query);
  }

  get findBy(): FindByModel<S, I> {
    return <any>this.model.findBy;
  }

  get count(): Promise<number> {
    return this.model.count;
  }

  build(attrs: Partial<S> | undefined): I {
    return <any>this.model.build(attrs);
  }

  create(attrs: Partial<S> | undefined): Promise<I> {
    return <any>this.model.create(attrs);
  }
};

export class NextModelConstructor<S extends Identifiable, M extends ModelStatic<S>, I extends ModelConstructor<S>> extends ModelConstructorClass<S, M, I> {
  constructor(public instance: I) {
    super();
  }

  get model(): M {
    return <any>this.instance.model;
  }

  belongsTo<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R {
    return this.belongsTo(model, options);
  }

  hasMany<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R {
    return this.hasMany(model, options);
  }

  hasOne<R extends ModelStatic<any>>(model: R, options?: RelationOptions): R {
    return this.hasOne(model, options);
  }

  assign(attrs: Partial<S>): I {
    return <any>this.instance.assign(attrs);
  }

  revertChange(key: keyof S): I {
    return <any>this.instance.revertChange(key);
  }

  revertChanges(): I {
    return <any>this.instance.revertChanges();
  }

  save(): Promise<I> {
    return <any>this.instance.save();
  }

  delete(): Promise<I> {
    return <any>this.instance.delete();
  }

  reload(): Promise<I | undefined> {
    return <any>this.instance.reload();
  }
};

export default NextModel;

// import {
//   DataType,
// } from './types';

// interface UserSchema {
//   id: number;
//   firstName: string;
//   lastName: string;
// }

// class User extends NextModel<UserSchema>() implements UserSchema {
//   firstName: string;
//   lastName: string;
//   // [key: string]: any;

//   static get modelName() {
//     return 'User';
//   }

//   static get schema() {
//     return {
//       id: { type: DataType.integer },
//       firstName: { type: DataType.string },
//       lastName: { type: DataType.string },
//     };
//   }

//   static get $(): NextModelStatic<UserSchema, typeof User, User> {
//     return <any>this.getTyped();
//   }

//   get $(): NextModelConstructor<UserSchema, typeof User, User> {
//     return <any>this.getTyped();
//   }

//   get addresses() {
//     return this.hasMany(Address);
//   }
// }

// interface AddressSchema {
//   id: number;
//   userId: number;
//   street: string;
//   city: string;
// }

// class Address extends NextModel<AddressSchema>() implements AddressSchema {
//   userId: number;
//   street: string;
//   city: string;
//   // [key: string]: any;

//   static get modelName() {
//     return 'Addresss';
//   }

//   static get schema() {
//     return {
//       id: { type: DataType.integer },
//       userId: { type: DataType.integer },
//       city: { type: DataType.string },
//       street: { type: DataType.string },
//     };
//   }

//   static get $(): NextModelStatic<AddressSchema, typeof Address, Address> {
//     return <any>this.getTyped();
//   }

//   get $(): NextModelConstructor<AddressSchema, typeof Address, Address> {
//     return <any>this.getTyped();
//   }

//   get user() {
//     return this.belongsTo(User);
//   }
// }

// async () => {
//   const address1 = await Address.first
//   const address2 = await Address.$.first
//   const user1 = address1 ? address1.user : undefined;
//   const user2 = address2 ? address2.user : undefined;
//   const addresses1 = Address.query({
//     street: 'a',
//   });
//   const addresses2 = Address.query({
//     $async: Promise.resolve({
//       street: 'a',
//     }),
//   });
//   const addresses3 = Address.query({
//     $gt: { street: 'a' },
//   })
//   const addresses4 = Address.query({
//     $in: { street: ['a'] },
//   })
// }
