// import * as pluralize from 'pluralize';

import {
//   assign,
  camelCase,
//   concat,
//   difference,
//   filter,
//   first,
//   flatten,
//   includes,
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
//   union,
//   upperFirst,
//   values,
//   without,
} from 'lodash';

export interface Relation {
  model: Model,
  foreignKey?: string;
};

export interface BelongsToRelation extends Relation {
};

export interface BelongsTo {
  [key: string]: BelongsToRelation;
};

export interface HasManyRelation extends Relation {
};

export interface HasMany {
  [key: string]: HasManyRelation;
};

export interface HasOneRelation extends Relation {
};

export interface HasOne {
  [key: string]: HasOneRelation;
};

export interface Schema {
  [key: string]: SchemaAttribute<any>;
};

export interface SchemaAttribute<Type> {
  type?: string; // Only needed for js usage
  defaultValue?: Type;
  defaultGenerator?: (klass: Instance) => Type;
};

export interface Scope {
  query?: Query;
  order?: Order;
};

export interface Unscope {
  query?: Unquery;
  order?: Unorder;
};

export type Unquery = string | string[];
export type Unorder = string | string[];

export interface Scopes {
  [key: string]: Scope;
};

export interface Query {
  [key: string]: any;
};

export interface Attributes {
  [key: string]: any;
}

export type OrderDirection = 'asc' | 'desc';

export interface Order {
  [key: string]: OrderDirection;
};

export interface Change<Type> {
  from: Type;
  to: Type;
};

export interface Changes {
  [key: string]: Change<any>;
}

export type SyncCallback = (klass: Model) => Model;
export type PromiseCallback = (klass: Model) => Promise<boolean>;
export type Callback = SyncCallback | PromiseCallback;

export interface Callbacks {
  beforeSave?: Callback | Callback[];
  afterSave?: Callback | Callback[];
  beforeUpdate?: Callback | Callback[];
  afterUpdate?: Callback | Callback[];
  beforeDelete?: Callback | Callback[];
  afterDelete?: Callback | Callback[];
  beforeReload?: Callback | Callback[];
  afterReload?: Callback | Callback[];
  beforeAssign?: SyncCallback | SyncCallback[];
  afterAssign?: SyncCallback | SyncCallback[];
};

export type SyncValidator = (klass: Model) => boolean;
export type PromiseValidator = (klass: Model) => Promise<boolean>;
export type Validator = SyncValidator | PromiseValidator;
export interface Validators {
  [key: string]: Validator | Validator[];
};

export abstract class BaseModel {
  static readonly modelName?: string;
  static readonly identifier?: string;
  static readonly connector?: Connector;

  static readonly schema?: Schema;
  static readonly belongsTo?: BelongsTo;
  static readonly hasMany?: HasMany;
  static readonly hasOne?: HasOne;
  static readonly validators?: Validators;
  static readonly callbacks?: Callbacks;

  static readonly defaultSkip?: number;
  static readonly defaultLimit?: number;
  static readonly defaultQuery?: Query;
  static readonly defaultOrder?: Order;
  static readonly skippedCallbacks?: [string | Callback];
  static readonly skippedValidators?: [string | Validator];
  static readonly scopes?: Scopes;
};

export type Model = typeof BaseModel;

export interface Instance {
  save: () => Promise<Instance>;
  delete: () => Promise<Instance>;
  update: (attrs: Attributes) => Promise<Instance>;
  reload: () => Promise<Instance>;
  assign: (attrs: Attributes) => Instance;

  changes: Changes;
  isSaved: boolean;
  isNew: boolean;
  isPersisted: boolean;
  isValid: Promise<boolean>;
};


 export interface Connector {
  all(model: typeof NextModel): Promise<Instance[]>;
  first(model: typeof NextModel): Promise<Instance | undefined>;
  last(model: typeof NextModel): Promise<Instance | undefined>;
  count(model: typeof NextModel): Promise<number>;
  save(model: Instance): Promise<Instance>;
};

 export const DefaultConnector = {
  all(model: typeof NextModel) {
    return Promise.resolve([]);
  },
  first(model: typeof NextModel) {
    return Promise.resolve(undefined);
  },
  last(model: typeof NextModel) {
    return Promise.resolve(undefined);
  },
  count(model: typeof NextModel) {
    return Promise.resolve(0);
  },
  save(model: NextModel) {
    return Promise.resolve(model);
  }
};

