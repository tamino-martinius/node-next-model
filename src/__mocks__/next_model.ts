import faker from 'faker';

export class Faker {
  private static get positiveInteger(): number {
    return faker.random.number({
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      precision: 1,
    });
  }

  private static get className(): string {
    return faker.lorem.word();
  }

  static get modelName(): string {
    return this.className;
  }

  static get limit(): number {
    return this.positiveInteger;
  }

  static get skip(): number {
    return this.positiveInteger;
  }
};
