import { NotFoundError, PersistenceError, ValidationError } from './errors';
import {
  type AggregateKind,
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
  SortDirection,
  type Validator,
} from './types';

import { MemoryConnector } from './MemoryConnector';
import { singularize } from './util';

export type AssociationOptions = {
  foreignKey?: string;
  primaryKey?: string;
  polymorphic?: string;
  typeKey?: string;
  typeValue?: string;
};

export type HasManyThroughOptions = {
  throughForeignKey?: string;
  targetForeignKey?: string;
  selfPrimaryKey?: string;
  targetPrimaryKey?: string;
};

export type ScopeFn<Self> = (self: Self, ...args: any[]) => Self;

export type ScopeMap<Self> = Dict<ScopeFn<Self>>;

export type ScopesToMethods<Self, S extends ScopeMap<Self>> = {
  [K in keyof S]: (...args: S[K] extends (self: any, ...rest: infer R) => any ? R : never) => Self;
};

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
  static softDelete: 'active' | 'only' | false = false;
  static validators: Validator<any>[] = [];
  static callbacks: Callbacks<any> = {};

  static async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.connector.transaction(fn);
  }

  static modelScope() {
    let filter = this.filter;
    if (this.softDelete === 'active') {
      filter = filter ? { $and: [{ $null: 'discardedAt' }, filter] } : { $null: 'discardedAt' };
    } else if (this.softDelete === 'only') {
      filter = filter
        ? { $and: [{ $notNull: 'discardedAt' }, filter] }
        : { $notNull: 'discardedAt' };
    }
    return {
      tableName: this.tableName,
      filter,
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
    const hasSpecial = (f: Filter<any>) => Object.keys(f).some((k) => k.startsWith('$'));
    let filter: Filter<any> | undefined = andFilter;
    if (this.filter) {
      if (hasSpecial(this.filter) || hasSpecial(andFilter)) {
        filter = { $and: [this.filter, andFilter] };
      } else {
        for (const key in this.filter) {
          if ((this.filter as any)[key] !== undefined && (andFilter as any)[key] !== undefined) {
            filter = { $and: [filter, andFilter] };
            break;
          }
          (filter as any)[key] = (this.filter as any)[key];
        }
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

  static reverse<M extends typeof ModelClass>(this: M) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const existing = this.order.length > 0 ? this.order : [{ key: primaryKey }];
    const flipped = existing.map((col) => ({
      key: col.key,
      dir:
        (col.dir ?? SortDirection.Asc) === SortDirection.Asc
          ? SortDirection.Desc
          : SortDirection.Asc,
    }));
    return class extends (this as typeof ModelClass) {
      static order = flipped;
    } as M;
  }

  static unscoped<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static filter = undefined;
      static limit = undefined;
      static skip = undefined;
      static order: OrderColumn<any>[] = [];
      static softDelete: 'active' | 'only' | false = false;
    } as M;
  }

  static on(event: keyof Callbacks<any>, handler: Callback<any>): () => void {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    const list = this.callbacks[event] as Callback<any>[];
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  static withDiscarded<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static softDelete: 'active' | 'only' | false = false;
    } as M;
  }

  static onlyDiscarded<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static softDelete: 'active' | 'only' | false = 'only';
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

  static async createMany<M extends typeof ModelClass>(this: M, propsList: any[]) {
    const now = new Date();
    const insertProps = propsList.map((p) => {
      const base = this.init(p) as Dict<any>;
      if (this.timestamps) {
        if (base.createdAt === undefined) base.createdAt = now;
        if (base.updatedAt === undefined) base.updatedAt = now;
      }
      return base;
    });
    const items = await this.connector.batchInsert(this.tableName, this.keys, insertProps);
    return items.map((item) => {
      const keys: Dict<any> = {};
      for (const key in this.keys) {
        keys[key] = item[key];
        delete item[key];
      }
      return new this(item, keys) as InstanceType<M>;
    });
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

  static async last<M extends typeof ModelClass>(this: M) {
    return (this.reverse() as M).first<M>();
  }

  static async ids<M extends typeof ModelClass>(this: M) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    return this.pluck(primaryKey);
  }

  static async select(...keys: any[]) {
    const items = await this.connector.select(this.modelScope(), ...keys);
    return items;
  }

  static async pluck(key: string) {
    const items = await this.select(key as any);
    return items.map((item) => item[key]);
  }

  static async pluckUnique(key: string) {
    const values = await this.pluck(key);
    const seen = new Set<any>();
    const result: any[] = [];
    for (const v of values) {
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }
    return result;
  }

  static async count<M extends typeof ModelClass>(this: M) {
    return await this.connector.count(this.modelScope());
  }

  static async aggregate<M extends typeof ModelClass>(
    this: M,
    kind: AggregateKind,
    key: string,
  ): Promise<number | undefined> {
    return await this.connector.aggregate(this.modelScope(), kind, key);
  }

  static async sum<M extends typeof ModelClass>(this: M, key: string) {
    return (await this.aggregate('sum', key)) ?? 0;
  }

  static async min<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('min', key);
  }

  static async max<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('max', key);
  }

  static async avg<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('avg', key);
  }

  static async deleteAll<M extends typeof ModelClass>(this: M) {
    return await this.connector.deleteAll(this.modelScope());
  }

  static async updateAll<M extends typeof ModelClass>(this: M, attrs: Dict<any>) {
    const effectiveAttrs = { ...attrs };
    if (this.timestamps && effectiveAttrs.updatedAt === undefined) {
      effectiveAttrs.updatedAt = new Date();
    }
    return await this.connector.updateAll(this.modelScope(), effectiveAttrs);
  }

  static async findBy<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
    return await this.filterBy(filter).first<M>();
  }

  static async exists<M extends typeof ModelClass>(this: M, filter?: Filter<any>) {
    const scoped = filter === undefined ? this : this.filterBy(filter);
    return (await scoped.count()) > 0;
  }

  static async find<M extends typeof ModelClass>(this: M, id: number | string) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const record = await this.findBy<M>({ [primaryKey]: id });
    if (!record) {
      throw new NotFoundError(`${this.name || 'Record'} with ${primaryKey}=${id} not found`);
    }
    return record;
  }

  static async findOrFail<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
    const record = await this.findBy<M>(filter);
    if (!record) throw new NotFoundError('Record not found');
    return record;
  }

  static async findOrBuild<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.build<M>({ ...filter, ...createProps });
  }

  static async firstOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any = {},
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.create<M>({ ...filter, ...createProps });
  }

  static async updateOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    attrs: Dict<any>,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) {
      return (record as any).update(attrs) as Promise<InstanceType<M>>;
    }
    return this.create<M>({ ...filter, ...attrs });
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

  toJSON(): Dict<any> {
    return this.attributes();
  }

  pick(keys: string[]): Dict<any> {
    const attrs = this.attributes();
    const result: Dict<any> = {};
    for (const key of keys) {
      if (key in attrs) result[key] = attrs[key];
    }
    return result;
  }

  omit(keys: string[]): Dict<any> {
    const attrs = this.attributes();
    const skip = new Set(keys);
    const result: Dict<any> = {};
    for (const key in attrs) {
      if (!skip.has(key)) result[key] = attrs[key];
    }
    return result;
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

  belongsTo<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Promise<InstanceType<Related> | undefined> {
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(Related.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(Related.keys)[0] ?? 'id';
    const attrs = this.attributes() as Dict<any>;
    const fkValue = attrs[fk];
    if (fkValue === undefined || fkValue === null) {
      return Promise.resolve(undefined);
    }
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      const expectedType = options.typeValue ?? Related.tableName;
      if (attrs[typeKey] !== expectedType) {
        return Promise.resolve(undefined);
      }
    }
    return Related.findBy({ [pk]: fkValue }) as Promise<InstanceType<Related> | undefined>;
  }

  hasMany<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Related {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.filterBy(filter) as Related;
  }

  hasOne<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Promise<InstanceType<Related> | undefined> {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    if (pkValue === undefined || pkValue === null) {
      return Promise.resolve(undefined);
    }
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.findBy(filter) as Promise<InstanceType<Related> | undefined>;
  }

  hasManyThrough<Target extends typeof ModelClass, Through extends typeof ModelClass>(
    this: ModelClass,
    Target: Target,
    Through: Through,
    options: HasManyThroughOptions = {},
  ): Target {
    const selfModel = this.constructor as typeof ModelClass;
    const throughFk = options.throughForeignKey ?? `${singularize(selfModel.tableName)}Id`;
    const targetFk = options.targetForeignKey ?? `${singularize(Target.tableName)}Id`;
    const selfPk = options.selfPrimaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const targetPk = options.targetPrimaryKey ?? Object.keys(Target.keys)[0] ?? 'id';
    const selfPkValue = (this as any)[selfPk];
    const asyncPending = (async () => {
      const ids = await Through.filterBy({ [throughFk]: selfPkValue }).pluck(targetFk);
      return { $in: { [targetPk]: ids } } as Filter<any>;
    })();
    return Target.filterBy({ $async: asyncPending } as Filter<any>) as Target;
  }

  async increment<M extends ModelClass>(this: M, key: string, by = 1) {
    if (!this.keys) {
      throw new PersistenceError('Cannot increment a record that has not been saved');
    }
    const current = Number((this.attributes() as Dict<any>)[key] ?? 0);
    return this.update({ [key]: current + by });
  }

  async decrement<M extends ModelClass>(this: M, key: string, by = 1) {
    return this.increment(key, -by);
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

  async update<M extends ModelClass>(this: M, attrs: Dict<any>) {
    this.assign(attrs);
    return this.save();
  }

  async touch<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot touch a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const now = new Date();
    const items = await model.connector.updateAll(this.itemScope(), { updatedAt: now });
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
    return this as M;
  }

  async reload<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot reload a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const items = await model.connector.query(this.itemScope());
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
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

  isDiscarded(): boolean {
    const value = (this.attributes() as Dict<any>).discardedAt;
    return value !== null && value !== undefined;
  }

  async discard<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot discard a record that has not been saved');
    }
    (this as ModelClass).assign({ discardedAt: new Date() } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }

  async restore<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot restore a record that has not been saved');
    }
    (this as ModelClass).assign({ discardedAt: null } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }
}

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number },
  Scopes extends ScopeMap<any> = {},
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
  softDelete?: boolean;
  validators?: Validator<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >[];
  callbacks?: Callbacks<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  scopes?: Scopes;
}) {
  const connector = props.connector ? props.connector : new MemoryConnector();
  const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
  const keyDefinitions = props.keys || { id: KeyType.number };
  const timestamps = props.timestamps ?? true;
  const softDelete: 'active' | 'only' | false = props.softDelete ? 'active' : false;
  const validators = props.validators || [];
  const callbacks = props.callbacks || {};
  const scopeDefs = props.scopes || ({} as Scopes);

  const ModelSubclass = class Model extends ModelClass {
    static tableName = props.tableName;
    static filter = props.filter;
    static limit = props.limit;
    static skip = props.skip;
    static order = order;
    static keys = keyDefinitions;
    static connector = connector;
    static init = props.init as any;
    static timestamps = timestamps;
    static softDelete = softDelete;
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

    static on(
      event: keyof Callbacks<any>,
      handler: Callback<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ): () => void {
      return super.on(event, handler as Callback<any>);
    }

    static async select(...keys: [keyof Keys | keyof PersistentProps][]) {
      return super.select(...(keys as any[])) as any as Partial<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >[];
    }

    static async pluck(key: keyof Keys | keyof PersistentProps) {
      return super.pluck(key as string);
    }

    static async pluckUnique(key: keyof Keys | keyof PersistentProps) {
      return super.pluckUnique(key as string);
    }

    static async ids<M extends typeof ModelClass>(this: M) {
      return super.ids();
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

    static async last<M extends typeof ModelClass>(this: M) {
      return (await super.last()) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async count<M extends typeof ModelClass>(this: M) {
      return await super.count();
    }

    static async sum<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.sum(key as string);
    }

    static async min<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.min(key as string);
    }

    static async max<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.max(key as string);
    }

    static async avg<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.avg(key as string);
    }

    static async deleteAll<M extends typeof ModelClass>(this: M) {
      return (await super.deleteAll()) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static async updateAll<M extends typeof ModelClass>(this: M, attrs: Partial<PersistentProps>) {
      return (await super.updateAll(attrs)) as (PersistentProps & {
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

    static async find<M extends typeof ModelClass>(
      this: M,
      id: Keys[keyof Keys] extends KeyType.uuid ? string : number,
    ) {
      return (await super.find(id as number | string)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async findOrFail<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return (await super.findOrFail(filter)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async findOrBuild<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: CreateProps,
    ) {
      return (await super.findOrBuild(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async firstOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: Partial<CreateProps> = {},
    ) {
      return (await super.firstOrCreate(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async updateOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      attrs: Partial<PersistentProps>,
    ) {
      return (await super.updateOrCreate(filter, attrs)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
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

    static async createMany<M extends typeof ModelClass>(this: M, propsList: CreateProps[]) {
      return (await super.createMany(propsList)) as (InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
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

    toJSON() {
      return this.attributes();
    }

    pick<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.pick(keys as string[]) as Pick<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
    }

    omit<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.omit(keys as string[]) as Omit<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
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

    update<M extends ModelClass>(this: M, attrs: Partial<PersistentProps>): Promise<M> {
      return super.update(attrs as Dict<any>) as Promise<M>;
    }
  };

  for (const name in scopeDefs) {
    (ModelSubclass as any)[name] = function (this: typeof ModelSubclass, ...args: any[]) {
      return scopeDefs[name](this, ...args);
    };
  }

  return ModelSubclass as typeof ModelSubclass & ScopesToMethods<typeof ModelSubclass, Scopes>;
}

export default Model;
