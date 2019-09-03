import {
  Connector,
  Dict,
  Filter,
  FunctionModel,
  KeyType,
  Order,
  OrderColumn,
  Schema,
  Scope,
} from './types';

import { MemoryConnector } from './MemoryConnector';
import { uuid } from './util';

export function mapKeys<T extends Dict<KeyType>>(keys: T): { [P in keyof T]: string } {
  return Object.keys(keys).reduce(
    (obj, key: keyof T) => {
      obj[key] = uuid();
      return obj;
    },
    {} as { [P in keyof T]: string },
  );
}

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  K extends Dict<KeyType> = { id: KeyType.uuid }
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
  init: FunctionModel<CreateProps, PersistentProps>;
  filter?: Filter<PersistentProps>;
  limit?: number;
  skip?: number;
  order?: Order<PersistentProps>;
  connector?: Connector;
  keys?: K;
}) {
  const conn = connector ? connector : new MemoryConnector();

  const keyNames = Object.keys(keys);
  if (keyNames.length === 0) {
    throw 'Provide at least one key';
  }

  function isCreateProps(
    props: CreateProps | (PersistentProps & { [P in keyof K]: string }),
  ): props is CreateProps {
    return (props as { [P in keyof K]: string })[Object.keys(keys)[0]] === undefined;
  }

  return class Model {
    static currentFilter = filter;
    static currentOrder = Array.isArray(order) ? order : [order];
    static currentLimit = limit;
    static currentSkip = skip;

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [P in keyof K]: string } | undefined;

    static limitBy(amount: number) {
      return class extends Model {
        static currentLimit: number | undefined = amount;
      };
    }

    static get unlimited() {
      return class extends Model {
        static currentLimit: number | undefined;
      };
    }

    // static skipBy(amount: number) {
    //   return class extends Model {
    //     static currentSkip: number | undefined = amount;
    //   };
    // }

    // static get unskiped() {
    //   return class extends Model {
    //     static currentSkip: number | undefined;
    //   };
    // }

    // static orderBy(order: Order<PersistentProps>) {
    //   const currentOrder = [...this.currentOrder, ...(Array.isArray(order) ? order : [order])];
    //   return class extends Model {
    //     static currentOrder = currentOrder;
    //   };
    // }

    // static get unordered() {
    //   return class extends Model {
    //     static currentOrder: OrderColumn<PersistentProps>[] = [];
    //   };
    // }

    // static reorder(order: Order<PersistentProps>) {
    //   return this.unordered.orderBy(order);
    // }

    static build(props: CreateProps) {
      return new Model(props);
    }

    // static queryBy(filter: Filter<PersistentProps>) {
    //   const currentFilter = this.currentFilter ? { $and: [this.currentFilter, filter] } : filter;
    //   return class extends Model {
    //     static currentFilter: Filter<PersistentProps> | undefined = currentFilter;
    //   };
    // }

    static async all() {
      const filter: DynamoDB.DocumentClient.FilterConditionMap = {};
      // const response = await db
      //   .scan({
      //     ...defaultDbParams,
      //     Limit: this.currentLimit,
      //     ScanFilter: filter,
      //   })
      //   .promise();
      const items = /*response.Items ||*/ [] as (PersistentProps & { [P in keyof K]: string })[];
      return items.map(item => new Model(item));
    }

    static async first() {
      const items = await this.limitBy(1).all();
      return items.pop();
    }

    constructor(props: CreateProps | (PersistentProps & { [P in keyof K]: string })) {
      if (isCreateProps(props)) {
        this.persistentProps = init(props);
      } else {
        for (const key in props) {
          const keys = {} as { [P in keyof K]: string };
          const persistentProps = {} as PersistentProps;
          if (keyNames.includes(key)) {
            keys[key as keyof K] = props[key];
          } else {
            persistentProps[key as keyof PersistentProps] = props[key];
          }
          this.persistentProps = persistentProps;
          this.keys = keys;
        }
      }
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
        tableName,
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
          await conn.updateAll(this.itemScope, this.changedProps);
          this.persistentProps = { ...this.persistentProps, ...this.changedProps };
          this.changedProps = {};
        }
      } else {
        const keys = keyNames.reduce(
          (obj, key: keyof K) => {
            obj[key] = uuid();
            return obj;
          },
          {} as { [P in keyof K]: string },
        );
        // await db.put({ ...defaultDbParams, Item: { ...this.persistentProps, ...keys } }).promise();
        this.keys = keys;
      }
      return this;
    }
  };
}
