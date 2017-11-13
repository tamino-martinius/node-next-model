import {
  Connector,
  DefaultConnector,
} from './connector';

export {
  Connector,
  DefaultConnector,
} from './connector';

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

export interface Dict<T> {
  [key: string]: T;
}

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
  $and?: Query[];
  $or?: Query[];
  $not?: Query[];
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
export type SyncCallbackKeys = 'beforeAssign' | 'afterAssign' | 'beforeChange' | 'afterChange'
export type PromiseCallback = (klass: NextModel) => Promise<boolean>;
export type PromiseCallbackKeys = 'beforeValidation' | 'afterValidation' | 'beforeSave' | 'afterSave' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' | 'beforeReload' | 'afterReload'

export interface Callbacks {
  beforeSave?: PromiseCallback | PromiseCallback[];
  afterSave?: PromiseCallback | PromiseCallback[];
  beforeValidation?: PromiseCallback | PromiseCallback[];
  afterValidation?: PromiseCallback | PromiseCallback[];
  beforeUpdate?: PromiseCallback | PromiseCallback[];
  afterUpdate?: PromiseCallback | PromiseCallback[];
  beforeDelete?: PromiseCallback | PromiseCallback[];
  afterDelete?: PromiseCallback | PromiseCallback[];
  beforeReload?: PromiseCallback | PromiseCallback[];
  afterReload?: PromiseCallback | PromiseCallback[];
  beforeAssign?: SyncCallback | SyncCallback[];
  afterAssign?: SyncCallback | SyncCallback[];
  beforeChange?: SyncCallback | SyncCallback[];
  afterChange?: SyncCallback | SyncCallback[];
};

export interface CallbackArrays {
  beforeValidation: PromiseCallback[];
  afterValidation: PromiseCallback[];
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
  beforeChange: SyncCallback[];
  afterChange: SyncCallback[];
};

export type Validator = (klass: NextModel) => Promise<Error | boolean>;
export interface Validators {
  [key: string]: Validator | Validator[];
};
export interface ValidatorArrays {
  [key: string]: Validator[];
};

