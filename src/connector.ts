import {
  ModelStatic,
  ModelConstructor,
} from './types';

export interface Storage {
  [key: string]: ModelConstructor<any>,
}

const storage: Storage = {};

export class Connector<S> implements ConnectorConstructor<S> {
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

  reload(model: ModelConstructor<S>): Promise<ModelConstructor<S> | undefined> {
    throw new Error('Not yet implemented');
  }

  create(model: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    throw new Error('Not yet implemented');
  }

  update(model: ModelConstructor<S>): Promise<ModelConstructor<S>> {
    throw new Error('Not yet implemented');
  }

  delete(model: ModelConstructor<S>): Promise<ModelConstructor<S>> {
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
