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
  save(instance: NextModel): Promise<NextModel>;
  delete(instance: NextModel): Promise<NextModel>;
  reload(instance: NextModel): Promise<NextModel>;
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

  constructor(storage: Storage = {}) {
    this.storage = storage;
  }

  get specialFilters(): SpecialFilters {
    return {
      $and(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => this.query(items, query));
        return intersection(...arrays);
      },
      $or(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => this.query(items, query));
        return union(...arrays);
      },
      $not(items: Attributes[], predicates: Query[]): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => this.query(items, query));
        const array: Attributes[] = intersection.apply(intersection, arrays);
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
        const arrays: Attributes[][] = [];
        for (const key in specialQueries) {
          const specialFilter = this.specialFilters[key];
          if (specialFilter) {
            arrays.push(specialFilter(items, specialQueries[key]));
          } else {
            arrays.push([]);
          }
        }
        return intersection.apply(intersection, arrays);
      } else {
        return items;
      }
    }
  }

  all(model: typeof NextModel): Promise<NextModel[]> {
    const items: Attributes[] = this.storage[model.modelName] || [];
    const attrArray: Attributes[] = this.query(items, model.query);
    return Promise.resolve(attrArray.map(attrs => new model(attrs)));
  }

  first(model: typeof NextModel): Promise<NextModel> {
    return this.all(model).then(items => items[0]);
  }

  count(model: typeof NextModel): Promise<number> {
    return this.all(model).then(items => items.length);
  }

  save(instance: NextModel) {
    const items: Attributes[] = this.storage[instance.model.modelName];
    if (instance.isNew) {
      instance[instance.model.identifier] = items.length;
      items.push(instance.dbAttributes);
    } else {
      items[instance[instance.model.identifier]] = instance.attributes;
    }
    return Promise.resolve(instance);
  }

  reload(instance: NextModel) {
    const id: any = instance[instance.model.identifier];
    if (id !== undefined) {
      const items: Attributes[] = this.storage[instance.model.modelName];
      return Promise.resolve(new instance.model(items[id]));
    } else {
      return Promise.resolve(new instance.model());
    }
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
