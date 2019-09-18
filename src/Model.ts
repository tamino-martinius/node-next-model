import { Connector, Dict, Filter, KeyType, Order, OrderColumn, Schema, Scope } from './types';

import { MemoryConnector } from './MemoryConnector';

export class ModelClass {
  static tableName: string;
  static filter: Filter<any> | undefined;
  static limit: number | undefined;
  static skip: number | undefined;
  static order: OrderColumn<any>[];
  static keys: Dict<KeyType>;
  static connector: Connector;
  static init: (props: Dict<any>) => Dict<any>;

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

  static build<M extends typeof ModelClass>(this: M, createProps: Dict<any>) {
    return new this(this.init(createProps)) as InstanceType<M>;
  }

  static buildScoped<M extends typeof ModelClass>(this: M, createProps: Dict<any>) {
    return new this(this.init({ ...this.filter, ...createProps })) as InstanceType<M>;
  }

  static create<M extends typeof ModelClass>(this: M, createProps: Dict<any>) {
    return this.build<M>(createProps).save() as InstanceType<M>;
  }

  static createScoped<M extends typeof ModelClass>(this: M, props: Dict<any>) {
    return this.buildScoped<M>(props).save();
  }

  static async all<M extends typeof ModelClass>(this: M) {
    const items = await this.connector.query(this.modelScope());
    return items.map(item => {
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

  static async select(...keys: string[]) {
    const items = await this.connector.select(this.modelScope(), ...keys);
    return items;
  }

  static async pluck(key: string) {
    const items = await this.select(key as any);
    return items.map(item => item[key]);
  }

  persistentProps: Dict<any>;
  changedProps: Dict<any> = {};
  keys: Dict<any> | undefined;

  constructor(props: Dict<any>, keys?: Dict<any>) {
    this.persistentProps = props;
    this.keys = keys;

    for (const key in this.persistentProps) {
      Object.defineProperty(this, key, {
        get: () => this.attributes[key],
        set: value => this.assign({ [key]: value }),
      });
    }

    const model = this.constructor as typeof ModelClass;

    for (const key in model.keys) {
      Object.defineProperty(this, key, {
        get: () => (this.keys ? this.keys[key] : undefined),
      });
    }
  }

  get isPersistent() {
    return this.keys !== undefined;
  }

  get isNew() {
    return this.keys === undefined;
  }

  get attributes(): Dict<any> {
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

  get itemScope(): Scope {
    const model = this.constructor as typeof ModelClass;
    return {
      tableName: model.tableName,
      filter: this.keys,
      limit: 1,
      skip: 0,
      order: [],
    };
  }

  async save<M extends ModelClass>(this: M) {
    const model = this.constructor as typeof ModelClass;

    if (this.keys) {
      const changedKeys = Object.keys(this.changedProps);
      if (changedKeys.length > 0) {
        const items = await model.connector.updateAll(this.itemScope, this.changedProps);
        const item = items.pop();
        if (item) {
          for (const key in model.keys) {
            this.keys[key] = item[key];
            delete item[key];
          }
          this.persistentProps = item;
          this.changedProps = {};
        } else {
          throw 'Item not found';
        }
      }
    } else {
      const items = await model.connector.batchInsert(model.tableName, model.keys, [
        { ...this.persistentProps, ...this.changedProps },
      ]);
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
        throw 'Failed to insert item';
      }
    }
    return this as M;
  }
}

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number }
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
}) {
  const connector = props.connector ? props.connector : new MemoryConnector();
  const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
  const keyDefinitions = props.keys || { id: KeyType.number };

  return class ModelClass {
    static tableName = props.tableName;
    static filter = props.filter;
    static limit = props.limit;
    static skip = props.skip;
    static order = order;

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

    static orderBy<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      const newOrder = [...this.order, ...(Array.isArray(order) ? order : [order])];
      return class extends (this as typeof ModelClass) {
        static order = newOrder;
      } as M;
    }

    static unordered<M extends typeof ModelClass>(this: M) {
      return class extends (this as typeof ModelClass) {
        static order: OrderColumn<
          PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
        >[] = [];
      } as M;
    }

    static reorder<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return class extends (this as typeof ModelClass) {
        static order = Array.isArray(order) ? order : [order];
      } as M;
    }

    static filterBy<M extends typeof ModelClass>(
      this: M,
      andFilter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      ///@ts-ignore
      let filter:
        | Filter<
            PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
          >
        | undefined = andFilter;
      if (this.filter) {
        for (const key in this.filter) {
          if ((this.filter as any)[key] !== undefined && (andFilter as any)[key] !== undefined) {
            ///@ts-ignore
            filter = { $and: [filter, andFilter] };
            break;
          }
          (filter as any)[key] = (this.filter as any)[key];
        }
      }
      ///@ts-ignore
      if (Object.keys(andFilter).length === 0) filter = this.filter;
      ///@ts-ignore
      return class extends (this as typeof ModelClass) {
        static filter = filter;
      } as M;
    }

    static orFilterBy<M extends typeof ModelClass>(
      this: M,
      orFilter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      const filter =
        Object.keys(orFilter).length === 0
          ? this.filter
          : this.filter
          ? { $or: [this.filter, orFilter] }
          : orFilter;
      ///@ts-ignore
      return class extends (this as typeof ModelClass) {
        static filter = filter;
      } as M;
    }

    static unfiltered<M extends typeof ModelClass>(this: M) {
      return class extends (this as typeof ModelClass) {
        static filter = undefined;
      } as M;
    }

    static build<M extends typeof ModelClass>(this: M, createProps: CreateProps) {
      return new this(props.init(createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static buildScoped<M extends typeof ModelClass>(this: M, createProps: Partial<CreateProps>) {
      return new this(
        ///@ts-ignore
        props.init({ ...props.filter, ...createProps } as CreateProps),
      ) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static create<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return this.build<M>(props).save();
    }

    static createScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return this.buildScoped<M>(props).save();
    }

    static async all<M extends typeof ModelClass>(this: M) {
      const items = (await connector.query(this.modelScope())) as (PersistentProps &
        { [K in keyof Keys]: string })[];
      return items.map(item => {
        const keys = {} as { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
        for (const key in keyDefinitions) {
          keys[key as keyof Keys] = item[key];
          delete item[key];
        }
        return new this(item, keys) as InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
      });
    }

    static async first<M extends typeof ModelClass>(this: M) {
      const items = await this.limitBy(1).all<M>();
      return items.pop();
    }

    static async select(...keys: [keyof Keys | keyof PersistentProps][]) {
      const items = (await connector.select(this.modelScope(), ...(keys as any[]))) as Partial<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >[];
      return items;
    }

    static async pluck(key: keyof Keys | keyof PersistentProps) {
      const items = await this.select(key as any);
      return items.map(item => item[key]);
    }

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number } | undefined;

    constructor(
      props: PersistentProps,
      keys?: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number },
    ) {
      this.persistentProps = props as PersistentProps;
      this.keys = keys;

      for (const key in this.persistentProps) {
        Object.defineProperty(this, key, {
          get: () => this.attributes[key],
          set: value => this.assign({ [key]: value } as Partial<PersistentProps>),
        });
      }

      for (const key in keyDefinitions) {
        Object.defineProperty(this, key, {
          get: () => (this.keys ? this.keys[key] : undefined),
        });
      }
    }

    get isPersistent() {
      return this.keys !== undefined;
    }

    get isNew() {
      return this.keys === undefined;
    }

    get attributes() {
      ///@ts-ignore
      return { ...this.persistentProps, ...this.changedProps, ...this.keys };
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

    get itemScope(): Scope {
      return {
        tableName: props.tableName,
        filter: this.keys,
        limit: 1,
        skip: 0,
        order: [],
      };
    }

    async save<M extends ModelClass>(this: M) {
      if (this.keys) {
        const changedKeys = Object.keys(this.changedProps);
        if (changedKeys.length > 0) {
          const items = await connector.updateAll(this.itemScope, this.changedProps);
          const item = items.pop();
          if (item) {
            for (const key in keyDefinitions) {
              this.keys[key as keyof Keys] = item[key];
              delete item[key];
            }
            this.persistentProps = item as PersistentProps;
            this.changedProps = {};
          } else {
            throw 'Item not found';
          }
        }
      } else {
        const items = await connector.batchInsert(props.tableName, keyDefinitions, [
          ///@ts-ignore
          { ...this.persistentProps, ...this.changedProps },
        ]);
        const item = items.pop();
        if (item) {
          this.keys = {} as { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
          for (const key in keyDefinitions) {
            this.keys[key as keyof Keys] = item[key];
            delete item[key];
          }
          this.persistentProps = item as PersistentProps;
          this.changedProps = {};
        } else {
          throw 'Failed to insert item';
        }
      }
      return this as M;
    }
  };
}

export default Model;
