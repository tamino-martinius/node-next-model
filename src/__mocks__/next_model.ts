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
} from '../types';

import {
  NextModel,
} from '../next_model';

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

function filterItem(): any {
  return {
    [propertyName()]: faker.hacker.noun(),
  };
}

const seed = positiveInteger();
console.log(`Running with seed ${seed}`)
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

  static get schema() {
    return this.schemaByPropertyCount(faker.random.number({
      min: 1,
      max: 5,
    }));
  }

  static schemaByPropertyCount(count: number): Schema<any> {
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

  static filterByItemCount(count: number): Filter<any> {
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

  static relationByCount(count: number): Dict<Relation> {
    let belongsTo = {};
    for (let i = 0; i < count; i++) {
      const name = propertyName();
      belongsTo[name] = { model: this.model };
      if (faker.random.boolean()) belongsTo[name].foreignKey = propertyName();
    }
    return belongsTo;
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
