import {
  ModelStatic,
  ModelConstructor,
  Filter,
  FilterIn,
  FilterBetween,
  FilterProperty,
  Identifiable,
  FilterCompare,
  FilterRaw,
  FilterSpecial,
} from './types';

export interface Storage {
  [key: string]: any[],
}

const globalStorage: Storage = {};
let uuid: number = 0;

export interface ConnectorConstructor<S extends Identifiable> {
  query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  count(model: ModelStatic<S>): Promise<number>;
  updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<ModelConstructor<S>[]>;
  deleteAll(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  reload(model: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined>;
  create(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  update(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  delete(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
};

export class Connector<S extends Identifiable> implements ConnectorConstructor<S> {
  private storage: Storage;

  constructor(storage: Storage = globalStorage) {
    this.storage = storage;
  }

  private collection(model: ModelStatic<S>): S[] {
    return this.storage[model.modelName] = this.storage[model.modelName] || [];
  }

  private items(model: ModelStatic<S>): S[] {
    return this.filter(this.collection(model), model.strictFilter);
  }

  private propertyFilter(items: S[], filter: FilterProperty<S>): S[] {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
    const counts: { [key: string]: number } = {};
    items.forEach(item => counts[item.id] = 0);
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

  private andFilter(items: S[], filters: Filter<S>[]): S[] {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
    const counts: { [key: string]: number } = {};
    items.forEach(item => counts[item.id] = 0);
    filters.map((filter) => {
      this.filter(items, filter).forEach(item => {
        counts[item.id] += 1;
      });
    });
    const filterCount = filters.length;
    return items.filter(item => counts[item.id] === filterCount);
  }

  private notFilter(items: S[], filter: Filter<S>): S[] {
    // Cost: (1, n, 1) => O(n) = 2n + O(this.filter(n))
    const array: S[] = this.filter(items, filter);
    const exists: { [key: string]: boolean } = {};
    array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    });
    return items.filter(item => !exists[item.id]);
  }

  private orFilter(items: S[], filters: Filter<S>[]): S[] {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter(n)))
    const arrays: S[][] = filters.map((filter) => this.filter(items, filter));
    const exists: { [key: string]: boolean } = {};
    arrays.forEach(array => array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    }));
    return items.filter(item => exists[item.id]);
  }

