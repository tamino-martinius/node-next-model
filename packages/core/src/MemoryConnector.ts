import { filterList } from './FilterEngine';
import {
  type BaseType,
  type Connector,
  type Dict,
  KeyType,
  type Scope,
  SortDirection,
} from './types';

import { clone, uuid } from './util';

export type Storage = Dict<Dict<any>[]>;

const globalStorage: Storage = {};
const globalLastIds: Dict<number> = {};

export class MemoryConnector implements Connector {
  private storage: Storage;
  private lastIds: Dict<number>;

  constructor(props?: { storage?: Storage; lastIds?: Dict<number> }) {
    this.storage = props?.storage || globalStorage;
    this.lastIds = props?.lastIds || globalLastIds;
  }

  private collection(tableName: string): Dict<any>[] {
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init pattern
    return (this.storage[tableName] = this.storage[tableName] || []);
  }

  private nextId(tableName: string): number {
    this.lastIds[tableName] = this.lastIds[tableName] || 0;
    return ++this.lastIds[tableName];
  }

  private async items({
    tableName,
    filter = {},
    limit,
    skip,
    order = [],
  }: Scope): Promise<Dict<any>[]> {
    let items = await filterList(this.collection(tableName), filter);
    if (skip && limit) {
      items = items.slice(skip, skip + limit);
    } else if (skip) {
      items = items.slice(skip);
    } else if (limit) {
      items = items.slice(0, limit);
    }

    for (let orderIndex = order.length - 1; orderIndex >= 0; orderIndex -= 1) {
      const key = order[orderIndex].key;
      const dir = order[orderIndex].dir || SortDirection.Asc;

      items = items.sort((a, b) => {
        if (a[key as string] > b[key as string]) {
          return dir;
        }
        if (a[key as string] < b[key as string]) {
          return -dir;
        }
        if (
          (a[key as string] === null || a[key as string] === undefined) &&
          b[key as string] !== null &&
          b[key as string] !== undefined
        ) {
          return dir;
        }
        if (
          (b[key as string] === null || b[key as string] === undefined) &&
          a[key as string] !== null &&
          a[key as string] !== undefined
        ) {
          return -dir;
        }
        return 0;
      });
    }

    return items;
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    return clone(items);
  }

  async count(scope: Scope): Promise<number> {
    const items = await this.items(scope);
    return items.length;
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    return items.map((item) => {
      const obj: Dict<any> = {};
      for (const key of keys) {
        obj[key] = item[key];
      }
      return obj;
    });
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    items.forEach((item) => {
      for (const key in attrs) {
        item[key] = attrs[key];
      }
    });
    return clone(items);
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const items = await this.items(scope);
    const result = clone(items);
    const collection = this.collection(scope.tableName);
    let index = 0;
    while (index < collection.length) {
      if (items.includes(collection[index])) {
        collection.splice(index, 1);
      } else {
        index += 1;
      }
    }
    return result;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    const result: Dict<any>[] = [];
    for (const item of items) {
      const keyValues: Dict<any> = {};
      for (const key in keys) {
        switch (keys[key]) {
          case KeyType.uuid:
            keyValues[key] = uuid();
            break;
          case KeyType.number:
            keyValues[key] = this.nextId(tableName);
            break;
        }
      }
      const attributes = { ...item, ...keyValues };
      this.collection(tableName).push(attributes);
      result.push(clone(attributes));
    }
    return result;
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const fn = compileExecute(query);
    if (Array.isArray(bindings)) {
      return fn(this.storage, ...bindings);
    }
    return fn(this.storage, bindings);
  }
}

function compileExecute(source: string): (...args: any[]) => any[] {
  // biome-ignore lint/security/noGlobalEval: MemoryConnector.execute evaluates raw query strings by design
  return eval(source);
}

export default MemoryConnector;
