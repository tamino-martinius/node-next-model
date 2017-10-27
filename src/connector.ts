import {
  Attributes,
  NextModel,
  Query,
} from './next_model';

import {
//   assign,
//   camelCase,
//   concat,
//   difference,
  filter,
//   first,
//   flatten,
//   includes,
intersection,
//   isArray,
//   isFunction,
//   isNil,
//   isNumber,
//   isObject,
//   isString,
//   keys,
//   last,
//   map,
//   mapValues,
//   omit,
//   pick,
//   snakeCase,
  union,
//   upperFirst,
//   values,
  without,
} from 'lodash';

export interface Connector {
  all(model: typeof NextModel): Promise<NextModel[]>;
  first(model: typeof NextModel): Promise<NextModel | undefined>;
  count(model: typeof NextModel): Promise<number>;
  reload(instance: NextModel): Promise<NextModel | undefined>;
  create(instance: NextModel): Promise<NextModel>;
  update(instance: NextModel): Promise<NextModel>;
  delete(instance: NextModel): Promise<NextModel>;
};

export interface Storage {
  [modelName: string]: Attributes[];
}

export interface IdStorage {
  [modelName: string]: number;
}

export type SpecialFilter = (items: Attributes[], query: Query) => Attributes[];
export interface SpecialFilters {
  [key: string]: SpecialFilter;
};

export class DefaultConnector implements Connector {
  private storage: Storage;
  private ids: IdStorage;

  constructor(storage: Storage = {}) {
    this.storage = storage;
    this.ids = {};
  }

  private get specialFilters(): SpecialFilters {
    const context = this;
    return {
      $and(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => context.query(items, query));
        return intersection(...arrays);
      },
      $or(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => context.query(items, query));
        return union(...arrays);
      },
      $not(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => context.query(items, query));
        const array: Attributes[] = union(...arrays);
        return without(items, ...array);
      },
    };
  };


  private query(items: Attributes[], query: Query): Attributes[] {
    const predicateKeys: string[] = [];
    const predicate: Query = {};
    const specialQueryKeys: string[] = [];
    const specialQuery: Query = {};
    const specialQueries: Query[] = [];
    for (const key in query) {
      if (key.startsWith('$')) {
        specialQueryKeys.push(key);
        specialQuery[key] = query[key];
        specialQueries.push({
          [key]: query[key],
        });
      } else {
        predicateKeys.push(key);
        predicate[key] = query[key];
      }
    }
    if (predicateKeys.length > 0) {
      if (specialQueryKeys.length > 0) {
        return this.query(items, {
          $and: [predicate, specialQuery],
        });
      } else {
        return filter(items, predicate);
      }
    } else {
      if (specialQueryKeys.length > 1) {
        return this.query(items, {
          $and: specialQueries,
        });
      } else if (specialQueryKeys[0] !== undefined) {
        return this.specialFilters[specialQueryKeys[0]](items, query[specialQueryKeys[0]]);
      } else {
        return items;
      }
    }
  }

  private nextId(model: typeof NextModel): number {
    this.ids[model.modelName] = this.ids[model.modelName] || 1;
    return this.ids[model.modelName]++;
  }

  private indexOf(items: Attributes[], instance: NextModel): number | undefined {
    const identifier: string = instance.model.identifier;
    const id: any = instance[identifier];
    for (let index = 0; index < items.length; index++) {
      if (items[index][identifier] === id) {
        return index
      }
    }
    return undefined;
  }

  items(model: typeof NextModel): Attributes[] {
    this.storage[model.modelName] = this.storage[model.modelName] || [];
    return this.storage[model.modelName];
  }

  all(model: typeof NextModel): Promise<NextModel[]> {
    const items: Attributes[] = this.items(model);
    const attrArray: Attributes[] = this.query(items, model.query);
    return Promise.resolve(attrArray.map(attrs => new model(attrs)));
  }

  first(model: typeof NextModel): Promise<NextModel | undefined> {
    const attrArray: Attributes[] = this.query(this.items(model), model.query);
    if (attrArray.length > 0) {
      return Promise.resolve(new model(attrArray[0]));
    } else {
      return Promise.resolve(undefined);
    }
  }

  count(model: typeof NextModel): Promise<number> {
    return Promise.resolve(this.query(this.items(model), model.query).length);
  }

  reload(instance: NextModel): Promise<NextModel | undefined> {
    const model = instance.model;
    const items: Attributes[] = this.items(model);
    const index: number | undefined = this.indexOf(items, instance);
    if (index === undefined) {
      return Promise.resolve(undefined);
    } else {
      return Promise.resolve(new model(items[index]));
    }
  }

  create(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.storage[model.modelName];
    instance.data[model.identifier] = this.nextId(model);
    items.push(instance.dbAttributes);
    return Promise.resolve(instance);
  }

  update(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.storage[model.modelName];
    const index: number | undefined = this.indexOf(items, instance);
    if (index !== undefined) {
      items[index] = instance.dbAttributes;
    }
    return Promise.resolve(instance);
  }

  delete(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.storage[model.modelName];
    const index: number | undefined = this.indexOf(items, instance);
    if (index !== undefined) {
      items.splice(index, 1);
    }
    return Promise.resolve(instance);
  }
};

export default Connector;
