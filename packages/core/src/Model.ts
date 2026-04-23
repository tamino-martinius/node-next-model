import { NotFoundError, PersistenceError, ValidationError } from './errors';
import {
  type Callback,
  type Callbacks,
  type Connector,
  type Dict,
  type Filter,
  KeyType,
  type Order,
  type OrderColumn,
  type Schema,
  type Scope,
  type Validator,
} from './types';

import { MemoryConnector } from './MemoryConnector';

export class ModelClass {
  static tableName: string;
  static filter: Filter<any> | undefined;
  static limit: number | undefined;
  static skip: number | undefined;
  static order: OrderColumn<any>[];
  static keys: Dict<KeyType>;
  static connector: Connector;
  static init: (props: any) => Dict<any>;
  static timestamps = true;
  static validators: Validator<any>[] = [];
  static callbacks: Callbacks<any> = {};

  static modelScope() {
    return {
      tableName: this.tableName,
      filter: this.filter,
      limit: this.limit,
      skip: this.skip,
      order: this.order,
    } as Scope;
  }

  static limitBy<M extends typeof ModelClass>(this: M, amount: number) {
    return class extends (this as typeof ModelClass) {
      static limit = amount;
    } as M;
  }

  static unlimited<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static limit = undefined;
    } as M;
  }

  static skipBy<M extends typeof ModelClass>(this: M, amount: number) {
    return class extends (this as typeof ModelClass) {
      static skip = amount;
    } as M;
  }

  static unskipped<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static skip = undefined;
    } as M;
  }

  static orderBy<M extends typeof ModelClass>(this: M, order: Order<any>) {
    const newOrder = [...this.order, ...(Array.isArray(order) ? order : [order])];
    return class extends (this as typeof ModelClass) {
      static order = newOrder;
    } as M;
  }

  static unordered<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static order: OrderColumn<any>[] = [];
    } as M;
  }

  static reorder<M extends typeof ModelClass>(this: M, order: Order<any>) {
    return class extends (this as typeof ModelClass) {
      static order = Array.isArray(order) ? order : [order];
    } as M;
  }

  static filterBy<M extends typeof ModelClass>(this: M, andFilter: Filter<any>) {
    let filter: Filter<any> | undefined = andFilter;
    if (this.filter) {
      for (const key in this.filter) {
        if ((this.filter as any)[key] !== undefined && (andFilter as any)[key] !== undefined) {
          filter = { $and: [filter, andFilter] };
          break;
        }
        (filter as any)[key] = (this.filter as any)[key];
      }
    }
    if (Object.keys(andFilter).length === 0) filter = this.filter;
    return class extends (this as typeof ModelClass) {
      static filter = filter;
    } as M;
  }

  static orFilterBy<M extends typeof ModelClass>(this: M, orFilter: Filter<any>) {
    const filter =
      Object.keys(orFilter).length === 0
        ? this.filter
        : this.filter
          ? { $or: [this.filter, orFilter] }
          : orFilter;
    return class extends (this as typeof ModelClass) {
      static filter = filter;
    } as M;
  }

  static unfiltered<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static filter = undefined;
    } as M;
  }

  static build<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init(createProps)) as InstanceType<M>;
  }

  static buildScoped<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init({ ...this.filter, ...createProps })) as InstanceType<M>;
  }

  static create<M extends typeof ModelClass>(this: M, createProps: any) {
    return this.build<M>(createProps).save();
  }

  static createScoped<M extends typeof ModelClass>(this: M, props: any) {
    return this.buildScoped<M>(props).save();
  }

  static async all<M extends typeof ModelClass>(this: M) {
    const items = await this.connector.query(this.modelScope());
    return items.map((item) => {
      const keys: Dict<any> = {};
      for (const key in this.keys) {
        keys[key] = item[key];
        delete item[key];
      }
      return new this(item, keys) as InstanceType<M>;
    });
  }

  static async first<M extends typeof ModelClass>(this: M) {
    const items = await this.limitBy(1).all<M>();
    return items.pop();
  }

  static async select(...keys: any[]) {
    const items = await this.connector.select(this.modelScope(), ...keys);
    return items;
  }

  static async pluck(key: string) {
    const items = await this.select(key as any);
    return items.map((item) => item[key]);
  }

  static async count<M extends typeof ModelClass>(this: M) {
    return await this.connector.count(this.modelScope());
  }

  static async deleteAll<M extends typeof ModelClass>(this: M) {
    return await this.connector.deleteAll(this.modelScope());
  }

  static async findBy<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
    return await this.filterBy(filter).first<M>();
  }

  static async exists<M extends typeof ModelClass>(this: M, filter?: Filter<any>) {
    const scoped = filter === undefined ? this : this.filterBy(filter);
    return (await scoped.count()) > 0;
  }

  persistentProps: Dict<any>;
  changedProps: Dict<any> = {};
  keys: Dict<any> | undefined;

  constructor(props: Dict<any>, keys?: Dict<any>) {
    this.persistentProps = props;
    this.keys = keys;

    for (const key in this.persistentProps) {
      Object.defineProperty(this, key, {
        get: () => this.attributes()[key],
        set: (value) => this.assign({ [key]: value }),
      });
    }

    const model = this.constructor as typeof ModelClass;

    for (const key in model.keys) {
      Object.defineProperty(this, key, {
        get: () => (this.keys ? this.keys[key] : undefined),
      });
    }
  }

  isPersistent() {
    return this.keys !== undefined;
  }

  isNew() {
    return this.keys === undefined;
  }

  attributes(): Dict<any> {
    return { ...this.persistentProps, ...this.changedProps, ...this.keys };
  }

  assign<M extends ModelClass>(this: M, props: Dict<any>) {
    for (const key in props) {
      if (this.persistentProps[key] !== props[key]) {
        this.changedProps[key] = props[key];
      } else {
        delete this.changedProps[key];
      }
    }
    return this as M;
  }

  isChanged(): boolean {
    return Object.keys(this.changedProps).length > 0;
  }

  isChangedBy(key: string): boolean {
    return key in this.changedProps;
  }

  changes(): Dict<{ from: any; to: any }> {
    const result: Dict<{ from: any; to: any }> = {};
    for (const key in this.changedProps) {
      result[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
    }
    return result;
  }

  revertChange<M extends ModelClass>(this: M, key: string) {
    delete this.changedProps[key];
    return this as M;
  }

  revertChanges<M extends ModelClass>(this: M) {
    this.changedProps = {};
    return this as M;
  }

  itemScope(): Scope {
    const model = this.constructor as typeof ModelClass;
    return {
      tableName: model.tableName,
      filter: this.keys,
      limit: 1,
      skip: 0,
      order: [],
    };
  }

  async isValid(): Promise<boolean> {
    const model = this.constructor as typeof ModelClass;
    for (const validator of model.validators) {
      if (!(await validator(this))) return false;
    }
    return true;
  }

  async runCallbacks(kind: keyof Callbacks<any>): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    const callbacks = model.callbacks[kind] as Callback<any>[] | undefined;
    if (!callbacks) return;
    for (const callback of callbacks) {
      await callback(this);
    }
  }

  async save<M extends ModelClass>(this: M) {
    const model = this.constructor as typeof ModelClass;
    if (!(await this.isValid())) {
      throw new ValidationError('Validation failed');
    }
    const now = new Date();
    const isInsert = !this.keys;

    await this.runCallbacks('beforeSave');
    await this.runCallbacks(isInsert ? 'beforeCreate' : 'beforeUpdate');

    if (this.keys) {
      const changedKeys = Object.keys(this.changedProps);
      if (changedKeys.length > 0) {
        if (model.timestamps) {
          this.changedProps.updatedAt = now;
        }
        const items = await model.connector.updateAll(this.itemScope(), this.changedProps);
        const item = items.pop();
        if (item) {
          for (const key in model.keys) {
            this.keys[key] = item[key];
            delete item[key];
          }
          this.persistentProps = item;
          this.changedProps = {};
        } else {
          throw new NotFoundError('Item not found');
        }
      }
    } else {
      const insertProps = { ...this.persistentProps, ...this.changedProps };
      if (model.timestamps) {
        if (insertProps.createdAt === undefined) insertProps.createdAt = now;
        if (insertProps.updatedAt === undefined) insertProps.updatedAt = now;
      }
      const items = await model.connector.batchInsert(model.tableName, model.keys, [insertProps]);
      const item = items.pop();
      if (item) {
        this.keys = {};
        for (const key in model.keys) {
          this.keys[key] = item[key];
          delete item[key];
        }
        this.persistentProps = item;
        this.changedProps = {};
      } else {
        throw new PersistenceError('Failed to insert item');
      }
    }

    await this.runCallbacks(isInsert ? 'afterCreate' : 'afterUpdate');
    await this.runCallbacks('afterSave');

    return this as M;
  }

  async delete<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot delete a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    await this.runCallbacks('beforeDelete');
    const items = await model.connector.deleteAll(this.itemScope());
    if (items.length === 0) {
      throw new NotFoundError('Item not found');
    }
    this.persistentProps = { ...this.persistentProps, ...this.changedProps, ...this.keys };
    this.changedProps = {};
    this.keys = undefined;
    await this.runCallbacks('afterDelete');
    return this as M;
  }
}

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number },
>(props: {
  tableName: string;
  init: (props: CreateProps) => PersistentProps;
  filter?: Filter<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  limit?: number;
  skip?: number;
  order?: Order<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  connector?: Connector;
  keys?: Keys;
  timestamps?: boolean;
  validators?: Validator<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >[];
  callbacks?: Callbacks<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
}) {
  const connector = props.connector ? props.connector : new MemoryConnector();
  const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
  const keyDefinitions = props.keys || { id: KeyType.number };
  const timestamps = props.timestamps ?? true;
  const validators = props.validators || [];
  const callbacks = props.callbacks || {};

  return class Model extends ModelClass {
    static tableName = props.tableName;
    static filter = props.filter;
    static limit = props.limit;
    static skip = props.skip;
    static order = order;
    static keys = keyDefinitions;
    static connector = connector;
    static init = props.init as any;
    static timestamps = timestamps;
    static validators = validators as Validator<any>[];
    static callbacks = callbacks as Callbacks<any>;

    static orderBy<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orderBy(order) as M;
    }

    static reorder<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.reorder(order) as M;
    }

    static filterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.filterBy(filter) as M;
    }

    static orFilterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orFilterBy(filter) as M;
    }

    static async select(...keys: [keyof Keys | keyof PersistentProps][]) {
      return super.select(...(keys as any[])) as any as Partial<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >[];
    }

    static async pluck(key: keyof Keys | keyof PersistentProps) {
      return super.pluck(key as string);
    }

    static async all<M extends typeof ModelClass>(this: M) {
      return (await super.all()) as (InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
    }

    static async first<M extends typeof ModelClass>(this: M) {
      return (await super.first()) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async count<M extends typeof ModelClass>(this: M) {
      return await super.count();
    }

    static async deleteAll<M extends typeof ModelClass>(this: M) {
      return (await super.deleteAll()) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static async findBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return (await super.findBy(filter)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async exists<M extends typeof ModelClass>(
      this: M,
      filter?: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return await super.exists(filter);
    }

    static build<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return super.build(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static buildScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return super.buildScoped(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async create<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return (await super.create(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async createScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return (await super.createScoped(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number } | undefined;

    // biome-ignore lint/complexity/noUselessConstructor: narrows parent's Dict<any> params to PersistentProps/Keys
    constructor(
      props: PersistentProps,
      keys?: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number },
    ) {
      super(props, keys);
    }

    attributes() {
      return {
        ...(this.persistentProps as object),
        ...(this.changedProps as object),
        ...(this.keys as object),
      } as PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
    }

    assign<M extends ModelClass>(this: M, props: Partial<PersistentProps>) {
      for (const key in props) {
        if (this.persistentProps[key] !== props[key]) {
          this.changedProps[key] = props[key];
        } else {
          delete this.changedProps[key];
        }
      }
      return this as M;
    }

    isChangedBy(key: keyof PersistentProps): boolean {
      return super.isChangedBy(key as string);
    }

    revertChange<M extends ModelClass>(this: M, key: keyof PersistentProps): M {
      return super.revertChange(key as string) as M;
    }
  };
}

export default Model;
