import {
  ModelStatic,
  StrictSchema,
  StrictFilter,
  StrictBelongsTo,
  StrictHasOne,
  StrictHasMany,
  staticImplements,
  Schema,
  QueryBy,
  FindBy,
  Filter,
} from './types';

import {
} from './util'

export class PropertyNotDefinedError implements Error {
  name: string = 'PropertyNotDefinedError';
  message: string;

  constructor(name: string, isStatic: boolean = true, isReadonly: boolean = true) {
    this.message = 'Please define ';
    if (isStatic) this.message += 'static ';
    if (isReadonly) this.message += 'readonly ';
    this.message += `property '${name}' on your model`;
  }
};

export class LowerBoundsError implements Error {
  name: string = 'LowerBoundsError';
  message: string;

  constructor(name: string, lowerBound: number) {
    this.message = `
      Property '${name}' is expected to be greater or equal to '${lowerBound}'
    `;
  }
};

export class MinLengthError implements Error {
  name: string = 'MinLengthError';
  message: string;

  constructor(name: string, minLength: number) {
    this.message = `
      Property '${name}' length is expected to be longer or equal to '${minLength}'
    `;
  }
};

export class TypeError implements Error {
  name: string = 'TypeError';
  message: string;

  constructor(name: string, type: string) {
    this.message = `
      Property '${name}' is expected to an '${type}'
    `;
  }
};

export function NextModel<S>(): ModelStatic<S> {
  @staticImplements<ModelStatic<S>>()
  class Model {
    private static readonly DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
    private static readonly DEFAULT_SKIP = 0;
    private static cachedLowerModelName?: string;
    private static cachedStrictSchema?: StrictSchema<S>;
    private static cachedStrictFilter?: StrictFilter<S>;
    private static cachedStrictBelongsTo?: StrictBelongsTo;
    private static cachedStrictHasOne?: StrictHasOne;
    private static cachedStrictHasMany?: StrictHasMany;
    private static cachedQueryBy?: QueryBy<S>;
    private static cachedFindBy?: FindBy<S>;

    static get limit(): number {
      return this.DEFAULT_LIMIT;
    }

    static get skip(): number {
      return this.DEFAULT_SKIP;
    }

    static get modelName(): string {
      throw new PropertyNotDefinedError('modelName');
    }

    static get lowerModelName(): string {
      if (this.cachedLowerModelName !== undefined) {
        return this.cachedLowerModelName;
      } else {
        return this.cachedLowerModelName =
          this.modelName.substr(0, 1).toLowerCase() +
          this.modelName.substr(1)
        ;
      }
    }

    static get schema(): Schema<S> {
      throw new PropertyNotDefinedError('schema');
    }

    static get filter(): Filter<S> | undefined {
      return undefined;
    }

    static get strictSchema(): StrictSchema<S> {
      if (this.cachedStrictSchema !== undefined) {
        return this.cachedStrictSchema;
      } else {
        const schema = <StrictSchema<S>>this.schema;

        for (const key in schema) {
          if (!('defaultValue' in schema[key])) {
            schema[key].defaultValue = undefined;
          }
        }
        return this.cachedStrictSchema = schema;
      }
    }

    static get strictFilter(): StrictFilter<S> {
      if (this.cachedStrictFilter !== undefined) {
        return this.cachedStrictFilter;
      } else {
        // [TODO] Generate strict version
        return {};
      }
    }

    static get strictBelongsTo(): StrictBelongsTo {
      if (this.cachedStrictBelongsTo !== undefined) {
        return this.cachedStrictBelongsTo;
      } else {
        // [TODO] Generate strict version
        return {};
      }
    }

    static get strictHasOne(): StrictHasOne {
      if (this.cachedStrictHasOne !== undefined) {
        return this.cachedStrictHasOne;
      } else {
        // [TODO] Generate strict version
        return {};
      }
    }

    static get strictHasMany(): StrictHasMany {
      if (this.cachedStrictHasMany !== undefined) {
        return this.cachedStrictHasMany;
      } else {
        // [TODO] Generate strict version
        return {};
      }
    }

    static limitBy(amount: number): typeof Model {
      // [TODO] Validate input (!NaN && x >= 0  && x < Infinity)
      return class extends this {
        static get limit(): number {
          return amount;
        }
      };
    }

    static get unlimited(): typeof Model {
      return class extends this {
        static get limit(): number {
          return this.DEFAULT_LIMIT;
        }
      };
    }

    static skipBy(amount: number): typeof Model {
      // [TODO] Validate input (!NaN && x >= 0  && x < Infinity)
      return class extends this {
        static get skip(): number {
          return amount;
        }
      };
    }

    static get unskipped(): typeof Model {
      return class extends this {
        static get skip(): number {
          return this.DEFAULT_SKIP;
        }
      };
    }

    static query(filterBy: Filter<S>): typeof Model {
      let filter = filterBy;
      if (this.filter !== undefined) {
        filter = {
          $and: [filterBy, this.filter],
        };
      }
      return class extends this {
        static get filter(): Filter<S> {
          return filter;
        }
      };
    }

    static get queryBy(): QueryBy<S> {
      if (this.cachedQueryBy !== undefined) {
        return this.cachedQueryBy;
      } else {
        const queryBy = <QueryBy<S>>{};
        Object.keys(this.strictSchema).forEach(key => {
          // @ts-ignore
          queryBy[key] = (value) => this.query({ [key]: value });
        });
        return this.cachedQueryBy = queryBy;
      }
    }

    static get first(): Promise<Model | undefined> {
      return Promise.resolve(new Model({}));
    }

    static find(filterBy: Filter<S>): Promise<Model | undefined> {
      return this.query(filterBy).first;
    }

    static get findBy(): FindBy<S>  {
      if (this.cachedFindBy !== undefined) {
        return this.cachedFindBy;
      } else {
        const findBy = <FindBy<S>>{};
        Object.keys(this.strictSchema).forEach((key) => {
          // @ts-ignore
          findBy[key] = (value) => this.find({ [key]: value });
        });
        return findBy;
      }
    }

    constructor(_props: Partial<S>) {

    }

    get model(): typeof Model {
      return <typeof Model>this.constructor;
    }
  };

  return Model;
};

interface UserSchema {
  firstName: string;
  lastName: string;
}

class User extends NextModel<UserSchema>() {;
  firstName: string;
  lastName: string;
  // [key: string]: any;

  static get modelName() {
    return 'User';
  }

  static get schema() {
    return {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    };
  }
}

const u = new User({firstName: 'test'});
console.log(u);
// User.findBy('firstName', 1)
