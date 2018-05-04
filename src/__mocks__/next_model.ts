import faker from 'faker';

import {
  Dict,
  Filter,
  Schema,
  ModelConstructor,
  ModelStatic,
  OrderDirection,
  Order,
  Validator,
  DataType,
} from '../types';

import NextModel from '../next_model';
import Connector from '../connector';

function positiveInteger(min: number = 1, max: number = Number.MAX_SAFE_INTEGER - 1): number {
  return faker.random.number({
    min: 1,
    max,
  });
}

function className(): string {
  const name = faker.lorem.word();
  return name.substr(0, 1).toUpperCase() + name.substr(1);
}

function propertyName(): string {
  return faker.database.column().toLowerCase();
}

function type(): string {
  return faker.database.type().toLowerCase();
}

function filterKey(): string {
  return faker.helpers.randomize([
    '$and',
    '$or',
    '$not',
  ]);
}

function orderDirection(): OrderDirection {
  return faker.helpers.randomize([
    OrderDirection.asc,
    OrderDirection.desc,
  ]);
}

function filterItem(): any {
  return {
    [propertyName()]: faker.hacker.noun(),
  };
}

function validator(): Validator<any> {
  return (_instance: any) => Promise.resolve(faker.random.boolean());
}

const seed = positiveInteger();
// console.log(`Running with seed ${seed}`)
faker.seed(seed);

export class Faker {
  static get model(): ModelStatic<any> {
    const modelName = this.modelName;
    const schema = this.schema;

    return class extends NextModel<any>() {
      static get modelName() {
        return modelName;
      }

      static get schema() {
        return schema;
      }
    };
  }

  static get modelName(): string {
    return className();
  }

  static get identifier(): string {
    return propertyName();
  }

  static get collectionName(): string {
    return className();
  }

  static get connector(): Connector<any> {
    return new Connector({});
  }

  static get schema() {
    const schema = this.schemaByPropertyCount(faker.random.number({
      min: 1,
      max: 5,
    }));
    schema.id = {
      type: faker.random.number({ min: 0, max: 14 }),
    };
    return schema;
  }

  private static schemaByPropertyCount(count: number): Schema<any> {
    let schema = {};
    for (let i = 0; i < count; i++) {
      const name = propertyName();
      schema[name] = { type: type() };
      if (faker.random.boolean()) schema[name].defaultValue = faker.lorem.text();
    }
    return schema;
  }

  static get filter() {
    return this.filterByItemCount(faker.random.number({
      min: 0,
      max: 10,
    }));
  }

  private static filterByItemCount(count: number): Filter<any> {
    const key = filterKey();
    const filter = { [key]: [] };
    for (let i = 0; i < count; i++) {
      filter[key].push(filterItem());
    }
    return filter;
  }

  static get order(): Partial<Order<any>>[] {
    return this.orderByCount(faker.random.number({
      min: 0,
      max: 10,
    }));
  }

  static get orderDirection(): OrderDirection {
    return orderDirection();
  }

  private static orderByCount(count: number): Partial<Order<any>>[] {
    const order: Partial<Order<any>>[] = [];
    for (let i = 0; i < count; i++) {
      const name = propertyName();
      order.push({ [name]: orderDirection() });
    }
    return order;
  }

  static get validators(): Validator<any>[] {
    return this.validatorsByCount(faker.random.number({
      min: 0,
      max: 10,
    }));
  }

  private static validatorsByCount(count: number): Validator<any>[] {
    const validators: Validator<any>[] = [];
    for (let i = 0; i < count; i++) {
      validators.push(validator());
    }
    return validators;
  }

  static randomId(max: number) {
    return positiveInteger(1, max);
  }

  static randomNumber(min: number, max: number) {
    return positiveInteger(min, max);
  }

  static get limit(): number {
    return positiveInteger();
  }

  static get skip(): number {
    return positiveInteger();
  }
};
