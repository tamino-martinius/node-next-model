import {
  ModelStatic,
  StrictSchema,
  StrictBelongsTo,
  StrictHasOne,
  StrictHasMany,
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
  Changes,
  Order,
} from './types';

import {
  Connector,
} from './connector';

import {
  staticImplements,
} from './util';

import { plural } from 'pluralize';

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
        queryBy[key] = (value) => {
          const filter = Array.isArray(value) ?
            { [key]: value } : { $in: { [key]: value } };
          return this.query(<Filter<S>>filter);
        };
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
          const limit = batchIndex !== batchCount - 1 ? amount : batchCount * amount - count;
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
        findBy[key] = (value) => {
          const filter = Array.isArray(value) ?
            { [key]: value } : { $in: { [key]: value } };
          return this.find(<Filter<S>>filter);
        };
      };
      return findBy;
    }

    static get count(): Promise<number> {
      return this.connector.count(this);
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
      let instance: Model;
      if (this.isNew) {
        instance = await <Promise<Model>>this.model.connector.create(this);
      } else {
        instance = await <Promise<Model>>this.model.connector.update(this);
      }
      instance.setPersistentAttributes();
      return instance;
    }

    async delete(): Promise<Model> {
      const instance = await <Promise<Model>>this.model.connector.delete(this);
      instance.setPersistentAttributes();
      return instance;
    }

    reload(): Promise<Model | undefined> {
      return this.model.limitBy(1).onlyQuery({[this.model.identifier]: this.id}).first;
    }
  };

  return Model;
};

export default NextModel;

// interface UserSchema {
//   id: number;
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
//       id: {type: 'number' },
//       firstName: { type: 'string' },
//       lastName: { type: 'string' },
//     };
//   }
// }

// const u = new User({firstName: 'test'});
// console.log(u);
// User.findBy.firstName('test');

// function BaseModel<T extends Identifiable>() {
//   return class extends NextModel<T>() {
//     static get connector() {
//       return new Connector<T>();
//     }
//   }
// }
