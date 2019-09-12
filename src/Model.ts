import {
  Connector,
  Dict,
  Filter,
  KeyType,
  ModelStatic,
  Order,
  OrderColumn,
  Schema,
  Scope,
} from './types';

import { MemoryConnector } from './MemoryConnector';

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number }
>({
  tableName,
  init,
  filter,
  limit,
  skip,
  order = [],
  connector,
  keys = { id: KeyType.number } as any,
}: {
  tableName: string;
  init: (props: CreateProps) => PersistentProps;
  filter?: Filter<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  limit?: number;
  skip?: number;
  order?: Order<PersistentProps>;
  connector?: Connector;
  keys?: Keys;
}): ModelStatic<CreateProps, PersistentProps, Keys> {
  const conn = connector ? connector : new MemoryConnector();
  const params = {
    tableName,
    init,
    filter,
    limit,
    skip,
    order,
    connector,
    keys,
  };

  const orderColumns: OrderColumn<PersistentProps>[] = order
    ? Array.isArray(order)
      ? order
      : [order]
    : [];

  const modelScope: Scope = {
    tableName,
    filter,
    limit,
    skip,
    order: orderColumns,
  };

  ///@ts-ignore
  return class M {
    static limitBy(amount: number) {
      return Model({ ...params, limit: amount });
    }

    static get unlimited() {
      return Model({ ...params, limit: undefined });
    }

    static skipBy(amount: number) {
      return Model({ ...params, skip: amount });
    }

    static get unskipped() {
      return Model({ ...params, skip: undefined });
    }

    static orderBy(order: Order<PersistentProps>) {
      return Model({
        ...params,
        order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
      });
    }

    static get unordered() {
      return Model({ ...params, order: undefined });
    }

    static reorder(order: Order<PersistentProps>) {
      return Model({
        ...params,
        order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
      });
    }

    static filterBy(
      andFilter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      if (Object.keys(andFilter).length === 0) {
        return Model(params); // Short circuit if no new filters are passed
      }
      if (filter) {
        ///@ts-ignore
        const flatFilter = { ...filter };
        for (const key in andFilter) {
          if ((flatFilter as any)[key] !== undefined && (andFilter as any)[key] !== undefined) {
            ///@ts-ignore
            return Model({ ...params, filter: { $and: [filter, andFilter] } });
          }
          (flatFilter as any)[key] = (andFilter as any)[key];
        }
        ///@ts-ignore
        return Model({ ...params, filter: flatFilter });
      }
      ///@ts-ignore
      return Model({ ...params, filter: andFilter });
    }

    static orFilterBy(
      orFilter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      if (Object.keys(orFilter).length === 0) {
        ///@ts-ignore
        return Model(params); // Short circuit if no new filters are passed
      }
      ///@ts-ignore
      return Model({ ...params, filter: filter ? { $or: [filter, orFilter] } : orFilter });
    }

    static get unfiltered() {
      return Model({ ...params, filter: undefined });
    }

    static build(props: CreateProps) {
      return new M(init(props));
    }

    static buildScoped(props: Partial<CreateProps>) {
      ///@ts-ignore
      return new M(init({ ...filter, ...props } as CreateProps));
    }

    static create(props: CreateProps) {
      return this.build(props).save();
    }

    static createScoped(props: Partial<CreateProps>) {
      return this.buildScoped(props).save();
    }

    static async all() {
      const items = (await conn.query(modelScope)) as (PersistentProps &
        { [K in keyof Keys]: string })[];
      return items.map(item => {
        const keys = {} as { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
        for (const key in keys) {
          keys[key] = item[key];
          delete item[key];
        }
        return new M(item, keys);
      });
    }

    static async first() {
      const items = await this.limitBy(1).all();
      return items.pop();
    }

    static async select(...keys: [keyof Keys | keyof PersistentProps][]) {
      const items = (await conn.select(modelScope, ...(keys as any[]))) as Partial<
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

    assign(props: Partial<PersistentProps>) {
      for (const key in props) {
        if (this.persistentProps[key] !== props[key]) {
          this.changedProps[key] = props[key];
        } else {
          delete this.changedProps[key];
        }
      }
      return this;
    }

    get itemScope(): Scope {
      return {
        tableName: tableName,
        filter: this.keys,
        limit: 1,
        skip: 0,
        order: [],
      };
    }

    async save() {
      if (this.keys) {
        const changedKeys = Object.keys(this.changedProps);
        if (changedKeys.length > 0) {
          const items = await conn.updateAll(this.itemScope, this.changedProps);
          const item = items.pop();
          if (item) {
            for (const key in keys) {
              this.keys[key] = item[key];
              delete item[key];
            }
            this.persistentProps = item as PersistentProps;
            this.changedProps = {};
          } else {
            throw 'Item not found';
          }
        }
      } else {
        const items = await conn.batchInsert(tableName, keys, [
          ///@ts-ignore
          { ...this.persistentProps, ...this.changedProps },
        ]);
        const item = items.pop();
        if (item) {
          this.keys = {} as { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
          for (const key in keys) {
            this.keys[key] = item[key];
            delete item[key];
          }
          this.persistentProps = item as PersistentProps;
          this.changedProps = {};
        } else {
          throw 'Failed to insert item';
        }
      }
      return this;
    }
  };
}
