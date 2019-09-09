import { Connector, Dict, Filter, KeyType, Order, OrderColumn, Schema, Scope } from './types';

import { MemoryConnector } from './MemoryConnector';

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.uuid }
>({
  tableName,
  init,
  filter,
  limit,
  skip,
  order = [],
  connector,
  keys = { id: KeyType.uuid } as any,
}: {
  tableName: string;
  init: (props: CreateProps) => PersistentProps;
  filter?: Filter<PersistentProps & { [P in keyof Keys]: string }>;
  limit?: number;
  skip?: number;
  order?: Order<PersistentProps>;
  connector?: Connector;
  keys?: Keys;
}) {
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
  const outerFilter = filter;

  const keyNames = Object.keys(keys) as (keyof Keys)[];
  if (keyNames.length === 0) {
    throw 'Provide at least one key';
  }

  return class M {
    static limitBy(amount: number) {
      return Model({ ...params, limit: amount });
    }

    static unlimited() {
      return Model({ ...params, limit: undefined });
    }

    static skipBy(amount: number) {
      return Model({ ...params, skip: amount });
    }

    static unskipped() {
      return Model({ ...params, skip: undefined });
    }

    static orderBy(order: Order<PersistentProps>) {
      return Model({
        ...params,
        order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
      });
    }

    static unordered() {
      return Model({ ...params, order: undefined });
    }

    static reorder(order: Order<PersistentProps>) {
      return Model({
        ...params,
        order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
      });
    }

    static queryBy(filter: Filter<PersistentProps & { [P in keyof Keys]: string }>) {
      return Model({ ...params, filter: outerFilter ? { $and: [outerFilter, filter] } : filter });
    }

    static orQueryBy(filter: Filter<PersistentProps & { [P in keyof Keys]: string }>) {
      return Model({ ...params, filter: outerFilter ? { $or: [outerFilter, filter] } : filter });
    }

    static build(props: CreateProps) {
      return new M(init(props));
    }

    static get modelScope(): Scope {
      return {
        tableName,
        filter,
        limit,
        skip,
        order: orderColumns,
      };
    }

    static async all() {
      const items = (await conn.query(this.modelScope)) as (PersistentProps &
        { [P in keyof Keys]: string })[];
      return items.map(item => {
        const keys = {} as { [P in keyof Keys]: string };
        for (const key of keyNames) {
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

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [P in keyof Keys]: string } | undefined;

    constructor(props: PersistentProps, keys?: { [P in keyof Keys]: string }) {
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
          { ...this.persistentProps, ...this.changedProps },
        ]);
        const item = items.pop();
        if (item) {
          this.keys = {} as { [P in keyof Keys]: string };
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
