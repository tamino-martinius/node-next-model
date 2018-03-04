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

  private orFilter(items: S[], filters: Filter<S>[]): S[] {
    // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter(n)))
    const arrays: S[][] = filters.map((filter) => this.filter(items, filter));
    const exists: { [key: string]: boolean } = {};
    arrays.forEach(array => array.forEach(item => {
      exists[item.id] = exists[item.id] || true;
    }));
    return items.filter(item => exists[item.id]);
  }


  }

  private filter(model: ModelStatic<S>, items: S[], filter: Filter<S> | FilterProperty<S>): S[] {

  }

  all(model: ModelStatic<S>): Promise<ModelConstructor<S>[]> {
    throw new Error('Not yet implemented');
  }

  first(model: ModelStatic<S>): Promise<ModelConstructor<S> | undefined> {
    throw new Error('Not yet implemented');
  }

  count(model: ModelStatic<S>): Promise<number> {
    throw new Error('Not yet implemented');
  }

  updateAll(model: ModelStatic<S>, params: Partial<S>): Promise<ModelConstructor<S>[]> {
    throw new Error('Not yet implemented');
  }

  deleteAll(model: ModelStatic<S>): Promise<ModelConstructor<S>[]> {
    throw new Error('Not yet implemented');
  }

  reload(instance: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined> {
    throw new Error('Not yet implemented');
  }

  create(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    throw new Error('Not yet implemented');
  }

  update(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    throw new Error('Not yet implemented');
  }

  delete(instance: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    throw new Error('Not yet implemented');
  }
}

export interface ConnectorConstructor<S> {
  all(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  first(model: ModelStatic<S>): Promise<ModelConstructor<S> | undefined>;
  count(model: ModelStatic<S>): Promise<number>;
  updateAll(model: ModelStatic<S>, params: Partial<S>): Promise<ModelConstructor<S>[]>;
  deleteAll(model: ModelStatic<S>): Promise<ModelConstructor<S>[]>;
  reload(model: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined>;
  create(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  update(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
  delete(model: ModelConstructor<S>): Promise<ModelConstructor<S>>;
};
