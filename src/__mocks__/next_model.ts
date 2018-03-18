import faker from 'faker';

import {
  Dict,
  Filter,
  Schema,
  ModelConstructor,
  ModelStatic,
  BelongsTo,
  HasOne,
  HasMany,
  Relation,
  OrderDirection,
  Order,
  Validator,
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
  return faker.lorem.word();
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

  static get connector(): Connector<any> {
    return new Connector({});
  }

  static get schema() {
    const schema = this.schemaByPropertyCount(faker.random.number({
      min: 1,
      max: 5,
    }));
    schema.id = { type: 'number' };
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

  static get relation(): Dict<Relation> {
    return this.relationByCount(faker.random.number({
      min: 1,
      max: 3,
    }));
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

  private static relationByCount(count: number): Dict<Relation> {
    let belongsTo = {};
    for (let i = 0; i < count; i++) {
      const name = propertyName();
      belongsTo[name] = { model: this.model };
      if (faker.random.boolean()) belongsTo[name].foreignKey = propertyName();
    }
    return belongsTo;
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

  static get belongsTo(): BelongsTo {
    return this.relation;
  }

  static get hasOne(): HasOne {
    return this.relation;
  }

  static get hasMany(): HasMany {
    return this.relation;
  }

  static get limit(): number {
    return positiveInteger();
  }

  static get skip(): number {
    return positiveInteger();
  }
};