export function dictValues<T>(dict: Dict<T>): T[] {
  return Object.keys(dict).map(key => dict[key]);
}

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
  const smallModelName: string = modelName[0].toLowerCase() + modelName.substr(1);

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
      const foreignKey = relation.foreignKey || relation.model.smallModelName + 'Id';
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
      const foreignKey = relation.foreignKey || smallModelName + 'Id';
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
      const foreignKey = relation.foreignKey || smallModelName + 'Id';
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
      const schemaAttr = model.schema[model.identifier];
      schema[relation.foreignKey].type = schemaAttr.type;
    }
  }
  if (identifier && schema[identifier] === undefined) {
    schema[identifier] = <SchemaAttribute<number>>{
      type: 'integer',
    };
  }

  const validators: ValidatorArrays = {};
  try {
    for (const name in (model.validators)) {
      const validator = model.validators[name];
      if (Array.isArray(validator)) {
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
    beforeValidation: [],
    afterValidation: [],
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
    beforeChange: [],
    afterChange: [],
  };
  try {
    callbacks = {
      beforeValidation: promisifyCallbacks(model.callbacks.beforeValidation),
      afterValidation: promisifyCallbacks(model.callbacks.afterValidation),
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
      beforeChange: syncifyCallbacks(model.callbacks.beforeChange),
      afterChange: syncifyCallbacks(model.callbacks.afterChange),
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
    if (typeof model.skippedValidators === 'string') {
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
    if (typeof model.skippedCallbacks === 'string') {
      skippedCallbacks = [model.skippedCallbacks];
    } else {
      skippedCallbacks = model.skippedCallbacks;
    }
  } catch (e) {
    // just PropertyNotDefinedError expected
  }

  const keys = Object.keys(schema);
  keys.push.apply(keys, attrAccessors);

  const lookupKeys: Dict<boolean> = {};
  for (const key of keys) {
    lookupKeys[key] = true;
  }

  const dbKeys = Object.keys(schema);

  const lookupDbKeys: Dict<boolean> = {};
  for (const key of dbKeys) {
    lookupDbKeys[key] = true;
  }

  class StrictNextModel extends model {
    [key: string]: any;
    data: Attributes = {};
    _changes: Changes = {};
    _errors: Errors = {};

    static get modelName(): string {
      return modelName;
    }

    static get smallModelName(): string {
      return smallModelName;
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

    static get activeValidators(): ValidatorArrays {
      const validators: ValidatorArrays = {};
      for (const key in this.validators) {
        if (!this.isValidatorSkipped(key)) {
          validators[key] = this.validators[key];
        }
      }
      return validators;
    }

    static get callbacks(): CallbackArrays {
      return callbacks;
    }

    static get activeCallbacks(): CallbackArrays {
      return {
        beforeValidation: (this.isCallbackSkipped('beforeValidation') ? [] : callbacks.beforeValidation),
        afterValidation: (this.isCallbackSkipped('afterValidation') ? [] : callbacks.afterValidation),
        beforeSave: (this.isCallbackSkipped('beforeSave') ? [] : callbacks.beforeSave),
        afterSave: (this.isCallbackSkipped('afterSave') ? [] : callbacks.afterSave),
        beforeUpdate: (this.isCallbackSkipped('beforeUpdate') ? [] : callbacks.beforeUpdate),
        afterUpdate: (this.isCallbackSkipped('afterUpdate') ? [] : callbacks.afterUpdate),
        beforeDelete: (this.isCallbackSkipped('beforeDelete') ? [] : callbacks.beforeDelete),
        afterDelete: (this.isCallbackSkipped('afterDelete') ? [] : callbacks.afterDelete),
        beforeReload: (this.isCallbackSkipped('beforeReload') ? [] : callbacks.beforeReload),
        afterReload: (this.isCallbackSkipped('afterReload') ? [] : callbacks.afterReload),
        beforeAssign: (this.isCallbackSkipped('beforeAssign') ? [] : callbacks.beforeAssign),
        afterAssign: (this.isCallbackSkipped('afterAssign') ? [] : callbacks.afterAssign),
        beforeChange: (this.isCallbackSkipped('beforeChange') ? [] : callbacks.beforeChange),
        afterChange: (this.isCallbackSkipped('afterChange') ? [] : callbacks.afterChange),
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

    static isCallbackSkipped(key: PromiseCallbackKeys | SyncCallbackKeys): boolean {
      for (const callbackKey of this.skippedCallbacks) {
        if (callbackKey === key) return true;
      }
      return false;
    }

    static get keys(): string[] {
      return keys;
    }

    static hasKey(key: string) {
      return !!lookupKeys[key];
    }

    static get dbKeys(): string[] {
      return dbKeys;
    }

    static hasDbKey(key: string) {
      return !!lookupDbKeys[key];
    }

    static get queryAttributes(): Attributes {
      const attrs: Attributes = {};
      for (const key in this.query) {
        if (!(key[0] === '$')) {
          attrs[key] = this.query[key];
        }
      }
      return attrs;
    }

    static mergeAttributes(attrs1: Attributes, attrs2: Attributes): Attributes {
      const attrs: Attributes = attrs1;
      for (const key in attrs2) {
        attrs[key] = attrs2[key];
      }
      return attrs;
    }

    static runPromiseCallbacks(callbacks: PromiseCallback[], instance: NextModel): Promise<boolean> {
      const cb: PromiseCallback | undefined = callbacks.shift();
      if (cb === undefined) {
        return Promise.resolve(true);
      } else {
        return cb(instance).then(successful => {
          if (successful === false) {
            return false;
          } else {
            return this.runPromiseCallbacks(callbacks, instance);
          }
        }).catch(() => false)
      }
    }

    static runSyncCallbacks(callbacks: SyncCallback[], instance: NextModel): boolean {
      const cb: SyncCallback | undefined = callbacks.shift();
      if (cb === undefined) {
        return true;
      } else {
        try {
          if (cb(instance) === false) {
            return false;
          } else {
            return this.runSyncCallbacks(callbacks, instance);
          }
        } catch {
          return false;
        }
      }
    }

    static skipBy(amount: number): typeof NextModel {
      if (amount < 0) {
        throw new LowerBoundsError('#skipBy', 0);
      }
      if (!Number.isInteger(amount)) {
        throw new TypeError('#skipBy', 'integer');
      }
      return class extends this {
        static get skip(): number {
          return amount;
        }
      };
    }

    static get unskipped(): typeof NextModel {
      return class extends this {
        static get skip(): number {
          return 0;
        }
      };
    }

    static limitBy(amount: number): typeof NextModel {
      if (amount < 0) {
        throw new LowerBoundsError('#limitBy', 0);
      }
      if (!Number.isInteger(amount)) {
        throw new TypeError('#limitBy', 'integer');
      }

      return class extends this {
        static get limit(): number {
          return amount;
        }
      };
    }

    static get unlimited(): typeof NextModel {
      return class extends this {
        static get limit(): number {
          return Number.MAX_SAFE_INTEGER;
        }
      };
    }

    private static simplifyQuery(query: Query): Query {
      const result: Query = {};
      for (const key in query) {
        if (key === '$and' && query.$and !== undefined) {
          const $and: Query[] = query.$and.map(q => this.simplifyQuery(q));
          const keyCounts: Dict<number> = $and.reduce((counts, q) => {
            for (const key of Object.keys(q)) {
              if (key.startsWith('$')) {
                counts[key] = 2;
              } else {
                if (counts[key] === undefined) {
                  counts[key] = 1;
                } else {
                  counts[key] += 1;
                }
              }
            }
            return counts;
          }, <Dict<number>>{});
          const maxKeyCount: number = Math.max(...dictValues(keyCounts));
          const onlyNewKeys: boolean = Object.keys(query).reduce(
            (onlyNew, k) => onlyNew = onlyNew && keyCounts[k] === undefined
            , true
          );
          if (maxKeyCount === 1 && onlyNewKeys) {
            for (const subQuery of $and) {
              Object.keys(subQuery).forEach(k => result[k] = subQuery[k]);
            }
          } else {
            result.$and = $and;
          }
        } else {
          if (key.startsWith('$') && query[key] !== undefined) {
            const subQueries: Query[] = query[key];
            result[key] = subQueries.map(q => this.simplifyQuery(q));
          } else {
            result[key] = query[key];
          }
        }
      }
      return result;
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

      query = this.simplifyQuery(query);

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

    static get unscoped(): typeof StrictNextModel {
      return class extends this {
        static get query(): Query {
          return {};
        }

        static get order(): Order {
          return {};
        }
      };
    }

    static get all(): Promise<NextModel[]> {
      return this.dbConnector.all(this);
    }

    static get first(): Promise<NextModel | undefined> {
      return this.dbConnector.first(this);
    }

    static get count(): Promise<number> {
      return this.dbConnector.count(this.unordered);
    }

    static updateAll(attrs: Attributes): Promise<NextModel[]> {
      return this.dbConnector.updateAll(this, attrs);
    }

    static deleteAll(): Promise<NextModel[]> {
      return this.dbConnector.deleteAll(this);
    }

    static build(attrs: Attributes = {}): NextModel {
      return new this(this.mergeAttributes(this.queryAttributes, attrs));
    }

    static create(attrs: Attributes = {}): Promise<NextModel> {
      return new this(this.mergeAttributes(this.queryAttributes, attrs)).save();
    }

    static firstOrInitialize(attrs: Attributes = {}): Promise<NextModel> {
      return this.first.then(model => {
        if (model === undefined) {
          return this.build(attrs);
        } else {
          return model.assign(attrs);
        }
      });
    }

    static firstOrCreate(attrs: Attributes = {}): Promise<NextModel> {
      return this.first.then(model => {
        if (model === undefined) {
          return this.create(attrs);
        } else {
          return model.assign(attrs).save();
        }
      });
    }

    constructor(attrs?: Attributes) {
      super(attrs)
      keys.map(key => this.data[key] = undefined);
      if (attrs !== undefined) {
        this.assign(attrs);
      }
      this.resetChanges();
      this.resetErrors();
    }

    private resetChanges(): NextModel {
      this._changes = {};
      return this;
    }

    private resetErrors(): NextModel {
      this._errors = {};
      return this;
    }

    addError(key: string, error: Error): NextModel {
      if (this._errors[key] === undefined) {
        this._errors[key] = [error];
      } else {
        this._errors[key].push(error);
      }
      return this;
    }

    get attributes(): Attributes {
      return this.data;
    }

    get dbAttributes(): Attributes {
      const attrs: Attributes = {};
      dbKeys.map(key => attrs[key] = this[key]);
      return attrs;
    }

    save(): Promise<NextModel> {
      return this.isValid().then(isValid => {
        if (isValid) {
          const beforeCallbacks = this.model.activeCallbacks.beforeSave;
          return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
            if (successful === true) {
              const promise = this.isNew ?
                this.model.dbConnector.create(this) :
                this.model.dbConnector.update(this);
              return promise.then(instance => {
                const afterCallbacks = this.model.activeCallbacks.afterSave;
                this.model.runPromiseCallbacks(afterCallbacks, instance);
                return instance;
              })
            } else {
              return Promise.reject(this);
            }
          })
        } else {
          return Promise.reject(this);
        }
      });
    }

    delete(): Promise<NextModel> {
      const beforeCallbacks = this.model.activeCallbacks.beforeDelete;
      return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
        if (successful === true) {
          return this.model.dbConnector.delete(this).then(instance => {
            const afterCallbacks = this.model.activeCallbacks.afterDelete;
            this.model.runPromiseCallbacks(afterCallbacks, instance);
            return instance;
          });
        } else {
          return Promise.reject(this);
        }
      });
    }

    update(attrs: Attributes): Promise<NextModel> {
      this.assign(attrs);
      const beforeCallbacks = this.model.activeCallbacks.beforeUpdate;
      return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
        if (successful === true) {
          return this.save().then(instance => {
            const afterCallbacks = this.model.activeCallbacks.afterUpdate;
            this.model.runPromiseCallbacks(afterCallbacks, instance);
            return instance;
          });
        } else {
          return Promise.reject(this);
        }
      });
    }

    reload(): Promise<NextModel | undefined> {
      const beforeCallbacks = this.model.activeCallbacks.beforeReload;
      return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
        if (successful === true) {
          return this.model.dbConnector.reload(this).then(instance => {
            const afterCallbacks = this.model.activeCallbacks.afterReload;
            this.model.runPromiseCallbacks(afterCallbacks, instance || this);
            return instance;
          });
        } else {
          return Promise.reject(this);
        }
      });
    }

    assign(attrs: Attributes): NextModel {
      const beforeCallbacks = this.model.activeCallbacks.beforeAssign;
      if (this.model.runSyncCallbacks(beforeCallbacks, this) === true) {
        for (const key in attrs) {
          if (this.model.hasKey(key)) {
            this.data[key] = attrs[key];
          }
        }
        const afterCallbacks = this.model.activeCallbacks.afterAssign;
        this.model.runSyncCallbacks(afterCallbacks, this);
      }
      return this;
    }

    get isNew(): boolean {
      return this[this.model.identifier] === undefined;
    }

    get isPersisted(): boolean {
      return !this.isNew;
    }

    get hasChanges(): boolean {
      return Object.keys(this._changes).length > 0;
    }

    get changes(): Changes {
      return this._changes;
    }

    revertChange(key: string): StrictNextModel {
      if (this._changes[key] !== undefined) {
        this[key] = this._changes[key].from;
      }
      return this;
    }

    revertChanges(): StrictNextModel {
      for (const key of Object.keys(this._changes)) {
        this[key] = this._changes[key].from;
      }
      return this;
    }

    get hasErrors(): boolean {
      return Object.keys(this._errors).length > 0;
    }

    get errors(): Errors {
      return this._errors;
    }

    get model(): typeof StrictNextModel {
      return <typeof StrictNextModel>this.constructor;
    }

    isValid(): Promise<boolean> {
      const beforeCallbacks = this.model.activeCallbacks.beforeValidation;
      return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
        if (successful === true) {
          this.resetErrors();
          const promises: Promise<boolean>[] = [];
          const activeValidators: ValidatorArrays = this.model.activeValidators;
          for (const key in activeValidators) {
            const validators = activeValidators[key];
            for (const validator of validators) {
              promises.push(validator(this).then(validationResult => {
                if (validationResult === true) {
                  return true;
                } else if (validationResult === false) {
                  this.addError(key, new Error('Validation Failed'));
                  return false;
                } else {
                  this.addError(key, validationResult);
                  return false;
                }
              }));
            }
          }
          return Promise.all(promises).then(bools => {
            for (const bool of bools) {
              if (bool === false) return false;
            }
            return true;
          }).then(isValid => {
            const afterCallbacks = this.model.activeCallbacks.afterValidation;
            this.model.runPromiseCallbacks(afterCallbacks, this);
            return isValid;
          });
        } else {
          return Promise.resolve(false);
        }
      });
    }
  };

  let Class: typeof StrictNextModel = StrictNextModel;

  for (const key of keys) {
    Class = class NewClass extends Class {
      get [key]() {
        return this.data[key];
      }

      set [key](value: any) {
        const beforeCallbacks = this.model.activeCallbacks.beforeChange;
        if (this.model.runSyncCallbacks(beforeCallbacks, this) === true) {
          if (this.data[key] !== value) {
            const change: Change | undefined = this._changes[key];
            if (change !== undefined) {
              if (change.from === value) {
                delete this._changes[key];
              } else {
                change.to = value;
              }
            } else {
              this._changes[key] = <Change>{
                from: this.data[key],
                to: value,
              };
            }
            this.data[key] = value;
          }
          const afterCallbacks = this.model.activeCallbacks.afterChange;
          this.model.runSyncCallbacks(afterCallbacks, this);
        }
      }
    };
  }

  for (const name in belongsTo) {
    Class = class NewClass extends Class {
      get [name]() {
        const relation = <StrictRelation>this.model.belongsTo[name];
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
        const relation = <StrictRelation>this.model.belongsTo[name];
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
          return relation.model.queryBy(query).first;
        } else {
          return Promise.reject(new PropertyNotDefinedError('#' + model.identifier));
        }
      }
    };
  }

  return Class;
};

