import {
  Connector,
  DefaultConnector,
} from './connector';

import camelCase from 'lodash/camelCase';
// import {
// //   assign,
//   camelCase,
// //   concat,
// //   difference,
// //   filter,
// //   first,
// //   flatten,
// //   includes,
// //   isArray,
// //   isFunction,
// //   isNil,
// //   isNumber,
// //   isObject,
// //   isString,
// //   keys,
// //   last,
// //   map,
// //   mapValues,
// //   omit,
// //   pick,
// //   snakeCase,
// //   union,
// //   upperFirst,
// //   values,
// //   without,
// } from 'lodash';

export interface Relation {
  model: typeof NextModel,
  foreignKey?: string;
};

export class PropertyNotDefinedError {
  message: string;

  constructor(name: string) {
    this.message = `
      Please define readonly property '${name}'
      or use 'Model' Decorator to apply defaults
    `;
  }
};

export class LowerBoundsError {
  message: string;

  constructor(name: string, lowerBound: number) {
    this.message = `
      Property '${name}' is expected to be greater or equal to '${lowerBound}'
    `;
  }
};

export class MinLengthError {
  message: string;

  constructor(name: string, minLength: number) {
    this.message = `
      Property '${name}' length is expected to be longer or equal to '${minLength}'
    `;
  }
};

export class TypeError {
  message: string;

  constructor(name: string, type: string) {
    this.message = `
      Property '${name}' is expected to an '${type}'
    `;
  }
};

export interface BooleanLookupDict {
  [key: string]: boolean;
};

export interface BelongsTo {
  [key: string]: Relation;
};

export interface HasMany {
  [key: string]: Relation;
};

export interface HasOne {
  [key: string]: Relation;
};

export interface StrictRelation {
  model: typeof NextModel,
  foreignKey: string;
};

export interface StrictBelongsTo extends BelongsTo {
  [key: string]: StrictRelation;
};

export interface StrictHasMany extends HasMany {
  [key: string]: StrictRelation;
};

export interface StrictHasOne extends HasOne {
  [key: string]: StrictRelation;
};

export interface Schema {
  [key: string]: SchemaAttribute<any>;
};

