import faker from 'faker';

import {
  Filter,
  Schema,
  ModelConstructor,
} from '../types';

function positiveInteger(): number {
  return faker.random.number(Number.MAX_SAFE_INTEGER);
}

function className(): string {
  return faker.lorem.word();
}

function propertyName(): string {
  return faker.lorem.word().toLowerCase();
}

function type(): string {
  return faker.lorem.word().toLowerCase();
}

const seed = positiveInteger();
console.log(`Running with seed ${seed}`)
faker.seed(seed);

export class Faker {
  static get modelName(): string {
    return className();
  }

  static get schema() {
    return {}
  }

  static schemaByPropertyCount(count: number): Schema<any> {
    let schema = {};
    for (let i = 0; i < count; i++) {
      const name = propertyName();
      schema[name] = { type: type() };
      if (faker.random.boolean) schema[name].defaultValue = faker.lorem.text;
    }
    return schema;
  }

  static get limit(): number {
    return positiveInteger();
  }

  static get skip(): number {
    return positiveInteger();
  }
};
