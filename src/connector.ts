import {
  Attributes,
  NextModel,
  Query,
} from './next_model';


import camelCase from 'lodash/camelCase';
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
  private storage: Storage = {};
  private ids: IdStorage = {};

  constructor(storage: Storage = {}) {
    this.storage = storage;
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

  nextId(model: typeof NextModel): number {
    this.ids[model.modelName] = this.ids[model.modelName] || 1;
    return this.ids[model.modelName]++;
  }

  items(model: typeof NextModel): Attributes[] {
    this.storage[model.modelName] = this.storage[model.modelName] || [];
    return this.storage[model.modelName];
  }

  all(model: typeof NextModel): Promise<NextModel[]> {
    const attrArray: Attributes[] = this.query(this.items(model), model.query);
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
    const id: any = instance[model.identifier];
    if (id !== undefined) {
      return this.first(model.unscoped.queryBy({
        [model.identifier]: id,
      }));
    } else {
      return Promise.resolve(undefined);
    }
  }

  create(instance: NextModel) {
    const items: Attributes[] = this.storage[instance.model.modelName];
    instance[instance.model.identifier] = items.length;
    items.push(instance.dbAttributes);
    return Promise.resolve(instance);
  }

  update(instance: NextModel) {
    const items: Attributes[] = this.storage[instance.model.modelName];
    items[instance[instance.model.identifier]] = instance.attributes;
    return Promise.resolve(instance);
  }

  delete(instance: NextModel) {
    const id: any = instance[instance.model.identifier];
    if (id !== undefined) {
      const items: Attributes[] = this.storage[instance.model.modelName];
      delete items[id];
      instance[instance.model.identifier] = undefined;
    }
    return Promise.resolve(instance);
  }
};

export default Connector;