export abstract class xxxNextModel {
  static readonly modelName?: string;
  static readonly identifier?: string;
  static readonly connector?: Connector;

  static readonly schema: Schema;
  static readonly belongsTo?: BelongsTo;
  static readonly hasMany?: HasMany;
  static readonly hasOne?: HasOne;
  static readonly validators?: Validators;
  static readonly callbacks?: Callbacks;

  static readonly defaultSkip?: number;
  static readonly defaultLimit?: number;
  static readonly defaultQuery?: Query;
  static readonly defaultOrder?: Order;
  static readonly skippedCallbacks?: [string | Callback];
  static readonly skippedValidators?: [string | Validator];
  static readonly scopes?: Scopes;

  static scope: (scope: Scope) => typeof NextModel;
  static unscope: (unscope?: Unscope) => typeof NextModel;
  static query: (query: Query) => typeof NextModel;
  static unquery: (unquery?: Unquery) => typeof NextModel;
  static order: (order: Order) => typeof NextModel;
  static unorder: (unorder?: Unorder) => typeof NextModel;
  static skip: (count: number) => typeof NextModel;
  static unskip: () => typeof NextModel;
  static limit: (count: number) => typeof NextModel;
  static unlimit: () => typeof NextModel;
  static callback: (key: string, callback: Callback) => typeof NextModel;
  static skipCallback: (skip: string | Callback) => typeof NextModel;
  static validator: (key: string, validator: Validator) => typeof NextModel;
  static skipValidator: (skip: string | Validator) => typeof NextModel;

  static readonly all: Instance[];
  static readonly first: Instance | undefined;
  static readonly last: Instance | undefined;
  static readonly count: number;

  static build: (attrs: Attributes) => Instance;
  static create: (attrs: Attributes) => Promise<Instance>;
  static updateAll: (attrs: Attributes) => Promise<Instance[]>;
  static deleteAll: () => Promise<Instance[]>;
};

class Generator {
  readonly model: Model;

  constructor(constructor: Model) {
    this.model = constructor;
  }

  get modelName(): string {
    return this.model.modelName || this.model.name;
  };

  get identifier(): string {
    return this.model.identifier || 'id';
  };
  
  get connector(): Connector {
    return this.model.connector || DefaultConnector;
  };
  
  get schema(): Schema {
    return this.model.schema || {};
  }

  get belongsTo(): BelongsTo {
    const relations = this.model.belongsTo || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.foreignKey) {
        relation.foreignKey = camelCase(relation.model.modelName + 'Id');
      }
    }
    return relations;
  };
  
  get hasMany(): HasMany {
    const relations = this.model.hasMany || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.foreignKey) {
        relation.foreignKey = camelCase(this.model.modelName + 'Id');
      }
    }
    return relations;
  };
  
  get hasOne(): HasOne {
    const relations = this.model.hasOne || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.foreignKey) {
        relation.foreignKey = camelCase(this.model.modelName + 'Id');
      }
    }
    return relations;
  };
};

export function NextModel(constructor: Model) {
  const generator = new Generator(constructor);

  return class NextModel {
    static get modelName(): string {
      return generator.modelName;
    }

    static get identifier(): string {
      return generator.modelName;
    }

    static get connector(): Connector {
      return generator.connector;
    }


    static get schema(): Schema {
      return generator.schema;
    }

    static get belongsTo(): BelongsTo {
      return generator.belongsTo;
    }

    static get hasMany(): HasMany {
      return generator.hasMany;
    }

    static get hasOne(): HasOne {
      return generator.hasOne;
    }
  };
}

export default NextModel;
