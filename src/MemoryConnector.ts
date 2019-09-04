import {
  Filter,
  FilterIn,
  FilterBetween,
  FilterRaw,
  FilterSpecial,
  Dict,
  KeyType,
  Connector,
  BaseType,
  Scope,
} from './types';

import { uuid } from './util';

export type Storage = Dict<Dict<any>[]>;

const globalStorage: Storage = {};
const globalLastIds = {} as Dict<number>;

export class MemoryConnector implements Connector {
  constructor(
    private storage: Storage = globalStorage,
    private lastIds: Dict<number> = globalLastIds,
  ) {}

  private collection(tableName: string): Dict<any>[] {
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
    let items = await this.filter(this.collection(tableName), filter);
    if (skip && limit) {
      items = items.slice(skip, skip + limit);
    } else if (skip) {
      items = items.slice(skip);
    } else if (limit) {
      items = items.slice(0, limit);
    }
    // [TODO] implement order
    return items;
  }

  private async propertyFilter(items: Dict<any>[], filter: Dict<any>): Promise<Dict<any>[]> {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
    const counts: { [key: string]: number } = {};
    items.forEach(item => (counts[item.id] = 0));
    for (const key in filter) {
      items.forEach(item => {
        if (item[key] === filter[key]) {
          counts[item.id] += 1;
        }
      });
    }
    const filterCount = Object.keys(filter).length;
    return items.filter(item => counts[item.id] === filterCount);
  }

  private async andFilter(items: Dict<any>[], filters: Filter<Dict<any>>[]): Promise<Dict<any>[]> {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
    const counts: { [key: string]: number } = items.reduce(
      (obj, item) => {
        obj[item.id] = 0;
        return obj;
      },
      <{ [key: string]: number }>{},
    );
    await Promise.all(
      filters.map(async filter => {
        const filterItems = await this.filter(items, filter);
        filterItems.forEach(item => {
          counts[item.id] += 1;
        });
      }),
    );
    const filterCount = filters.length;
    return items.filter(item => counts[item.id] === filterCount);
  }