export interface SchemaAttribute<Type> {
  type?: string; // Only needed for js usage
  defaultValue?: Type;
  defaultGenerator?: (klass: NextModel) => Type;
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

export interface Change {
  from: any;
  to: any;
};

export interface Changes {
  [key: string]: Change;
};

export interface Errors {
  [key: string]: Error[];
};

export type SyncCallback = (klass: NextModel) => boolean;
export type SyncCallbackKeys = 'beforeAssign' | 'afterAssign'
export type PromiseCallback = (klass: NextModel) => Promise<boolean>;
export type PromiseCallbackKeys = 'beforeSave' | 'afterSave' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' | 'beforeReload' | 'afterReload'

export interface Callbacks {
  beforeSave?: PromiseCallback | PromiseCallback[];
  afterSave?: PromiseCallback | PromiseCallback[];
  beforeUpdate?: PromiseCallback | PromiseCallback[];
  afterUpdate?: PromiseCallback | PromiseCallback[];
  beforeDelete?: PromiseCallback | PromiseCallback[];
  afterDelete?: PromiseCallback | PromiseCallback[];
  beforeReload?: PromiseCallback | PromiseCallback[];
  afterReload?: PromiseCallback | PromiseCallback[];
  beforeAssign?: SyncCallback | SyncCallback[];
  afterAssign?: SyncCallback | SyncCallback[];
};

export interface CallbackArrays {
  beforeSave: PromiseCallback[];
  afterSave: PromiseCallback[];
  beforeUpdate: PromiseCallback[];
  afterUpdate: PromiseCallback[];
  beforeDelete: PromiseCallback[];
  afterDelete: PromiseCallback[];
  beforeReload: PromiseCallback[];
  afterReload: PromiseCallback[];
  beforeAssign: SyncCallback[];
  afterAssign: SyncCallback[];
};

export type Validator = (klass: NextModel) => Promise<boolean>;
export interface Validators {
  [key: string]: Validator | Validator[];
};
export interface ValidatorArrays {
  [key: string]: Validator[];
};

export function Model(model: typeof NextModel): typeof NextModel {
  let modelName: string = model.name;
  try {
    if (model.modelName.length === 0) {
      throw new MinLengthError('#modelName', 1);
    }
    modelName = model.modelName;
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let identifier: string = 'id';
  try {
    if (model.identifier.length === 0) {
      throw new MinLengthError('#identifier', 1);
    }
    identifier = model.identifier;
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let dbConnector: Connector = new DefaultConnector();
  try {
    dbConnector = model.dbConnector;
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  let attrAccessors: string[] = [];
  try {
    attrAccessors = model.attrAccessors;
    for (const attrAccessor of attrAccessors) {
      if (attrAccessor.length === 0) {
        throw new MinLengthError('#attrAccessor', 1);
      }
    }
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let belongsTo: StrictBelongsTo = {};
  try {
    for (const name in model.belongsTo) {
      const relation = model.belongsTo[name];
      const foreignKey = relation.foreignKey || camelCase(
        relation.model.modelName + 'Id'
      );
      belongsTo[name] = {
        foreignKey,
        model: relation.model,
      };
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  const hasMany: StrictHasMany = {};
  try {
    for (const name in model.hasMany) {
      const relation = model.hasMany[name];
      const foreignKey = relation.foreignKey || camelCase(
        modelName + 'Id'
      );
      hasMany[name] = {
        foreignKey,
        model: relation.model,
      };
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  const hasOne: StrictHasOne = {};
  try {
    for (const name in model.hasOne) {
      const relation = model.hasOne[name];
      const foreignKey = relation.foreignKey || camelCase(
        modelName + 'Id'
      );
      hasOne[name] = {
        foreignKey,
        model: relation.model,
      };
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  let schema: Schema = {};
  try {
    schema = model.schema;
  } catch (e) {
    // just PropertyNotDefinedError expected
  }
  for (const name in belongsTo) {
    const relation = belongsTo[name];
    if (schema[relation.foreignKey] === undefined) {
      schema[relation.foreignKey] = {};
      const model = relation.model;
      if (
        model.identifier !== undefined &&
        model.schema !== undefined
      ) {
        const schemaAttr = model.schema[model.identifier];
        if (schemaAttr !== undefined) {
          schema[relation.foreignKey].type = schemaAttr.type;
        }
      }
    }
  }
  if (identifier && schema[identifier] === undefined) {
    schema[identifier] = <SchemaAttribute<number>>{
      type: 'integer',
    };
  }

  const validators: ValidatorArrays = {};
  try {
    for (const name in (model.validators || {})) {
      const validator = model.validators[name];
      if (validator === undefined) {
        // skip
      } else if (Array.isArray(validator)) {
        validators[name] = validator;
      } else {
        validators[name] = [validator];
      }
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  function promisifyCallbacks(cbs: PromiseCallback | PromiseCallback[] | undefined): PromiseCallback[] {
    if (cbs === undefined) {
      return [];
    } else if (Array.isArray(cbs)) {
      return cbs;
    } else {
      return [cbs];
    }
  }

  function syncifyCallbacks(cbs: SyncCallback | SyncCallback[] | undefined): SyncCallback[] {
    if (cbs === undefined) {
      return [];
    } else if (Array.isArray(cbs)) {
      return cbs;
    } else {
      return [cbs];
    }
  }

  let callbacks: CallbackArrays = {
    beforeSave: [],
    afterSave: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: [],
    beforeReload: [],
    afterReload: [],
    beforeAssign: [],
    afterAssign: [],
  };
  try {
    callbacks = {
      beforeSave: promisifyCallbacks(model.callbacks.beforeSave),
      afterSave: promisifyCallbacks(model.callbacks.afterSave),
      beforeUpdate: promisifyCallbacks(model.callbacks.beforeUpdate),
      afterUpdate: promisifyCallbacks(model.callbacks.afterUpdate),
      beforeDelete: promisifyCallbacks(model.callbacks.beforeDelete),
      afterDelete: promisifyCallbacks(model.callbacks.afterDelete),
      beforeReload: promisifyCallbacks(model.callbacks.beforeReload),
      afterReload: promisifyCallbacks(model.callbacks.afterReload),
      beforeAssign: syncifyCallbacks(model.callbacks.beforeAssign),
      afterAssign: syncifyCallbacks(model.callbacks.afterAssign),
    };
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  let skip: number = 0;
  try {
    if (model.skip < 0) {
      throw new LowerBoundsError('#skip', 0);
    }
    if (!Number.isInteger(model.skip)) {
      throw new TypeError('#skip', 'integer');
    }
    skip = model.skip;
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let limit: number = Number.MAX_SAFE_INTEGER;
  try {
    if (model.limit < 0) {
      throw new LowerBoundsError('#limit', 0);
    }
    if (!Number.isInteger(model.limit)) {
      throw new TypeError('#limit', 'integer');
    }
    limit = model.limit;
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let query: Query = {};
  try {
    query = model.query;
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  let order: Order = {};
  try {
    order = model.order;
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  let skippedValidators: string[] = [];
  try {
    if (model.skippedValidators === undefined) {
      // keep default
    } else if (typeof model.skippedValidators === 'string') {
      skippedValidators = [model.skippedValidators];
    } else {
      skippedValidators = model.skippedValidators;
    }
    for (const skippedValidator of skippedValidators) {
      if (skippedValidator.length === 0) {
        throw new MinLengthError('#skippedValidator', 1);
      }
    }
  } catch (e) {
    if (!(e instanceof PropertyNotDefinedError)) throw e;
  }

  let skippedCallbacks: (PromiseCallbackKeys | SyncCallbackKeys)[] = [];
  try {
    if (model.skippedCallbacks === undefined) {
      // keep default
    } else if (typeof model.skippedCallbacks === 'string') {
      skippedCallbacks = [model.skippedCallbacks];
    } else {
      skippedCallbacks = model.skippedCallbacks;
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  const keys = Object.keys(schema);
  keys.push.apply(keys, attrAccessors);

  const lookupKeys: BooleanLookupDict = {};
  for (const key of keys) {
    lookupKeys[key] = true;
  }

  const dbKeys = Object.keys(schema);

  const lookupDbKeys: BooleanLookupDict = {};
  for (const key of dbKeys) {
    lookupDbKeys[key] = true;
  }

  class StrictNextModel extends model {
    [key: string]: any;
    changes: Changes = {};
    errors: Errors = {};

    static get modelName(): string {
      return modelName;
    }

    static get identifier(): string {
      return identifier;
    }

    static get dbConnector(): Connector {
      return dbConnector;
    }

    static get attrAccessors(): string[] {
      return attrAccessors;
    }

    static get schema(): Schema {
      return schema;
    }

    static get belongsTo(): StrictBelongsTo {
      return belongsTo;
    }

    static get hasMany(): StrictHasMany {
      return hasMany;
    }

    static get hasOne(): StrictHasOne {
      return hasOne;
    }

    static get validators(): ValidatorArrays {
      return validators;
    }

    static get activeValidators(): Validator[] {
      const validators: Validator[] = [];
      for (const key in this.model.validators) {
        if (!this.model.isValidatorSkipped(key)) {
          validators.push(...this.model.validators[key]);
        }
      }
      return validators;
    }

    static get callbacks(): CallbackArrays {
      return callbacks;
    }

    static get activeCallbacks(): CallbackArrays {
      const isSkipped: (key: string) => boolean = this.model.isCallbackSkipped;
      return {
        beforeSave: isSkipped('beforeSave') ? [] : callbacks.beforeSave,
        afterSave: isSkipped('afterSave') ? [] : callbacks.afterSave,
        beforeUpdate: isSkipped('beforeUpdate') ? [] : callbacks.beforeUpdate,
        afterUpdate: isSkipped('afterUpdate') ? [] : callbacks.afterUpdate,
        beforeDelete: isSkipped('beforeDelete') ? [] : callbacks.beforeDelete,
        afterDelete: isSkipped('afterDelete') ? [] : callbacks.afterDelete,
        beforeReload: isSkipped('beforeReload') ? [] : callbacks.beforeReload,
        afterReload: isSkipped('afterReload') ? [] : callbacks.afterReload,
        beforeAssign: isSkipped('beforeAssign') ? [] : callbacks.beforeAssign,
        afterAssign: isSkipped('afterAssign') ? [] : callbacks.afterAssign,
      };
    }

    static get skip(): number {
      return skip;
    }

    static get limit(): number {
      return limit;
    }

    static get query(): Query {
      return query;
    }

    static get order(): Order {
      return order;
    }

    static get skippedValidators(): string[] {
      return skippedValidators;
    }

    static isValidatorSkipped(key: string): boolean {
      for (const validatorKey of this.skippedValidators) {
        if (validatorKey === key) return true;
      }
      return false;
    }

    static get skippedCallbacks(): (PromiseCallbackKeys | SyncCallbackKeys)[] {
      return skippedCallbacks;
    }

    static isCallbackSkipped(key: string): boolean {
      for (const callbackKey of this.skippedCallbacks) {
        if (callbackKey === key) return true;
      }
      return false;
    }

    static get keys(): string[] {
      return keys;
    }

    static get dbKeys(): string[] {
      return dbKeys;
    }

    static queryBy(queryBy: Query, combinator: string = '$and'): typeof StrictNextModel {
      let query: Query = {};
      if (Object.keys(this.query).length > 0) {
        query = {
          [combinator]: [
            this.query,
            queryBy,
          ],
        };
      } else {
        query = {
          [combinator]: [queryBy],
        };
      }

      return class extends this {
        static get query(): Query {
          return query;
        }
      };
    }

    static andQueryBy(queryBy: Query): typeof StrictNextModel {
      return this.queryBy(queryBy);
    }

    static orQueryBy(queryBy: Query): typeof StrictNextModel {
      return this.queryBy(queryBy, '$or');
    }

    static notQueryBy(queryBy: Query): typeof StrictNextModel {
      return this.queryBy(queryBy, '$not');
    }

    static orderBy(orderBy: Order): typeof StrictNextModel {
      return class extends this {
        static get order(): Order {
          return orderBy;
        }
      };
    }

    static scope({query, order}: {query: Query, order: Order}): typeof StrictNextModel {
      return this.queryBy(query).orderBy(order);
    };

    static get unqueried(): typeof StrictNextModel {
      return class extends this {
        static get query(): Query {
          return {};
        }
      };
    }

    static get unordered(): typeof StrictNextModel {
      return class extends this {
        static get order(): Order {
          return {};
        }
      };
    }

    static get model(): typeof StrictNextModel {
      return class extends this {
        static get query(): Query {
          return {};
        }

        static get order(): Order {
          return {};
        }
      };
    }

    constructor(attrs?: Attributes) {
      super();
      if (attrs !== undefined) {
        this.assign(attrs);
      }
      this.resetChanges();
    }

    resetChanges(): NextModel {
      this.changes = {};
      return this;
    }

    get attributes(): Attributes {
      const attrs: Attributes = {};
      keys.map(key => attrs[key] = this[key]);
      return attrs;
    }

    get dbAttributes(): Attributes {
      const attrs: Attributes = {};
      dbKeys.map(key => attrs[key] = this[key]);
      return attrs;
    }

    get model(): typeof NextModel {
      return <typeof NextModel>this.constructor;
    }
  };

  let Class: typeof StrictNextModel = StrictNextModel;

  for (const key of keys) {
    Class = class NewClass extends Class {
      get [key]() {
        return this[key];
      }

      set [key](value: any) {
        if (this[key] !== value) {
          const change: Change | undefined = this.changes[key];
          if (change !== undefined) {
            if (change.from === value) {
              delete this.changes[key];
            } else {
              change.to = value;
            }
          } else {
            this.changes[key] = <Change>{
              from: this[key],
              to: value,
            };
          }
          this[key] = value;
        }
      }
    };
  }

  for (const name in belongsTo) {
    Class = class NewClass extends Class {
      get [name]() {
        const model = <typeof StrictNextModel>this.constructor;
        const relation: StrictRelation = model.hasMany[name];
        const id = this[relation.foreignKey];
        if (id !== undefined && id !== null) {
          const query: Query = {
            [relation.model.identifier]: id,
          };
          return relation.model.queryBy(query).first;
        } else {
          return Promise.resolve(undefined);
        }
      }

      set [name](value: any) {
        const model = <typeof StrictNextModel>this.constructor;
        const relation: StrictRelation = model.hasMany[name];
        if (value === undefined || value === null) {
          this[relation.foreignKey] = undefined;
        } else {
          this[relation.foreignKey] = value[relation.model.identifier];
        }
      }
    };
  }

  for (const name in hasMany) {
    Class = class NewClass extends Class {
      get [name]() {
        const model = <typeof StrictNextModel>this.constructor;
        const relation: StrictRelation = model.hasMany[name];
        const id = this[model.identifier];
        if (id !== undefined && id !== null) {
          const query: Query = {
            [relation.foreignKey]: id,
          };
          return relation.model.queryBy(query);
        } else {
          throw new PropertyNotDefinedError('#' + model.identifier);
        }
      }
    };
  }

  for (const name in hasOne) {
    Class = class NewClass extends Class {
      get [name]() {
        const model = <typeof StrictNextModel>this.constructor;
        const relation: StrictRelation = model.hasOne[name];
        const id = this[model.identifier];
        if (id !== undefined && id !== null) {
          const query: Query = {
            [relation.foreignKey]: id,
          };
          return relation.model.queryBy(query);
        } else {
          throw new PropertyNotDefinedError('#' + model.identifier);
        }
      }
    };
  }

  return Class;
};

export class NextModel {
  [key: string]: any;
  changes: Changes;
  errors: Errors;

  static get modelName(): string {
    throw new PropertyNotDefinedError('.modelName');
  }

  static get identifier(): string {
    throw new PropertyNotDefinedError('.identifier');
  }

  static get dbConnector(): Connector {
    throw new PropertyNotDefinedError('.dbConnector');
  }


  static get attrAccessors(): string[] {
    throw new PropertyNotDefinedError('.attrAccessors');
  }

  static get schema(): Schema {
    throw new PropertyNotDefinedError('.schema');
  }

  static get belongsTo(): BelongsTo {
    throw new PropertyNotDefinedError('.belongsTo');
  }

  static get hasMany(): HasMany {
    throw new PropertyNotDefinedError('.hasMany');
  }

  static get hasOne(): HasOne {
    throw new PropertyNotDefinedError('.hasOne');
  }

  static get validators(): Validators {
    throw new PropertyNotDefinedError('.validators');
  }

  static get callbacks(): Callbacks {
    throw new PropertyNotDefinedError('.callbacks');
  }


  static get skip(): number {
    throw new PropertyNotDefinedError('.skip');
  }

  static get limit(): number {
    throw new PropertyNotDefinedError('.limit');
  }

  static get query(): Query {
    throw new PropertyNotDefinedError('.query');
  }

  static get order(): Order {
    throw new PropertyNotDefinedError('.order');
  }

  static get skippedValidators(): string | string[] {
    throw new PropertyNotDefinedError('.skippedValidators');
  }

  static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
    throw new PropertyNotDefinedError('.skippedCallbacks');
  }

  static get scopes(): Scopes {
    throw new PropertyNotDefinedError('.scopes');
  }


  static get keys(): string[] {
    throw new PropertyNotDefinedError('.keys');
  }

  static get dbKeys(): string[] {
    throw new PropertyNotDefinedError('.dbKeys');
  }

  static queryBy(queryBy: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.queryBy()');
  }

  static andQueryBy(queryBy: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.andQueryBy()');
  }

  static orQueryBy(queryBy: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.orQueryBy()');
  }

  static notQueryBy(queryBy: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.notQueryBy()');
  }

  static orderBy(orderBy: Order): typeof NextModel {
    throw new PropertyNotDefinedError('.orderBy()');
  }

  static get unqueried(): typeof NextModel {
    throw new PropertyNotDefinedError('.unqueried');
  }

  static get unordered(): typeof NextModel {
    throw new PropertyNotDefinedError('.unordered');
  }

  static get model(): typeof NextModel {
    throw new PropertyNotDefinedError('.model');
  }

  static get all(): Promise<NextModel[]> {
    throw new PropertyNotDefinedError('.all');
  }

  static get first(): Promise<NextModel | undefined> {
    throw new PropertyNotDefinedError('.first');
  }

  static get count(): Promise<number> {
    throw new PropertyNotDefinedError('.count');
  }

  constructor(attrs?: Attributes) {

  }

  get attributes(): Attributes {
    throw new PropertyNotDefinedError('#attributes');
  }

  get dbAttributes(): Attributes {
    throw new PropertyNotDefinedError('#attributes');
  }

  save(): Promise<NextModel> {
    throw new PropertyNotDefinedError('#save');
  }

  delete(): Promise<NextModel> {
    throw new PropertyNotDefinedError('#delete');
  }

  update(attrs: Attributes): Promise<NextModel> {
    throw new PropertyNotDefinedError('#update');
  }

  reload(): Promise<NextModel> {
    throw new PropertyNotDefinedError('#reload');
  }

  assign(attrs: Attributes): NextModel {
    throw new PropertyNotDefinedError('#assign');
  }

  get isNew(): boolean {
    throw new PropertyNotDefinedError('#isNew');
  }

  get isPersisted(): boolean {
    throw new PropertyNotDefinedError('#isPersisted');
  }

  get model(): typeof NextModel {
    throw new PropertyNotDefinedError('#model');
  }

  isValid(): Promise<boolean> {
    throw new PropertyNotDefinedError('#isValid');
  }
};


export default NextModel;