  private inFilter(items: S[], filter: FilterIn<S>): S[] {
    // Cost: (1, n, m) => O(n, m) = n * m;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => {
        const values = filter[key];
        for (const value of values) {
          if (item[key] === value) return true;
        }
        return false;
      });
    }
    throw '[TODO] Should not reach error';
  }

  private notInFilter(items: S[], filter: FilterIn<S>): S[] {
    // Cost: (1, n, m) => O(n, m) = n * m;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => {
        const values = filter[key];
        for (const value of values) {
          if (item[key] === value) return false;
        }
        return true;
      });
    }
    throw '[TODO] Should not reach error';
  }

  private nullFilter(items: S[], key: keyof S): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] === null || item[key] === undefined);
  }

  private notNullFilter(items: S[], key: keyof S): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] !== null && item[key] !== undefined);
  }

  private betweenFilter(items: S[], filter: FilterBetween<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => filter[key].to >= item[key] && item[key] >= filter[key].from);
    }
    throw '[TODO] Should not reach error';
  }

  private notBetweenFilter(items: S[], filter: FilterBetween<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => filter[key].to < item[key] || item[key] < filter[key].from);
    }
    throw '[TODO] Should not reach error';
  }

  private gtFilter(items: S[], filter: FilterCompare<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] > filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private gteFilter(items: S[], filter: FilterCompare<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] >= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private ltFilter(items: S[], filter: FilterCompare<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] < filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private lteFilter(items: S[], filter: FilterCompare<S>): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] <= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private rawFilter(items: S[], filter: FilterRaw): S[] {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    const fn = eval(filter.$query);
    const params = filter.$bindings;
    if (Array.isArray(params)) {
      for (const key in filter) {
        return items.filter(item => fn(item, ...params));
      }
    } else {
      for (const key in filter) {
        return items.filter(item => fn(item, params));
      }
    }
    throw '[TODO] Should not reach error';
  }

  private specialFilter(items: S[], filter: FilterSpecial<S>): S[] {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    if (filter.$and !== undefined)
      return this.andFilter(items, filter.$and);
    if (filter.$or !== undefined)
      return this.orFilter(items, filter.$or);
    if (filter.$not !== undefined)
      return this.notFilter(items, filter.$not);
    if (filter.$in !== undefined)
      return this.inFilter(items, filter.$in);
    if (filter.$notIn !== undefined)
      return this.notInFilter(items, filter.$notIn);
    if (filter.$null !== undefined)
      return this.nullFilter(items, filter.$null);
    if (filter.$notNull !== undefined)
      return this.notNullFilter(items, filter.$notNull);
    if (filter.$between !== undefined)
      return this.betweenFilter(items, filter.$between);
    if (filter.$notBetween !== undefined)
      return this.notBetweenFilter(items, filter.$notBetween);
    if (filter.$gt !== undefined)
      return this.gtFilter(items, filter.$gt);
    if (filter.$gte !== undefined)
      return this.gteFilter(items, filter.$gte);
    if (filter.$lt !== undefined)
      return this.ltFilter(items, filter.$lt);
    if (filter.$lte !== undefined)
      return this.lteFilter(items, filter.$lte);
    if (filter.$raw !== undefined)
      return this.rawFilter(items, filter.$raw);
    throw '[TODO] Should not reach error';
  }

  private filter(items: S[], filter: Filter<S>): S[] {
    for (const key in filter) {
      if (key.startsWith('$')) {
        return this.specialFilter(items, <FilterSpecial<S>>filter);
      }
    }
    return this.propertyFilter(items, <FilterProperty<S>>filter);
  }

  query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]> {
    try {
      const items = this.items(model);
      return Promise.resolve(items.map(item => new model(item)));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  count(model: ModelStatic<S>): Promise<number> {
    try {
      const items = this.items(model);
      return Promise.resolve(items.length);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<ModelConstructor<S>[]> {
    try {
      const items = this.items(model);
      items.forEach(item => {
        for (const key in attrs) {
          if (key !== model.identifier) {
            // @ts-ignore
            item[key] = attrs[key];
          }
        }
      });
      return Promise.resolve(items.map(item => new model(item)));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  deleteAll(model: ModelStatic<S>): Promise<ModelConstructor<S>[]> {
    try {
      const items = this.items(model);
      const exists: { [key: string]: boolean } = {};
      items.forEach(item => {
        exists[item.id] = exists[item.id] || true;
      });

      const collection = this.collection(model);
      for (let i = collection.length - 1; i >= 0; i--) {
        if (exists[collection[i].id]) {
          collection.splice(i, 1);
        }
      }
      return Promise.resolve(items.map(item => {
        delete item.id;
        return new model(item);
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  reload(instance: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined> {
    try {
      const model = instance.model;
      const collection = this.collection(model);
      for (const item of collection) {
        if (item.id === instance.id) {
          return Promise.resolve(new model(item));
        }
      }
      return Promise.resolve(undefined);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    try {
      instance.id = ++uuid;
      this.collection(instance.model).push(instance.attributes);
      return Promise.resolve(instance);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  update(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    try {
      const model = instance.model;
      const collection = this.collection(model);
      for (const item of collection) {
        if (item.id === instance.id) {
          const attrs = instance.attributes;
          for (const key in attrs) {
            if (key !== model.identifier) {
              item[key] = attrs[key];
            }
          }
          return Promise.resolve(instance);
        }
      }
      return Promise.reject('[TODO] Cant find error');
    } catch (e) {
      return Promise.reject(e);
    }
  }

  delete(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    try {
      const model = instance.model;
      const collection = this.collection(model);
      for (let i = 0; i < collection.length; i++) {
        if (collection[i].id === instance.id) {
          collection.splice(i, 1);
          instance.id = undefined;
          return Promise.resolve(instance);
        }
      }
      return Promise.reject('[TODO] Cant find error');
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
