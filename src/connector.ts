import {
  Attributes,
  NextModel,
  Query,
} from './next_model';

export interface Connector {
  all(model: typeof NextModel): Promise<NextModel[]>;
  first(model: typeof NextModel): Promise<NextModel | undefined>;
  count(model: typeof NextModel): Promise<number>;
  updateAll(model: typeof NextModel, attrs: Attributes): Promise<NextModel[]>;
  deleteAll(model: typeof NextModel): Promise<NextModel[]>;
  reload(instance: NextModel): Promise<NextModel | undefined>;
  create(instance: NextModel): Promise<NextModel>;
  update(instance: NextModel): Promise<NextModel>;
  delete(instance: NextModel): Promise<NextModel>;
};

export interface Storage {
  [modelName: string]: Attributes[];
}

export interface AttributesDict {
  [id: string]: Attributes;
}

export interface IdStorage {
  [modelName: string]: number;
}

export type SpecialFilter = (items: Attributes[], query: Query, identifier: string) => Attributes[];
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

  private static get specialFilters(): SpecialFilters {
    return {
      $and(items: Attributes[], predicates: Query[], identifier: string): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => DefaultConnector.query(items, query, identifier));
        return DefaultConnector.intersection(arrays, identifier);
      },
      $or(items: Attributes[], predicates: Query[], identifier: string): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => DefaultConnector.query(items, query, identifier));
        return DefaultConnector.union(arrays, identifier);
      },
      $not(items: Attributes[], predicates: Query[], identifier: string): Attributes[] {
        const arrays: Attributes[][] = predicates.map(query => DefaultConnector.query(items, query, identifier));
        const array: Attributes[] = DefaultConnector.union(arrays, identifier);
        return DefaultConnector.without(items, array, identifier);
      },
    };
  };

  private static query(items: Attributes[], query: Query, identifier: string): Attributes[] {
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
        }, identifier);
      } else {
        return this.filter(items, predicate);
      }
    } else {
      if (specialQueryKeys.length > 1) {
        return this.query(items, {
          $and: specialQueries,
        }, identifier);
      } else if (specialQueryKeys[0] !== undefined) {
        return this.specialFilters[specialQueryKeys[0]](items, query[specialQueryKeys[0]], identifier);
      } else {
        return items;
      }
    }
  }

  private static filter(items: Attributes[], query: Query): Attributes[] {
    return items.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  private static intersection(attrArrays: Attributes[][], identifier: string): Attributes[]{
    if (attrArrays.length === 0) {
      return [];
    } else if (attrArrays.length === 1) {
      return attrArrays[0];
    } else {
      return attrArrays[0].filter(item => {
        for (let arrayIndex = 1; arrayIndex < attrArrays.length; arrayIndex++) {
          const found: boolean = attrArrays[arrayIndex].reduce(
            (found: boolean, attrs: Attributes) =>
              found || attrs[identifier] === item[identifier]
            , false
          );
          if (!found) return false;
        }
        return true;
      });
    }
  }

  private static union(attrArrays: Attributes[][], identifier: string): Attributes[] {
    if (attrArrays.length === 0) {
      return [];
    } else if (attrArrays.length === 1) {
      return attrArrays[0];
    } else {
      const resultDict: AttributesDict = {};
      for (const attrArray of attrArrays) {
        for (const attrs of attrArray) {
          resultDict[attrs[identifier].toString()] = attrs;
        }
      }
      return Object.keys(resultDict).map(key => resultDict[key]);
    }
  }

  private static without(items: Attributes[], withoutItems: Attributes[], identifier: string): Attributes[] {
    const resultDict: AttributesDict = {};
    items.forEach(item => resultDict[item[identifier].toString()] = item);
    withoutItems.forEach(item => delete resultDict[item[identifier].toString()]);
    return Object.keys(resultDict).map(key => resultDict[key]);
  }

  private nextId(model: typeof NextModel): number {
    this.ids[model.modelName] = this.ids[model.modelName] || 1;
    return this.ids[model.modelName]++;
  }

  private static indexOf(items: Attributes[], instance: NextModel): number | undefined {
    const identifier: string = instance.model.identifier;
    const id: any = instance[identifier];
    for (let index = 0; index < items.length; index++) {
      if (items[index][identifier] === id) {
        return index;
      }
    }
    return undefined;
  }

  private matchingItems(model: typeof NextModel): Attributes[] {
    const items: Attributes[] = this.items(model);
    return this.model.query(items, model.query, model.identifier);
  }

  items(model: typeof NextModel): Attributes[] {
    this.storage[model.modelName] = this.storage[model.modelName] || [];
    return this.storage[model.modelName];
  }

  all(model: typeof NextModel): Promise<NextModel[]> {
    const attrArray: Attributes[] = this.matchingItems(model);
    return Promise.resolve(attrArray.map(attrs => new model(attrs)));
  }

  first(model: typeof NextModel): Promise<NextModel | undefined> {
    const attrArray: Attributes[] = this.matchingItems(model);
    if (attrArray.length > 0) {
      return Promise.resolve(new model(attrArray[0]));
    } else {
      return Promise.resolve(undefined);
    }
  }

  count(model: typeof NextModel): Promise<number> {
    return Promise.resolve(this.matchingItems(model).length);
  }

  updateAll(model: typeof NextModel, attrs: Attributes): Promise<NextModel[]> {
    const attrArray: Attributes[] = this.matchingItems(model);
    const instances = attrArray.map(attrs => new model(attrs));
    return Promise.all(instances.map(instance => this.update(instance.assign(attrs))));
  }

  deleteAll(model: typeof NextModel): Promise<NextModel[]> {
    const attrArray: Attributes[] = this.matchingItems(model);
    const items: Attributes[] = this.items(model);
    const instances = attrArray.map(attrs => new model(attrs));
    instances.forEach(instance => {
      const index: number | undefined = this.model.indexOf(items, instance);
      if (index !== undefined) {
        items.splice(index, 1);
      }
    });
    return Promise.resolve(instances);
  }

  reload(instance: NextModel): Promise<NextModel | undefined> {
    const model = instance.model;
    const items: Attributes[] = this.items(model);
    const index: number | undefined = this.model.indexOf(items, instance);
    if (index === undefined) {
      return Promise.resolve(undefined);
    } else {
      return Promise.resolve(new model(items[index]));
    }
  }

  create(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.items(model);
    instance.data[model.identifier] = this.nextId(model);
    items.push(instance.dbAttributes);
    return Promise.resolve(instance);
  }

  update(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.items(model);
    const index: number | undefined = this.model.indexOf(items, instance);
    if (index !== undefined) {
      items[index] = instance.dbAttributes;
    }
    return Promise.resolve(instance);
  }

  delete(instance: NextModel) {
    const model = instance.model;
    const items: Attributes[] = this.items(model);
    const index: number | undefined = this.model.indexOf(items, instance);
    if (index !== undefined) {
      items.splice(index, 1);
    }
    return Promise.resolve(instance);
  }

  get model(): typeof DefaultConnector {
    return <typeof DefaultConnector>this.constructor;
  }
};

export default Connector;
