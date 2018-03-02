import {
  ModelStatic,
  ModelConstructor,
  Filter,
  FilterProperty,
} from './types';

export interface Storage {
  [key: string]: any[],
}

const globalStorage: Storage = {};

export class Connector<S> implements ConnectorConstructor<S> {
  private storage: Storage;

  constructor(storage: Storage = globalStorage) {
    this.storage = storage;
  }

  private collection(model: ModelStatic<S>): ModelConstructor<S>[] {
    return this.storage[model.modelName] = this.storage[model.modelName] || [];
  }

  private filteredRecords(model: ModelStatic<S>): ModelConstructor<S>[] {

  }

  private andFilter(model: ModelStatic<S>, items: S[], filter: (Filter<S> | FilterProperty<S>)[]): S[] {

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