export class NextModel {
  [key: string]: any;
  data: Attributes;
  _changes: Changes;
  _errors: Errors;

  static get modelName(): string {
    throw new PropertyNotDefinedError('.modelName');
  }

  static get smallModelName(): string {
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

  static get activeValidators(): ValidatorArrays {
    throw new PropertyNotDefinedError('.activeValidators');
  }

  static get callbacks(): Callbacks {
    throw new PropertyNotDefinedError('.callbacks');
  }

  static get activeCallbacks(): CallbackArrays {
    throw new PropertyNotDefinedError('.activeCallbacks');
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

  static isValidatorSkipped(_key: string): boolean {
    throw new PropertyNotDefinedError('.isValidatorSkipped');
  }

  static get skippedCallbacks(): PromiseCallbackKeys | SyncCallbackKeys | (PromiseCallbackKeys | SyncCallbackKeys)[] {
    throw new PropertyNotDefinedError('.skippedCallbacks');
  }

  static isCallbackSkipped(_key: string): boolean {
    throw new PropertyNotDefinedError('.isCallbackSkipped');
  }

  static get keys(): string[] {
    throw new PropertyNotDefinedError('.keys');
  }

  static hasKey(_key: string): boolean {
    throw new PropertyNotDefinedError('.hasKey');
  }

  static get dbKeys(): string[] {
    throw new PropertyNotDefinedError('.dbKeys');
  }

  static hasDbKey(_key: string): boolean {
    throw new PropertyNotDefinedError('.hasDbKey');
  }

  static skipBy(_amount: number): typeof NextModel {
    throw new PropertyNotDefinedError('.skipBy()');
  }

  static get unskipped(): typeof NextModel {
    throw new PropertyNotDefinedError('.unskip()');
  }

  static limitBy(_amount: number): typeof NextModel {
    throw new PropertyNotDefinedError('.limitBy()');
  }

  static get unlimited(): typeof NextModel {
    throw new PropertyNotDefinedError('.unlimited()');
  }

  static queryBy(_query: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.queryBy()');
  }

  static andQueryBy(_query: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.andQueryBy()');
  }

  static orQueryBy(_query: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.orQueryBy()');
  }

  static notQueryBy(_query: Query): typeof NextModel {
    throw new PropertyNotDefinedError('.notQueryBy()');
  }

  static orderBy(_order: Order): typeof NextModel {
    throw new PropertyNotDefinedError('.orderBy()');
  }

  static get unqueried(): typeof NextModel {
    throw new PropertyNotDefinedError('.unqueried');
  }

  static get unordered(): typeof NextModel {
    throw new PropertyNotDefinedError('.unordered');
  }

  static get unscoped(): typeof NextModel {
    throw new PropertyNotDefinedError('.unscoped');
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

  static updateAll(_attrs?: Attributes): Promise<NextModel[]> {
    throw new PropertyNotDefinedError('.updateAll');
  }

  static deleteAll(): Promise<NextModel[]> {
    throw new PropertyNotDefinedError('.deleteAll');
  }

  static build(_attrs?: Attributes): NextModel {
    throw new PropertyNotDefinedError('.build');
  }

  static create(_attrs?: Attributes): Promise<NextModel> {
    throw new PropertyNotDefinedError('.create');
  }

  static firstOrCreate(_attrs?: Attributes): Promise<NextModel> {
    throw new PropertyNotDefinedError('.firstOrCreate');
  }

  static firstOrInitialize(_attrs?: Attributes): Promise<NextModel> {
    throw new PropertyNotDefinedError('.firstOrInitialize');
  }

  constructor(_attrs?: Attributes) {

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

  update(_attrs: Attributes): Promise<NextModel> {
    throw new PropertyNotDefinedError('#update');
  }

  reload(): Promise<NextModel | undefined> {
    throw new PropertyNotDefinedError('#reload');
  }

  assign(_attrs: Attributes): NextModel {
    throw new PropertyNotDefinedError('#assign');
  }

  get isNew(): boolean {
    throw new PropertyNotDefinedError('#isNew');
  }

  get isPersisted(): boolean {
    throw new PropertyNotDefinedError('#isPersisted');
  }

  get hasChanges(): boolean {
    throw new PropertyNotDefinedError('#hasChanges');
  }

  revertChange(_key: string): NextModel {
    throw new PropertyNotDefinedError('#revertChange');
  }

  revertChanges(): NextModel {
    throw new PropertyNotDefinedError('#revertChanges');
  }

  get changes(): Changes {
    throw new PropertyNotDefinedError('#changes');
  }

  get hasErrors(): boolean {
    throw new PropertyNotDefinedError('#hasErrors');
  }

  get errors(): Errors {
    throw new PropertyNotDefinedError('#errors');
  }

  get model(): typeof NextModel {
    throw new PropertyNotDefinedError('#model');
  }

  isValid(): Promise<boolean> {
    throw new PropertyNotDefinedError('#isValid');
  }
};


export default NextModel;