  private async notFilter(items: Dict<any>[], filter: Filter<Dict<any>>): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = 2n + O(this.filter(n))
    const array: Dict<any>[] = await this.filter(items, filter);
    const exists: { [key: string]: boolean } = {};
    array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    });
    return await items.filter(item => !exists[item.id]);
  }

  private async orFilter(items: Dict<any>[], filters: Filter<Dict<any>>[]): Promise<Dict<any>[]> {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter(n)))
    const arrays: Dict<any>[][] = await Promise.all(
      filters.map(async filter => await this.filter(items, filter)),
    );
    const exists: { [key: string]: boolean } = {};
    arrays.forEach(array =>
      array.forEach(item => {
        exists[item.id] = exists[item.id] || true;
      }),
    );
    return items.filter(item => exists[item.id]);
  }

  private async inFilter(
    items: Dict<any>[],
    filter: Partial<FilterIn<Dict<any>>>,
  ): Promise<Dict<any>[]> {
    // Cost: (1, n, m) => O(n, m) = n * m;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => {
        const values = filter[key];
        if (Array.isArray(values)) {
          for (const value of values) {
            if (item[key] === value) return true;
          }
        }
        return false;
      });
    }
    throw '[TODO] Should not reach error';
  }

  private async notInFilter(
    items: Dict<any>[],
    filter: Partial<FilterIn<Dict<any>>>,
  ): Promise<Dict<any>[]> {
    // Cost: (1, n, m) => O(n, m) = n * m;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => {
        const values = filter[key];
        if (Array.isArray(values)) {
          for (const value of values) {
            if (item[key] === value) return false;
          }
        }
        return true;
      });
    }
    throw '[TODO] Should not reach error';
  }

  private async nullFilter(items: Dict<any>[], key: string): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] === null || item[key] === undefined);
  }

  private async notNullFilter(items: Dict<any>[], key: string): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] !== null && item[key] !== undefined);
  }

  private async betweenFilter(
    items: Dict<any>[],
    filter: Partial<FilterBetween<Dict<any>>>,
  ): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const filterBetween = filter[key];
      if (filterBetween !== undefined) {
        return items.filter(
          item => filterBetween.to >= item[key] && item[key] >= filterBetween.from,
        );
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async notBetweenFilter(
    items: Dict<any>[],
    filter: Partial<FilterBetween<Dict<any>>>,
  ): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const filterBetween = filter[key];
      if (filterBetween !== undefined) {
        return items.filter(item => filterBetween.to < item[key] || item[key] < filterBetween.from);
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async gtFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] > filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async gteFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] >= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async ltFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] < filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async lteFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] <= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async rawFilter(items: Dict<any>[], filter: FilterRaw): Promise<Dict<any>[]> {
    // Cost: (1, n, 1) => O(n) = n;
    const fn = eval(filter.$query);
    const params = filter.$bindings;
    if (Array.isArray(params)) {
      return items.filter(item => fn(item, ...params));
    } else {
      return items.filter(item => fn(item, params));
    }
  }

  private async asyncFilter(
    items: Dict<any>[],
    asyncFilter: Promise<Filter<Dict<any>>>,
  ): Promise<Dict<any>[]> {
    const filter = await asyncFilter;
    if (filter && Object.keys(filter).length > 0) {
      return this.filter(items, filter);
    } else {
      return items;
    }
  }

  private async specialFilter(
    items: Dict<any>[],
    filter: FilterSpecial<Dict<any>>,
  ): Promise<Dict<any>[]> {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    if (filter.$and !== undefined) return await this.andFilter(items, filter.$and);
    if (filter.$or !== undefined) return await this.orFilter(items, filter.$or);
    if (filter.$not !== undefined) return await this.notFilter(items, filter.$not);
    if (filter.$in !== undefined) return await this.inFilter(items, filter.$in);
    if (filter.$notIn !== undefined) return await this.notInFilter(items, filter.$notIn);
    if (filter.$null !== undefined) return await this.nullFilter(items, filter.$null as string);
    if (filter.$notNull !== undefined)
      return await this.notNullFilter(items, filter.$notNull as string);
    if (filter.$between !== undefined) return await this.betweenFilter(items, filter.$between);
    if (filter.$notBetween !== undefined)
      return await this.notBetweenFilter(items, filter.$notBetween);
    if (filter.$gt !== undefined) return await this.gtFilter(items, filter.$gt);
    if (filter.$gte !== undefined) return await this.gteFilter(items, filter.$gte);
    if (filter.$lt !== undefined) return await this.ltFilter(items, filter.$lt);
    if (filter.$lte !== undefined) return await this.lteFilter(items, filter.$lte);
    if (filter.$raw !== undefined) return await this.rawFilter(items, filter.$raw);
    if (filter.$async !== undefined) return await this.asyncFilter(items, filter.$async);
    throw '[TODO] Should not reach error';
  }

  private async filter(items: Dict<any>[], filter: Filter<Dict<any>> = {}): Promise<Dict<any>[]> {
    for (const key in filter) {
      if (key.startsWith('$')) {
        return await this.specialFilter(items, <FilterSpecial<Dict<any>>>filter);
      }
    }
    return await this.propertyFilter(items, <Partial<Dict<any>>>filter);
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    return this.items(scope);
  }

  async count(scope: Scope): Promise<number> {
    try {
      const items = await this.items(scope);
      return items.length;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    try {
      const items = await this.items(scope);
      return items.map(item => {
        const obj = {} as Dict<any>;
        for (const key of keys) {
          obj[key] = item[key];
        }
        return obj;
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<number> {
    try {
      const items = await this.items(scope);
      items.forEach(item => {
        for (const key in attrs) {
          item[key] = attrs[key];
        }
      });
      return Promise.resolve(items.length);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async deleteAll(scope: Scope): Promise<number> {
    try {
      const items = await this.items(scope);
      const count = items.length;
      const collection = this.collection(scope.tableName);
      let index = 0;
      while (index < collection.length) {
        if (items.includes(collection[index])) {
          collection.splice(index, 1);
        } else {
          index += 1;
        }
      }

      return count;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async insert(tableName: string, keys: Dict<KeyType>, item: Dict<any>): Promise<Dict<any>> {
    try {
      const keyValues = {} as Dict<any>;
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
      return Promise.resolve(attributes);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const fn = eval(query);
    if (Array.isArray(bindings)) {
      return fn(this.storage, ...bindings);
    } else {
      return fn(this.storage, bindings);
    }
  }
}

export default MemoryConnector;
