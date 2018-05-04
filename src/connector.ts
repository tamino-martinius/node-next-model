import {
  ModelStatic,
  ModelConstructor,
  Filter,
  FilterIn,
  FilterBetween,
  Identifiable,
  FilterRaw,
  FilterSpecial,
  Bindings,
  Storage,
  ConnectorConstructor,
} from './types';

const globalStorage: Storage = {};
let uuid: number = 0;

export class Connector<S extends Identifiable> implements ConnectorConstructor<S> {
  private storage: Storage;

  constructor(storage: Storage = globalStorage) {
    this.storage = storage;
  }

  private collection(model: ModelStatic<S>): S[] {
    return this.storage[model.modelName] = this.storage[model.modelName] || [];
  }

  private async items(model: ModelStatic<S>): Promise<S[]> {
    let items = await this.filter(this.collection(model), model.strictFilter);
    if (model.skip > 0 && model.limit < Number.MAX_SAFE_INTEGER) {
      items = items.slice(model.skip, model.skip + model.limit);
    } else if (model.skip > 0) {
      items = items.slice(model.skip);
    } else if (model.limit < Number.MAX_SAFE_INTEGER) {
      items = items.slice(0, model.limit);
    }
    return items;
  }

  private async propertyFilter(items: S[], filter: Partial<S>): Promise<S[]> {
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

  private async andFilter(items: S[], filters: Filter<S>[]): Promise<S[]> {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
    const counts: { [key: string]: number } = items.reduce((obj, item) => {
      obj[item.id] = 0;
      return obj;
    }, <{ [key: string]: number }>{});
    await Promise.all(filters.map(async (filter) => {
      const filterItems = await this.filter(items, filter);
      filterItems.forEach(item => {
        counts[item.id] += 1;
      });
    }));
    const filterCount = filters.length;
    return items.filter(item => counts[item.id] === filterCount);
  }

  private async notFilter(items: S[], filter: Filter<S>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = 2n + O(this.filter(n))
    const array: S[] = await this.filter(items, filter);
    const exists: { [key: string]: boolean } = {};
    array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    });
    return await items.filter(item => !exists[item.id]);
  }

  private async orFilter(items: S[], filters: Filter<S>[]): Promise<S[]> {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter(n)))
    const arrays: S[][] = await Promise.all(filters.map(
      async (filter) => await this.filter(items, filter)
    ));
    const exists: { [key: string]: boolean } = {};
    arrays.forEach(array => array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    }));
    return items.filter(item => exists[item.id]);
  }

  private async inFilter(items: S[], filter: Partial<FilterIn<S>>): Promise<S[]> {
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

  private async notInFilter(items: S[], filter: Partial<FilterIn<S>>): Promise<S[]> {
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

  private async nullFilter(items: S[], key: keyof S): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] === null || item[key] === undefined);
  }

  private async notNullFilter(items: S[], key: keyof S): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    return items.filter(item => item[key] !== null && item[key] !== undefined);
  }

  private async betweenFilter(items: S[], filter: Partial<FilterBetween<S>>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const filterBetween = filter[key];
      if (filterBetween !== undefined) {
        return items.filter(item => filterBetween.to >= item[key] && item[key] >= filterBetween.from);
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async notBetweenFilter(items: S[], filter: Partial<FilterBetween<S>>): Promise<S[]> {
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

  private async gtFilter(items: S[], filter: Partial<S>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] > filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async gteFilter(items: S[], filter: Partial<S>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] >= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async ltFilter(items: S[], filter: Partial<S>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] < filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async lteFilter(items: S[], filter: Partial<S>): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return items.filter(item => item[key] <= filter[key]);
    }
    throw '[TODO] Should not reach error';
  }

  private async rawFilter(items: S[], filter: FilterRaw): Promise<S[]> {
    // Cost: (1, n, 1) => O(n) = n;
    const fn = eval(filter.$query);
    const params = filter.$bindings;
    if (Array.isArray(params)) {
      return items.filter(item => fn(item, ...params));
    } else {
      return items.filter(item => fn(item, params));
    }
  }

  private async asyncFilter(items: S[], asyncFilter: Promise<Filter<S>>): Promise<S[]> {
    const filter = await asyncFilter;
    return this.filter(items, filter);
  }

  private async specialFilter(items: S[], filter: FilterSpecial<S>): Promise<S[]> {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    if (filter.$and !== undefined)
      return await this.andFilter(items, filter.$and);
    if (filter.$or !== undefined)
      return await  this.orFilter(items, filter.$or);
    if (filter.$not !== undefined)
      return await  this.notFilter(items, filter.$not);
    if (filter.$in !== undefined)
      return await  this.inFilter(items, filter.$in);
    if (filter.$notIn !== undefined)
      return await  this.notInFilter(items, filter.$notIn);
    if (filter.$null !== undefined)
      return await  this.nullFilter(items, filter.$null);
    if (filter.$notNull !== undefined)
      return await  this.notNullFilter(items, filter.$notNull);
    if (filter.$between !== undefined)
      return await  this.betweenFilter(items, filter.$between);
    if (filter.$notBetween !== undefined)
      return await  this.notBetweenFilter(items, filter.$notBetween);
    if (filter.$gt !== undefined)
      return await  this.gtFilter(items, filter.$gt);
    if (filter.$gte !== undefined)
      return await  this.gteFilter(items, filter.$gte);
    if (filter.$lt !== undefined)
      return await  this.ltFilter(items, filter.$lt);
    if (filter.$lte !== undefined)
      return await  this.lteFilter(items, filter.$lte);
    if (filter.$raw !== undefined)
      return await  this.rawFilter(items, filter.$raw);
    if (filter.$async !== undefined)
      return await  this.asyncFilter(items, filter.$async);
    throw '[TODO] Should not reach error';
  }

  private async filter(items: S[], filter: Filter<S>): Promise<S[]> {
    for (const key in filter) {
      if (key.startsWith('$')) {
        return await this.specialFilter(items, <FilterSpecial<S>>filter);
      }
    }
    return await this.propertyFilter(items, <Partial<S>>filter);
  }

  async query(model: ModelStatic<S>): Promise<ModelConstructor<S>[]> {
    try {
      const items = await  this.items(model);
      return items.map(item => new model(item));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async count(model: ModelStatic<S>): Promise<number> {
    try {
      const items = await this.items(model);
      return items.length;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async select(model: ModelStatic<S>, ...keys: (keyof S)[]): Promise<S[keyof S][][]> {
    try {
      const items = await this.items(model);

      const result: S[keyof S][][] = [];
      items.forEach(item => {
        const arr = [];
        for (const key of keys) {
          arr.push((<any>item)[key]);
        }
        result.push(arr);
      });
      return Promise.resolve(result);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async updateAll(model: ModelStatic<S>, attrs: Partial<S>): Promise<number> {
    try {
      const items = await this.items(model);
      items.forEach(item => {
        for (const key in attrs) {
          if (key !== model.identifier) {
            // @ts-ignore
            item[key] = attrs[key];
          }
        }
      });
      return Promise.resolve(items.length);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async deleteAll(model: ModelStatic<S>): Promise<number> {
    try {
      const items = await this.items(model);
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
      return Promise.resolve(items.length);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    try {
      instance.id = ++uuid;
      this.collection(instance.model).push(<S>instance.attributes);
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
              item[key] = <S[keyof S]>attrs[key];
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

  execute(query: string, bindings: Bindings): Promise<any[]> {
    const fn = eval(query);
    if (Array.isArray(bindings)) {
      return fn(this.storage, ...bindings);
    } else {
      return fn(this.storage, bindings);
    }
  }
}

export default Connector;
