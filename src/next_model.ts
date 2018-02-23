import {
  ModelConstructor,
  Filter,
  BelongsTo,
  HasOne,
  HasMany,
  StrictFilter,
  StrictBelongsTo,
  StrictHasOne,
  StrictHasMany,
  Schema,
  ModelStatic,
  BaseType,
} from './types';

import {
} from './util'

function Model<S, T extends ModelStatic<S>>() {
  return (constructor: T) => {
  };
}

class NextModel<S extends Schema> implements ModelConstructor<T> {
  private static cachedStrictDefaultFilter: StrictFilter<S> | undefined;
  private static cachedBelongsTo: StrictBelongsTo | undefined;
  private static cachedHasOne: StrictHasOne | undefined;
  private static cachedHasMany: StrictHasMany | undefined;

  static get strictDefaultFilter(): StrictFilter<S> {
    if (this.cachedStrictDefaultFilter !== undefined) {
      return this.cachedStrictDefaultFilter;
    } else {
      // [TODO] Generate strict version
      return {};
    }
  }

  static get strictBelongsTo(): StrictBelongsTo {
    if (this.cachedBelongsTo !== undefined) {
      return this.cachedBelongsTo;
    } else {
      // [TODO] Generate strict version
      return {};
    }
  }

  static get strictHasOne(): StrictHasOne {
    if (this.cachedHasOne !== undefined) {
      return this.cachedHasOne;
    } else {
      // [TODO] Generate strict version
      return {};
    }
  }

  static get strictHasMany(): StrictHasMany {
    if (this.cachedHasMany !== undefined) {
      return this.cachedHasMany;
    } else {
      // [TODO] Generate strict version
      return {};
    }
  }

  constructor(props: Partial<S>) {

  }

  get model(): ModelStatic<S> {
    return <ModelStatic<S>>this.constructor;
  }
}

interface UserSchema extends Schema {
  firstName: string;
  lastName: string;
}

@Model<UserSchema, ModelStatic<UserSchema>>()
class User extends NextModel<UserSchema> {
  static readonly modelName: string = 'User';
  firstName: string;
  lastName: string;
  // [key: string]: any;

  static get schema() {
    return {
      firstName: 'TEst',
      lastName: 'TEst',
    };
  }
}

const u = new User({firstName: 'test'});

// import {
//   Connector,
//   DefaultConnector,
// } from './connector';

// export {
//   Connector,
//   DefaultConnector,
// } from './connector';

// export interface Relation {
//   model: typeof NextModel,
//   foreignKey?: string;
// };

// export class PropertyNotDefinedError {
//   message: string;

//   constructor(name: string) {
//     this.message = `
//       Please define readonly property '${name}'
//       or use 'Model' Decorator to apply defaults
//     `;
//   }
// };

// export class LowerBoundsError {
//   message: string;

//   constructor(name: string, lowerBound: number) {
//     this.message = `
//       Property '${name}' is expected to be greater or equal to '${lowerBound}'
//     `;
//   }
// };

// export class MinLengthError {
//   message: string;

//   constructor(name: string, minLength: number) {
//     this.message = `
//       Property '${name}' length is expected to be longer or equal to '${minLength}'
//     `;
//   }
// };

// export class TypeError {
//   message: string;

//   constructor(name: string, type: string) {
//     this.message = `
//       Property '${name}' is expected to an '${type}'
//     `;
//   }
// };

// export interface Dict<T> {
//   [key: string]: T;
// }

// export interface BelongsTo {
//   [key: string]: Relation;
// };

// export interface HasMany {
//   [key: string]: Relation;
// };

// export interface HasOne {
//   [key: string]: Relation;
// };

// export interface StrictRelation {
//   model: typeof NextModel,
//   foreignKey: string;
// };

// export interface StrictBelongsTo extends BelongsTo {
//   [key: string]: StrictRelation;
// };

// export interface StrictHasMany extends HasMany {
//   [key: string]: StrictRelation;
// };

// export interface StrictHasOne extends HasOne {
//   [key: string]: StrictRelation;
// };

// export interface Schema {
//   [key: string]: SchemaAttribute<any>;
// };

// export interface SchemaAttribute<Type> {
//   type?: string; // Only needed for js usage
//   defaultValue?: Type;
//   defaultGenerator?: (klass: NextModel) => Type;
// };

// export interface Scope {
//   query?: Query;
//   order?: Order;
// };

// export interface Unscope {
//   query?: Unquery;
//   order?: Unorder;
// };

// export type Unquery = string | string[];
// export type Unorder = string | string[];

// export interface Scopes {
//   [key: string]: Scope;
// };

// export interface Query {
//   $and?: Query[];
//   $or?: Query[];
//   $not?: Query[];
//   [key: string]: any;
// };

// export interface Attributes {
//   [key: string]: any;
// }

// export type OrderDirection = 'asc' | 'desc';

// export interface Order {
//   [key: string]: OrderDirection;
// };

// export interface Change {
//   from: any;
//   to: any;
// };

// export interface Changes {
//   [key: string]: Change;
// };

// export interface Errors {
//   [key: string]: Error[];
// };

// export type SyncCallback = (klass: NextModel) => boolean;
// export type SyncCallbackKeys = 'beforeAssign' | 'afterAssign' | 'beforeChange' | 'afterChange'
// export type PromiseCallback = (klass: NextModel) => Promise<boolean>;
// export type PromiseCallbackKeys = 'beforeValidation' | 'afterValidation' | 'beforeSave' | 'afterSave' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' | 'beforeReload' | 'afterReload'
// export type CallbackKeys = SyncCallbackKeys | PromiseCallbackKeys;

// export interface Callbacks {
//   beforeSave?: PromiseCallback | PromiseCallback[];
//   afterSave?: PromiseCallback | PromiseCallback[];
//   beforeValidation?: PromiseCallback | PromiseCallback[];
//   afterValidation?: PromiseCallback | PromiseCallback[];
//   beforeUpdate?: PromiseCallback | PromiseCallback[];
//   afterUpdate?: PromiseCallback | PromiseCallback[];
//   beforeDelete?: PromiseCallback | PromiseCallback[];
//   afterDelete?: PromiseCallback | PromiseCallback[];
//   beforeReload?: PromiseCallback | PromiseCallback[];
//   afterReload?: PromiseCallback | PromiseCallback[];
//   beforeAssign?: SyncCallback | SyncCallback[];
//   afterAssign?: SyncCallback | SyncCallback[];
//   beforeChange?: SyncCallback | SyncCallback[];
//   afterChange?: SyncCallback | SyncCallback[];
// };

// export interface CallbackArrays {
//   beforeValidation: PromiseCallback[];
//   afterValidation: PromiseCallback[];
//   beforeSave: PromiseCallback[];
//   afterSave: PromiseCallback[];
//   beforeUpdate: PromiseCallback[];
//   afterUpdate: PromiseCallback[];
//   beforeDelete: PromiseCallback[];
//   afterDelete: PromiseCallback[];
//   beforeReload: PromiseCallback[];
//   afterReload: PromiseCallback[];
//   beforeAssign: SyncCallback[];
//   afterAssign: SyncCallback[];
//   beforeChange: SyncCallback[];
//   afterChange: SyncCallback[];
// };

// export type Validator = (klass: NextModel) => Promise<Error | boolean>;
// export interface Validators {
//   [key: string]: Validator | Validator[];
// };
// export interface ValidatorArrays {
//   [key: string]: Validator[];
// };

// export function dictValues<T>(dict: Dict<T>): T[] {
//   return Object.keys(dict).map(key => dict[key]);
// }

// export function Model(model: typeof NextModel): typeof NextModel {
//   let modelName: string = model.name;
//   try {
//     if (model.modelName.length === 0) {
//       throw new MinLengthError('#modelName', 1);
//     }
//     modelName = model.modelName;
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }
//   const smallModelName: string = modelName[0].toLowerCase() + modelName.substr(1);

//   let identifier: string = 'id';
//   try {
//     if (model.identifier.length === 0) {
//       throw new MinLengthError('#identifier', 1);
//     }
//     identifier = model.identifier;
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }

//   let dbConnector: Connector = new DefaultConnector();
//   try {
//     dbConnector = model.dbConnector;
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   let attrAccessors: string[] = [];
//   try {
//     attrAccessors = model.attrAccessors;
//     for (const attrAccessor of attrAccessors) {
//       if (attrAccessor.length === 0) {
//         throw new MinLengthError('#attrAccessor', 1);
//       }
//     }
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }

//   let belongsTo: StrictBelongsTo = {};
//   try {
//     for (const name in model.belongsTo) {
//       const relation = model.belongsTo[name];
//       const foreignKey = relation.foreignKey || relation.model.smallModelName + 'Id';
//       belongsTo[name] = {
//         foreignKey,
//         model: relation.model,
//       };
//     }
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   const hasMany: StrictHasMany = {};
//   try {
//     for (const name in model.hasMany) {
//       const relation = model.hasMany[name];
//       const foreignKey = relation.foreignKey || smallModelName + 'Id';
//       hasMany[name] = {
//         foreignKey,
//         model: relation.model,
//       };
//     }
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   const hasOne: StrictHasOne = {};
//   try {
//     for (const name in model.hasOne) {
//       const relation = model.hasOne[name];
//       const foreignKey = relation.foreignKey || smallModelName + 'Id';
//       hasOne[name] = {
//         foreignKey,
//         model: relation.model,
//       };
//     }
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   let schema: Schema = {};
//   try {
//     schema = model.schema;
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }
//   for (const name in belongsTo) {
//     const relation = belongsTo[name];
//     if (schema[relation.foreignKey] === undefined) {
//       schema[relation.foreignKey] = {};
//       const model = relation.model;
//       const schemaAttr = model.schema[model.identifier];
//       schema[relation.foreignKey].type = schemaAttr.type;
//     }
//   }
//   if (identifier && schema[identifier] === undefined) {
//     schema[identifier] = <SchemaAttribute<number>>{
//       type: 'integer',
//     };
//   }

//   const validators: ValidatorArrays = {};
//   try {
//     for (const name in (model.validators)) {
//       const validator = model.validators[name];
//       if (Array.isArray(validator)) {
//         validators[name] = validator;
//       } else {
//         validators[name] = [validator];
//       }
//     }
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   function promisifyCallbacks(cbs: PromiseCallback | PromiseCallback[] | undefined): PromiseCallback[] {
//     if (cbs === undefined) {
//       return [];
//     } else if (Array.isArray(cbs)) {
//       return cbs;
//     } else {
//       return [cbs];
//     }
//   }

//   function syncifyCallbacks(cbs: SyncCallback | SyncCallback[] | undefined): SyncCallback[] {
//     if (cbs === undefined) {
//       return [];
//     } else if (Array.isArray(cbs)) {
//       return cbs;
//     } else {
//       return [cbs];
//     }
//   }

//   let callbacks: CallbackArrays = {
//     beforeValidation: [],
//     afterValidation: [],
//     beforeSave: [],
//     afterSave: [],
//     beforeUpdate: [],
//     afterUpdate: [],
//     beforeDelete: [],
//     afterDelete: [],
//     beforeReload: [],
//     afterReload: [],
//     beforeAssign: [],
//     afterAssign: [],
//     beforeChange: [],
//     afterChange: [],
//   };
//   try {
//     callbacks = {
//       beforeValidation: promisifyCallbacks(model.callbacks.beforeValidation),
//       afterValidation: promisifyCallbacks(model.callbacks.afterValidation),
//       beforeSave: promisifyCallbacks(model.callbacks.beforeSave),
//       afterSave: promisifyCallbacks(model.callbacks.afterSave),
//       beforeUpdate: promisifyCallbacks(model.callbacks.beforeUpdate),
//       afterUpdate: promisifyCallbacks(model.callbacks.afterUpdate),
//       beforeDelete: promisifyCallbacks(model.callbacks.beforeDelete),
//       afterDelete: promisifyCallbacks(model.callbacks.afterDelete),
//       beforeReload: promisifyCallbacks(model.callbacks.beforeReload),
//       afterReload: promisifyCallbacks(model.callbacks.afterReload),
//       beforeAssign: syncifyCallbacks(model.callbacks.beforeAssign),
//       afterAssign: syncifyCallbacks(model.callbacks.afterAssign),
//       beforeChange: syncifyCallbacks(model.callbacks.beforeChange),
//       afterChange: syncifyCallbacks(model.callbacks.afterChange),
//     };
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   let skip: number = 0;
//   try {
//     if (model.skip < 0) {
//       throw new LowerBoundsError('#skip', 0);
//     }
//     if (!Number.isInteger(model.skip)) {
//       throw new TypeError('#skip', 'integer');
//     }
//     skip = model.skip;
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }

//   let limit: number = Number.MAX_SAFE_INTEGER;
//   try {
//     if (model.limit < 0) {
//       throw new LowerBoundsError('#limit', 0);
//     }
//     if (!Number.isInteger(model.limit)) {
//       throw new TypeError('#limit', 'integer');
//     }
//     limit = model.limit;
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }

//   let query: Query = {};
//   try {
//     query = model.query;
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   let order: Order = {};
//   try {
//     order = model.order;
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   let skippedValidators: string[] = [];
//   try {
//     if (typeof model.skippedValidators === 'string') {
//       skippedValidators = [model.skippedValidators];
//     } else {
//       skippedValidators = model.skippedValidators;
//     }
//     for (const skippedValidator of skippedValidators) {
//       if (skippedValidator.length === 0) {
//         throw new MinLengthError('#skippedValidator', 1);
//       }
//     }
//   } catch (e) {
//     if (!(e instanceof PropertyNotDefinedError)) throw e;
//   }

//   let skippedCallbacks: CallbackKeys[] = [];
//   try {
//     if (typeof model.skippedCallbacks === 'string') {
//       skippedCallbacks = [model.skippedCallbacks];
//     } else {
//       skippedCallbacks = model.skippedCallbacks;
//     }
//   } catch (e) {
//     // just PropertyNotDefinedError expected
//   }

//   const keys = Object.keys(schema);
//   keys.push.apply(keys, attrAccessors);

//   const lookupKeys: Dict<boolean> = {};
//   for (const key of keys) {
//     lookupKeys[key] = true;
//   }

//   const dbKeys = Object.keys(schema);

//   const lookupDbKeys: Dict<boolean> = {};
//   for (const key of dbKeys) {
//     lookupDbKeys[key] = true;
//   }

//   class StrictNextModel extends model {
//     [key: string]: any;
//     data: Attributes = {};
//     _changes: Changes = {};
//     _errors: Errors = {};

//     static get modelName(): string {
//       return modelName;
//     }

//     static get smallModelName(): string {
//       return smallModelName;
//     }

//     static get identifier(): string {
//       return identifier;
//     }

//     static get dbConnector(): Connector {
//       return dbConnector;
//     }

//     static get attrAccessors(): string[] {
//       return attrAccessors;
//     }

//     static get schema(): Schema {
//       return schema;
//     }

//     static get belongsTo(): StrictBelongsTo {
//       return belongsTo;
//     }

//     static get hasMany(): StrictHasMany {
//       return hasMany;
//     }

//     static get hasOne(): StrictHasOne {
//       return hasOne;
//     }

//     static get validators(): ValidatorArrays {
//       return validators;
//     }

//     static get activeValidators(): ValidatorArrays {
//       const validators: ValidatorArrays = {};
//       for (const key in this.validators) {
//         if (!this.isValidatorSkipped(key)) {
//           validators[key] = this.validators[key];
//         }
//       }
//       return validators;
//     }

//     static get callbacks(): CallbackArrays {
//       return callbacks;
//     }

//     static get activeCallbacks(): CallbackArrays {
//       return {
//         beforeValidation: (this.isCallbackSkipped('beforeValidation') ? [] : callbacks.beforeValidation),
//         afterValidation: (this.isCallbackSkipped('afterValidation') ? [] : callbacks.afterValidation),
//         beforeSave: (this.isCallbackSkipped('beforeSave') ? [] : callbacks.beforeSave),
//         afterSave: (this.isCallbackSkipped('afterSave') ? [] : callbacks.afterSave),
//         beforeUpdate: (this.isCallbackSkipped('beforeUpdate') ? [] : callbacks.beforeUpdate),
//         afterUpdate: (this.isCallbackSkipped('afterUpdate') ? [] : callbacks.afterUpdate),
//         beforeDelete: (this.isCallbackSkipped('beforeDelete') ? [] : callbacks.beforeDelete),
//         afterDelete: (this.isCallbackSkipped('afterDelete') ? [] : callbacks.afterDelete),
//         beforeReload: (this.isCallbackSkipped('beforeReload') ? [] : callbacks.beforeReload),
//         afterReload: (this.isCallbackSkipped('afterReload') ? [] : callbacks.afterReload),
//         beforeAssign: (this.isCallbackSkipped('beforeAssign') ? [] : callbacks.beforeAssign),
//         afterAssign: (this.isCallbackSkipped('afterAssign') ? [] : callbacks.afterAssign),
//         beforeChange: (this.isCallbackSkipped('beforeChange') ? [] : callbacks.beforeChange),
//         afterChange: (this.isCallbackSkipped('afterChange') ? [] : callbacks.afterChange),
//       };
//     }

//     static get skip(): number {
//       return skip;
//     }

//     static get limit(): number {
//       return limit;
//     }

//     static get query(): Query {
//       return query;
//     }

//     static get order(): Order {
//       return order;
//     }

//     static get skippedValidators(): string[] {
//       return skippedValidators;
//     }

//     static skipValidator(key: string): typeof StrictNextModel {
//       const skippedValidators: string[] = [key];
//       skippedValidators.push(...this.skippedValidators);
//       return class extends this {
//         static get skippedValidators(): string[] {
//           return skippedValidators;
//         }
//       };
//     }

//     static skipValidators(keys: string[]): typeof StrictNextModel {
//       const skippedValidators: string[] = keys;
//       skippedValidators.push(...this.skippedValidators);
//       return class extends this {
//         static get skippedValidators(): string[] {
//           return skippedValidators;
//         }
//       };
//     }

//     static isValidatorSkipped(key: string): boolean {
//       for (const validatorKey of this.skippedValidators) {
//         if (validatorKey === key) return true;
//       }
//       return false;
//     }

//     static get skippedCallbacks(): CallbackKeys[] {
//       return skippedCallbacks;
//     }

//     static skipCallback(key: CallbackKeys): typeof StrictNextModel {
//       const skippedCallbacks: CallbackKeys[] = [key];
//       skippedCallbacks.push(...this.skippedCallbacks);
//       return class extends this {
//         static get skippedCallbacks(): CallbackKeys[] {
//           return skippedCallbacks;
//         }
//       };
//     }

//     static skipCallbacks(keys: CallbackKeys[]): typeof StrictNextModel {
//       const skippedCallbacks: CallbackKeys[] = keys;
//       skippedCallbacks.push(...this.skippedCallbacks);
//       return class extends this {
//         static get skippedCallbacks(): CallbackKeys[] {
//           return skippedCallbacks;
//         }
//       };
//     }

//     static isCallbackSkipped(key: CallbackKeys): boolean {
//       for (const callbackKey of this.skippedCallbacks) {
//         if (callbackKey === key) return true;
//       }
//       return false;
//     }

//     static get keys(): string[] {
//       return keys;
//     }

//     static hasKey(key: string) {
//       return !!lookupKeys[key];
//     }

//     static get dbKeys(): string[] {
//       return dbKeys;
//     }

//     static hasDbKey(key: string) {
//       return !!lookupDbKeys[key];
//     }

//     static get queryAttributes(): Attributes {
//       const attrs: Attributes = {};
//       for (const key in this.query) {
//         if (!(key[0] === '$')) {
//           attrs[key] = this.query[key];
//         }
//       }
//       return attrs;
//     }

//     static mergeAttributes(attrs1: Attributes, attrs2: Attributes): Attributes {
//       const attrs: Attributes = attrs1;
//       for (const key in attrs2) {
//         attrs[key] = attrs2[key];
//       }
//       return attrs;
//     }

//     static runPromiseCallbacks(callbacks: PromiseCallback[], instance: NextModel): Promise<boolean> {
//       const cb: PromiseCallback | undefined = callbacks.shift();
//       if (cb === undefined) {
//         return Promise.resolve(true);
//       } else {
//         return cb(instance).then(successful => {
//           if (successful === false) {
//             return false;
//           } else {
//             return this.runPromiseCallbacks(callbacks, instance);
//           }
//         }).catch(() => false)
//       }
//     }

//     static runSyncCallbacks(callbacks: SyncCallback[], instance: NextModel): boolean {
//       const cb: SyncCallback | undefined = callbacks.shift();
//       if (cb === undefined) {
//         return true;
//       } else {
//         try {
//           if (cb(instance) === false) {
//             return false;
//           } else {
//             return this.runSyncCallbacks(callbacks, instance);
//           }
//         } catch {
//           return false;
//         }
//       }
//     }

//     static skipBy(amount: number): typeof NextModel {
//       if (amount < 0) {
//         throw new LowerBoundsError('#skipBy', 0);
//       }
//       if (!Number.isInteger(amount)) {
//         throw new TypeError('#skipBy', 'integer');
//       }
//       return class extends this {
//         static get skip(): number {
//           return amount;
//         }
//       };
//     }

//     static get unskipped(): typeof NextModel {
//       return class extends this {
//         static get skip(): number {
//           return 0;
//         }
//       };
//     }

//     static limitBy(amount: number): typeof NextModel {
//       if (amount < 0) {
//         throw new LowerBoundsError('#limitBy', 0);
//       }
//       if (!Number.isInteger(amount)) {
//         throw new TypeError('#limitBy', 'integer');
//       }

//       return class extends this {
//         static get limit(): number {
//           return amount;
//         }
//       };
//     }

//     static get unlimited(): typeof NextModel {
//       return class extends this {
//         static get limit(): number {
//           return Number.MAX_SAFE_INTEGER;
//         }
//       };
//     }

//     private static simplifyQuery(query: Query): Query {
//       const result: Query = {};
//       for (const key in query) {
//         if (key === '$and' && query.$and !== undefined) {
//           const $and: Query[] = query.$and.map(q => this.simplifyQuery(q));
//           const keyCounts: Dict<number> = $and.reduce((counts, q) => {
//             for (const key of Object.keys(q)) {
//               if (key.startsWith('$')) {
//                 counts[key] = 2;
//               } else {
//                 if (counts[key] === undefined) {
//                   counts[key] = 1;
//                 } else {
//                   counts[key] += 1;
//                 }
//               }
//             }
//             return counts;
//           }, <Dict<number>>{});
//           const maxKeyCount: number = Math.max(...dictValues(keyCounts));
//           const onlyNewKeys: boolean = Object.keys(query).reduce(
//             (onlyNew, k) => onlyNew = onlyNew && keyCounts[k] === undefined
//             , true
//           );
//           if (maxKeyCount === 1 && onlyNewKeys) {
//             for (const subQuery of $and) {
//               Object.keys(subQuery).forEach(k => result[k] = subQuery[k]);
//             }
//           } else {
//             result.$and = $and;
//           }
//         } else {
//           if (key.startsWith('$') && query[key] !== undefined) {
//             const subQueries: Query[] = query[key];
//             result[key] = subQueries.map(q => this.simplifyQuery(q));
//           } else {
//             result[key] = query[key];
//           }
//         }
//       }
//       return result;
//     }

//     static queryBy(queryBy: Query, combinator: string = '$and'): typeof StrictNextModel {
//       let query: Query = {};
//       if (Object.keys(this.query).length > 0) {
//         query = {
//           [combinator]: [
//             this.query,
//             queryBy,
//           ],
//         };
//       } else {
//         query = {
//           [combinator]: [queryBy],
//         };
//       }

//       query = this.simplifyQuery(query);

//       return class extends this {
//         static get query(): Query {
//           return query;
//         }
//       };
//     }

//     static andQueryBy(queryBy: Query): typeof StrictNextModel {
//       return this.queryBy(queryBy);
//     }

//     static orQueryBy(queryBy: Query): typeof StrictNextModel {
//       return this.queryBy(queryBy, '$or');
//     }

//     static notQueryBy(queryBy: Query): typeof StrictNextModel {
//       return this.queryBy(queryBy, '$not');
//     }

//     static orderBy(orderBy: Order): typeof StrictNextModel {
//       return class extends this {
//         static get order(): Order {
//           return orderBy;
//         }
//       };
//     }

//     static get unqueried(): typeof StrictNextModel {
//       return class extends this {
//         static get query(): Query {
//           return {};
//         }
//       };
//     }

//     static get unordered(): typeof StrictNextModel {
//       return class extends this {
//         static get order(): Order {
//           return {};
//         }
//       };
//     }

//     static get unscoped(): typeof StrictNextModel {
//       return class extends this {
//         static get query(): Query {
//           return {};
//         }

//         static get order(): Order {
//           return {};
//         }
//       };
//     }

//     static get all(): Promise<NextModel[]> {
//       return this.dbConnector.all(this);
//     }

//     static get first(): Promise<NextModel | undefined> {
//       return this.dbConnector.first(this);
//     }

//     static get count(): Promise<number> {
//       return this.dbConnector.count(this.unordered);
//     }

//     static updateAll(attrs: Attributes): Promise<NextModel[]> {
//       return this.dbConnector.updateAll(this, attrs);
//     }

//     static deleteAll(): Promise<NextModel[]> {
//       return this.dbConnector.deleteAll(this);
//     }

//     static build(attrs: Attributes = {}): NextModel {
//       return new this(this.mergeAttributes(this.queryAttributes, attrs));
//     }

//     static create(attrs: Attributes = {}): Promise<NextModel> {
//       return new this(this.mergeAttributes(this.queryAttributes, attrs)).save();
//     }

//     static firstOrInitialize(attrs: Attributes = {}): Promise<NextModel> {
//       return this.first.then(model => {
//         if (model === undefined) {
//           return this.build(attrs);
//         } else {
//           return model.assign(attrs);
//         }
//       });
//     }

//     static firstOrCreate(attrs: Attributes = {}): Promise<NextModel> {
//       return this.first.then(model => {
//         if (model === undefined) {
//           return this.create(attrs);
//         } else {
//           return model.assign(attrs).save();
//         }
//       });
//     }

//     constructor(attrs: Attributes = {}) {
//       super(attrs);
//       const dataKeys: string[] = Object.keys(this.data);
//       const emptyKeys = keys.filter(key => dataKeys.indexOf(key) === -1);
//       emptyKeys.map(key => this.data[key] = undefined);
//       if (Object.keys(attrs).length > 0){
//         this.assign(attrs);
//       }
//       this.resetChanges();
//       this.resetErrors();
//     }

//     private resetChanges(): NextModel {
//       this._changes = {};
//       return this;
//     }

//     private resetErrors(): NextModel {
//       this._errors = {};
//       return this;
//     }

//     addError(key: string, error: Error): NextModel {
//       if (this._errors[key] === undefined) {
//         this._errors[key] = [error];
//       } else {
//         this._errors[key].push(error);
//       }
//       return this;
//     }

//     get attributes(): Attributes {
//       return this.data;
//     }

//     get dbAttributes(): Attributes {
//       const attrs: Attributes = {};
//       dbKeys.map(key => attrs[key] = this[key]);
//       return attrs;
//     }

//     save(): Promise<NextModel> {
//       return this.isValid().then(isValid => {
//         if (isValid) {
//           const beforeCallbacks = this.model.activeCallbacks.beforeSave;
//           return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
//             if (successful === true) {
//               const promise = this.isNew ?
//                 this.model.dbConnector.create(this) :
//                 this.model.dbConnector.update(this);
//               return promise.then(instance => {
//                 const afterCallbacks = this.model.activeCallbacks.afterSave;
//                 this.model.runPromiseCallbacks(afterCallbacks, instance);
//                 return instance;
//               })
//             } else {
//               return Promise.reject(this);
//             }
//           })
//         } else {
//           return Promise.reject(this);
//         }
//       });
//     }

//     delete(): Promise<NextModel> {
//       const beforeCallbacks = this.model.activeCallbacks.beforeDelete;
//       return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
//         if (successful === true) {
//           return this.model.dbConnector.delete(this).then(instance => {
//             const afterCallbacks = this.model.activeCallbacks.afterDelete;
//             this.model.runPromiseCallbacks(afterCallbacks, instance);
//             return instance;
//           });
//         } else {
//           return Promise.reject(this);
//         }
//       });
//     }

//     update(attrs: Attributes): Promise<NextModel> {
//       this.assign(attrs);
//       const beforeCallbacks = this.model.activeCallbacks.beforeUpdate;
//       return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
//         if (successful === true) {
//           return this.save().then(instance => {
//             const afterCallbacks = this.model.activeCallbacks.afterUpdate;
//             this.model.runPromiseCallbacks(afterCallbacks, instance);
//             return instance;
//           });
//         } else {
//           return Promise.reject(this);
//         }
//       });
//     }

//     reload(): Promise<NextModel | undefined> {
//       const beforeCallbacks = this.model.activeCallbacks.beforeReload;
//       return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
//         if (successful === true) {
//           return this.model.dbConnector.reload(this).then(instance => {
//             const afterCallbacks = this.model.activeCallbacks.afterReload;
//             this.model.runPromiseCallbacks(afterCallbacks, instance || this);
//             return instance;
//           });
//         } else {
//           return Promise.reject(this);
//         }
//       });
//     }

//     assign(attrs: Attributes): NextModel {
//       const beforeCallbacks = this.model.activeCallbacks.beforeAssign;
//       if (this.model.runSyncCallbacks(beforeCallbacks, this) === true) {
//         for (const key in attrs) {
//           if (this.model.hasKey(key)) {
//             this.data[key] = attrs[key];
//           }
//         }
//         const afterCallbacks = this.model.activeCallbacks.afterAssign;
//         this.model.runSyncCallbacks(afterCallbacks, this);
//       }
//       return this;
//     }

//     get isNew(): boolean {
//       return this[this.model.identifier] === undefined;
//     }

//     get isPersisted(): boolean {
//       return !this.isNew;
//     }

//     get hasChanges(): boolean {
//       return Object.keys(this._changes).length > 0;
//     }

//     get changes(): Changes {
//       return this._changes;
//     }

//     revertChange(key: string): StrictNextModel {
//       if (this._changes[key] !== undefined) {
//         this[key] = this._changes[key].from;
//       }
//       return this;
//     }

//     revertChanges(): StrictNextModel {
//       for (const key of Object.keys(this._changes)) {
//         this[key] = this._changes[key].from;
//       }
//       return this;
//     }

//     get hasErrors(): boolean {
//       return Object.keys(this._errors).length > 0;
//     }

//     get errors(): Errors {
//       return this._errors;
//     }

//     get model(): typeof StrictNextModel {
//       return <typeof StrictNextModel>this.constructor;
//     }

//     isValid(): Promise<boolean> {
//       const beforeCallbacks = this.model.activeCallbacks.beforeValidation;
//       return this.model.runPromiseCallbacks(beforeCallbacks, this).then(successful => {
//         if (successful === true) {
//           this.resetErrors();
//           const promises: Promise<boolean>[] = [];
//           const activeValidators: ValidatorArrays = this.model.activeValidators;
//           for (const key in activeValidators) {
//             const validators = activeValidators[key];
//             for (const validator of validators) {
//               promises.push(validator(this).then(validationResult => {
//                 if (validationResult === true) {
//                   return true;
//                 } else if (validationResult === false) {
//                   this.addError(key, new Error('Validation Failed'));
//                   return false;
//                 } else {
//                   this.addError(key, validationResult);
//                   return false;
//                 }
//               }));
//             }
//           }
//           return Promise.all(promises).then(bools => {
//             for (const bool of bools) {
//               if (bool === false) return false;
//             }
//             return true;
//           }).then(isValid => {
//             const afterCallbacks = this.model.activeCallbacks.afterValidation;
//             this.model.runPromiseCallbacks(afterCallbacks, this);
//             return isValid;
//           });
//         } else {
//           return Promise.resolve(false);
//         }
//       });
//     }
//   };

//   let Class: typeof StrictNextModel = StrictNextModel;

//   for (const key of keys) {
//     Class = class NewClass extends Class {
//       get [key]() {
//         return this.data[key];
//       }

//       set [key](value: any) {
//         const beforeCallbacks = this.model.activeCallbacks.beforeChange;
//         if (this.model.runSyncCallbacks(beforeCallbacks, this) === true) {
//           if (this.data[key] !== value) {
//             const change: Change | undefined = this._changes[key];
//             if (change !== undefined) {
//               if (change.from === value) {
//                 delete this._changes[key];
//               } else {
//                 change.to = value;
//               }
//             } else {
//               this._changes[key] = <Change>{
//                 from: this.data[key],
//                 to: value,
//               };
//             }
//             this.data[key] = value;
//           }
//           const afterCallbacks = this.model.activeCallbacks.afterChange;
//           this.model.runSyncCallbacks(afterCallbacks, this);
//         }
//       }
//     };
//   }

//   for (const name in belongsTo) {
//     Class = class NewClass extends Class {
//       get [name]() {
//         const relation = <StrictRelation>this.model.belongsTo[name];
//         const id = this[relation.foreignKey];
//         if (id !== undefined && id !== null) {
//           const query: Query = {
//             [relation.model.identifier]: id,
//           };
//           return relation.model.queryBy(query).first;
//         } else {
//           return Promise.resolve(undefined);
//         }
//       }

//       set [name](value: any) {
//         const relation = <StrictRelation>this.model.belongsTo[name];
//         if (value === undefined || value === null) {
//           this[relation.foreignKey] = undefined;
//         } else {
//           this[relation.foreignKey] = value[relation.model.identifier];
//         }
//       }
//     };
//   }

//   for (const name in hasMany) {
//     Class = class NewClass extends Class {
//       get [name]() {
//         const model = <typeof StrictNextModel>this.constructor;
//         const relation: StrictRelation = model.hasMany[name];
//         const id = this[model.identifier];
//         if (id !== undefined && id !== null) {
//           const query: Query = {
//             [relation.foreignKey]: id,
//           };
//           return relation.model.queryBy(query);
//         } else {
//           throw new PropertyNotDefinedError('#' + model.identifier);
//         }
//       }
//     };
//   }

//   for (const name in hasOne) {
//     Class = class NewClass extends Class {
//       get [name]() {
//         const model = <typeof StrictNextModel>this.constructor;
//         const relation: StrictRelation = model.hasOne[name];
//         const id = this[model.identifier];
//         if (id !== undefined && id !== null) {
//           const query: Query = {
//             [relation.foreignKey]: id,
//           };
//           return relation.model.queryBy(query).first;
//         } else {
//           return Promise.reject(new PropertyNotDefinedError('#' + model.identifier));
//         }
//       }
//     };
//   }

//   return Class;
// };

// /**
//  * Rails like models using **TypeScript**.
//  *
//  * NextModel gives you the ability to:
//  *
//  * - Represent **models** and their data.
//  * - Represent **associations** between these models.
//  * - Represent **inheritance** hierarchies through related models.
//  * - Perform database operations in an **object-oriented** fashion.
//  * - Uses **Promises** for database queries.
//  *
//  * @export
//  * @class NextModel
//  */
// export class NextModel {
//   [key: string]: any;
//   data: Attributes;
//   _changes: Changes;
//   _errors: Errors;

//   /**
//    * The model name needs to be defined for every model.
//    * The name should be singular camelcase, starting with an uppercase char.
//    * If the `.modelName` is not passed its reflected from its Class Name.
//    *
//    * @readonly
//    * @static
//    * @type {string}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends NextModel {};
//    * User.modelName; //=> 'User'
//    * @example
//    * @Model
//    * class User extends NextModel {
//    *   static get modelName() {
//    *     return 'User';
//    *   }
//    * };
//    * User.modelName; //=> 'User'
//    * @example
//    * @Model
//    * class UserAddress extends NextModel {
//    *   static get modelName() {
//    *     return 'UserAddress';
//    *   }
//    * };
//    * UserAddress.modelName; //=> 'UserAddress'
//    */
//   static get modelName(): string {
//     throw new PropertyNotDefinedError('.modelName');
//   }

//   /**
//    * Returns same result as the `.modelName`, but starts with lower case character.
//    *
//    * @readonly
//    * @static
//    * @see modelName
//    * @type {string}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends NextModel {};
//    * User.smallModelName; //=> 'user'
//    * @example
//    * @Model
//    * class User extends NextModel {
//    *   static get modelName() {
//    *     return 'User';
//    *   }
//    * };
//    * User.smallModelName; //=> 'user'
//    * @example
//    * @Model
//    * class UserAddress extends NextModel {
//    *   static get modelName() {
//    *     return 'UserAddress';
//    *   }
//    * };
//    * UserAddress.smallModelName; //=> 'userAddress'
//    */
//   static get smallModelName(): string {
//     throw new PropertyNotDefinedError('.modelName');
//   }

//   /**
//    * Defines the name of the primary key. It also gets automatically added to
//    * the schema with type `'integer'` if the identifier is not present at the schema.
//    * The identifier values must be serialized to an unique value with `toString()`.
//    *
//    * @readonly
//    * @static
//    * @default 'id'
//    * @type {string}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends BaseModel {
//    *   static get identifier() {
//    *     return 'key';
//    *   }
//    * };
//    */
//   static get identifier(): string {
//     throw new PropertyNotDefinedError('.identifier');
//   }

//   /**
//    * A connector is the bridge between models and the database.
//    * NextModel comes with an DefaultConnector which reads and writes on an simpe js object.
//    *
//    * @readonly
//    * @static
//    * @default DefaultConnector
//    * @type {Connector}
//    * @memberof NextModel
//    * @example
//    * const Connector = require('next-model-knex-connector');
//    * const connector = new Connector(options);
//    *
//    * @Model
//    * class User extends NextModel {
//    *   static get connector() {
//    *     return connector;
//    *   }
//    * };
//    * @example
//    * class BaseModel extends NextModel {
//    *   static get connector() {
//    *     return connector;
//    *   }
//    * };
//    *
//    * @Model
//    * class User extends BaseModel {
//    *   ...
//    * };
//    *
//    * @Model
//    * class Address extends BaseModel {
//    *   ...
//    * };
//    */
//   static get dbConnector(): Connector {
//     throw new PropertyNotDefinedError('.dbConnector');
//   }

//   /**
//    * Accessors define properties which can be passed to `.build()`, `.create()`
//    * functions or assignments, but are not passed to the database
//    * Use them to store temporary data like passing values to model but not to database layer.
//    * Attributes defined this way are returned by `#attributes` but not by `#dbAttributes`.
//    *
//    * @readonly
//    * @static
//    * @default []
//    * @see build, create, attributes, dbAttributes
//    * @type {string[]}
//    * @memberof NextModel
//    * @example
//    * class User extends NextModel {
//    *   static get attrAccessors: string[] {
//    *     return [
//    *       'checkForConflicts',
//    *     ];
//    *   }
//    * };
//    *
//    * user = User.build({ checkForConflicts: true });
//    * user.checkForConflicts === true;
//    *
//    * user = User.build({ foo: 'bar' });
//    * user.foo === undefined;
//    */
//   static get attrAccessors(): string[] {
//     throw new PropertyNotDefinedError('.attrAccessors');
//   }

//   /**
//    * A schema describes all (database stored) properties. Foreign keys from
//    * relations like `.belongsTo` are automatically added to the schema.
//    * The existing types and their names are depending on the used Database connector.
//    *
//    * @readonly
//    * @static
//    * @default {}
//    * @see belongsTo
//    * @type {Schema}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends NextModel {
//    *   static get schema() {
//    *     return {
//    *       id: { type: 'integer' },
//    *       name: { type: 'string' },
//    *     };
//    *   }
//    * };
//    */
//   static get schema(): Schema {
//     throw new PropertyNotDefinedError('.schema');
//   }

//   /**
//    * A belongs_to association sets up a one-to-one connection with another model,
//    * such that each instance of the declaring model "belongs to" one instance
//    * of the other model.
//    *
//    * @readonly
//    * @static
//    * @type {BelongsTo}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends NextModel {
//    *   static get belongsTo() {
//    *     return {
//    *       address: { model: Address },
//    *     }
//    *   }
//    * };
//    *
//    * User.create({
//    *   addressId: id
//    * }).then(user => {
//    8   return user.address;
//    * }).then(address => {
//    *   address.id === id;
//    * });
//    *
//    * user = User.build();
//    * user.address = address;
//    * user.addressId === address.id;
//    */
//   static get belongsTo(): BelongsTo {
//     throw new PropertyNotDefinedError('.belongsTo');
//   }

//   /**
//    * A `.hasMany` association indicates a one-to-many connection with another model.
//    * You'll often find this association on the "other side" of a `.belongsTo` association.
//    * This association indicates that each instance of the model has zero or
//    * more instances of another model.
//    *
//    * @readonly
//    * @static
//    * @see belongsTo
//    * @type {HasMany}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class Address extends NextModel {
//    *   static get hasMany() {
//    *     return {
//    *       users: { model: User },
//    *     }
//    *   }
//    * };
//    *
//    * address.users.all.then(users => ... );
//    * address.users.create({ ... }).then(user => ... );
//    */
//   static get hasMany(): HasMany {
//     throw new PropertyNotDefinedError('.hasMany');
//   }

//   /**
//    * A `.hasOne` association also sets up a one-to-one connection with another model,
//    * but with somewhat different semantics (and consequences). This association indicates
//    * that each instance of a model contains or possesses one instance of another model.
//    *
//    * @readonly
//    * @static
//    * @type {HasOne}
//    * @memberof NextModel
//    * @example
//    * @Model
//    * class User extends NextModel {
//    *   static get hasOne() {
//    *     return {
//    *       address: { model: Address },
//    *     }
//    *   }
//    * };
//    *
//    * @Model
//    * class Address extends NextModel {
//    *   static get belongsTo() {
//    *     return {
//    *       user: { model: User },
//    *     }
//    *   }
//    * };
//    *
//    * user.address.then(address => ... );
//    */
//   static get hasOne(): HasOne {
//     throw new PropertyNotDefinedError('.hasOne');
//   }

//   /**
//    * Validators is an object with keys of type string and values which are Promises
//    * to check if an instance is valid. An Validator gets the model instance and
//    * returns an promised boolean. The values can also be Arrays of Validators.
//    * These validators are checked with `#isValid()`.
//    *
//    * @readonly
//    * @static
//    * @see isValid
//    * @type {Validators}
//    * @memberof NextModel
//    * @example
//    * class User extends NextModel {
//    *   static get validators: Validators {
//    *     return {
//    *       ageCheck: (user) => Promise.resolve(user.age > 0),
//    *     };
//    *   }
//    * };
//    *
//    * new User({ age: 28 }).isValid().then(isValid => ...) //=> true
//    * new User({ age: -1 }).isValid().then(isValid => ...) //=> flase
//    */
//   static get validators(): Validators {
//     throw new PropertyNotDefinedError('.validators');
//   }


//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {ValidatorArrays}
//    * @memberof NextModel
//    */
//   static get activeValidators(): ValidatorArrays {
//     throw new PropertyNotDefinedError('.activeValidators');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {Callbacks}
//    * @memberof NextModel
//    */
//   static get callbacks(): Callbacks {
//     throw new PropertyNotDefinedError('.callbacks');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {CallbackArrays}
//    * @memberof NextModel
//    */
//   static get activeCallbacks(): CallbackArrays {
//     throw new PropertyNotDefinedError('.activeCallbacks');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {number}
//    * @memberof NextModel
//    */
//   static get skip(): number {
//     throw new PropertyNotDefinedError('.skip');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {number}
//    * @memberof NextModel
//    */
//   static get limit(): number {
//     throw new PropertyNotDefinedError('.limit');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {Query}
//    * @memberof NextModel
//    */
//   static get query(): Query {
//     throw new PropertyNotDefinedError('.query');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {Order}
//    * @memberof NextModel
//    */
//   static get order(): Order {
//     throw new PropertyNotDefinedError('.order');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {(string | string[])}
//    * @memberof NextModel
//    */
//   static get skippedValidators(): string | string[] {
//     throw new PropertyNotDefinedError('.skippedValidators');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string} _key 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static skipValidator(_key: string): typeof NextModel {
//     throw new PropertyNotDefinedError('.skipValidator');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string[]} _keys 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static skipValidators(_keys: string[]): typeof NextModel {
//     throw new PropertyNotDefinedError('.skipValidators');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string} _key 
//    * @returns {boolean} 
//    * @memberof NextModel
//    */
//   static isValidatorSkipped(_key: string): boolean {
//     throw new PropertyNotDefinedError('.isValidatorSkipped');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {(CallbackKeys | CallbackKeys[])}
//    * @memberof NextModel
//    */
//   static get skippedCallbacks(): CallbackKeys | CallbackKeys[] {
//     throw new PropertyNotDefinedError('.skippedCallbacks');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {(CallbackKeys)} _key
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static skipCallback(_key: CallbackKeys): typeof NextModel {
//     throw new PropertyNotDefinedError('.skipCallback');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {(CallbackKeys[])} _keys
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static skipCallbacks(_keys: CallbackKeys[]): typeof NextModel {
//     throw new PropertyNotDefinedError('.skipCallbacks');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string} _key 
//    * @returns {boolean} 
//    * @memberof NextModel
//    */
//   static isCallbackSkipped(_key: string): boolean {
//     throw new PropertyNotDefinedError('.isCallbackSkipped');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {string[]}
//    * @memberof NextModel
//    */
//   static get keys(): string[] {
//     throw new PropertyNotDefinedError('.keys');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string} _key 
//    * @returns {boolean} 
//    * @memberof NextModel
//    */
//   static hasKey(_key: string): boolean {
//     throw new PropertyNotDefinedError('.hasKey');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {string[]}
//    * @memberof NextModel
//    */
//   static get dbKeys(): string[] {
//     throw new PropertyNotDefinedError('.dbKeys');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {string} _key 
//    * @returns {boolean} 
//    * @memberof NextModel
//    */
//   static hasDbKey(_key: string): boolean {
//     throw new PropertyNotDefinedError('.hasDbKey');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {number} _amount 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static skipBy(_amount: number): typeof NextModel {
//     throw new PropertyNotDefinedError('.skipBy()');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   static get unskipped(): typeof NextModel {
//     throw new PropertyNotDefinedError('.unskip()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {number} _amount 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static limitBy(_amount: number): typeof NextModel {
//     throw new PropertyNotDefinedError('.limitBy()');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   static get unlimited(): typeof NextModel {
//     throw new PropertyNotDefinedError('.unlimited()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Query} _query 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static queryBy(_query: Query): typeof NextModel {
//     throw new PropertyNotDefinedError('.queryBy()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Query} _query 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static andQueryBy(_query: Query): typeof NextModel {
//     throw new PropertyNotDefinedError('.andQueryBy()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Query} _query 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static orQueryBy(_query: Query): typeof NextModel {
//     throw new PropertyNotDefinedError('.orQueryBy()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Query} _query 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static notQueryBy(_query: Query): typeof NextModel {
//     throw new PropertyNotDefinedError('.notQueryBy()');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Order} _order 
//    * @returns {typeof NextModel} 
//    * @memberof NextModel
//    */
//   static orderBy(_order: Order): typeof NextModel {
//     throw new PropertyNotDefinedError('.orderBy()');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   static get unqueried(): typeof NextModel {
//     throw new PropertyNotDefinedError('.unqueried');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   static get unordered(): typeof NextModel {
//     throw new PropertyNotDefinedError('.unordered');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   static get unscoped(): typeof NextModel {
//     throw new PropertyNotDefinedError('.unscoped');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {Promise<NextModel[]>}
//    * @memberof NextModel
//    */
//   static get all(): Promise<NextModel[]> {
//     throw new PropertyNotDefinedError('.all');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {(Promise<NextModel | undefined>)}
//    * @memberof NextModel
//    */
//   static get first(): Promise<NextModel | undefined> {
//     throw new PropertyNotDefinedError('.first');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @static
//    * @type {Promise<number>}
//    * @memberof NextModel
//    */
//   static get count(): Promise<number> {
//     throw new PropertyNotDefinedError('.count');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Attributes} [_attrs] 
//    * @returns {Promise<NextModel[]>} 
//    * @memberof NextModel
//    */
//   static updateAll(_attrs?: Attributes): Promise<NextModel[]> {
//     throw new PropertyNotDefinedError('.updateAll');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @returns {Promise<NextModel[]>} 
//    * @memberof NextModel
//    */
//   static deleteAll(): Promise<NextModel[]> {
//     throw new PropertyNotDefinedError('.deleteAll');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Attributes} [_attrs] 
//    * @returns {NextModel} 
//    * @memberof NextModel
//    */
//   static build(_attrs?: Attributes): NextModel {
//     throw new PropertyNotDefinedError('.build');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Attributes} [_attrs] 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   static create(_attrs?: Attributes): Promise<NextModel> {
//     throw new PropertyNotDefinedError('.create');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Attributes} [_attrs] 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   static firstOrCreate(_attrs?: Attributes): Promise<NextModel> {
//     throw new PropertyNotDefinedError('.firstOrCreate');
//   }

//   /**
//    *
//    * 
//    * @static
//    * @param {Attributes} [_attrs] 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   static firstOrInitialize(_attrs?: Attributes): Promise<NextModel> {
//     throw new PropertyNotDefinedError('.firstOrInitialize');
//   }

//   /**
//    * Creates an instance of NextModel.
//    * @param {Attributes} [_attrs] 
//    * @memberof NextModel
//    */
//   constructor(_attrs?: Attributes) {

//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {Attributes}
//    * @memberof NextModel
//    */
//   get attributes(): Attributes {
//     throw new PropertyNotDefinedError('#attributes');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {Attributes}
//    * @memberof NextModel
//    */
//   get dbAttributes(): Attributes {
//     throw new PropertyNotDefinedError('#attributes');
//   }

//   /**
//    *
//    * 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   save(): Promise<NextModel> {
//     throw new PropertyNotDefinedError('#save');
//   }

//   /**
//    *
//    * 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   delete(): Promise<NextModel> {
//     throw new PropertyNotDefinedError('#delete');
//   }

//   /**
//    *
//    * 
//    * @param {Attributes} _attrs 
//    * @returns {Promise<NextModel>} 
//    * @memberof NextModel
//    */
//   update(_attrs: Attributes): Promise<NextModel> {
//     throw new PropertyNotDefinedError('#update');
//   }

//   /**
//    *
//    * 
//    * @returns {(Promise<NextModel | undefined>)} 
//    * @memberof NextModel
//    */
//   reload(): Promise<NextModel | undefined> {
//     throw new PropertyNotDefinedError('#reload');
//   }

//   /**
//    *
//    * 
//    * @param {Attributes} _attrs 
//    * @returns {NextModel} 
//    * @memberof NextModel
//    */
//   assign(_attrs: Attributes): NextModel {
//     throw new PropertyNotDefinedError('#assign');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {boolean}
//    * @memberof NextModel
//    */
//   get isNew(): boolean {
//     throw new PropertyNotDefinedError('#isNew');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {boolean}
//    * @memberof NextModel
//    */
//   get isPersisted(): boolean {
//     throw new PropertyNotDefinedError('#isPersisted');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {boolean}
//    * @memberof NextModel
//    */
//   get hasChanges(): boolean {
//     throw new PropertyNotDefinedError('#hasChanges');
//   }

//   /**
//    *
//    * 
//    * @param {string} _key 
//    * @returns {NextModel} 
//    * @memberof NextModel
//    */
//   revertChange(_key: string): NextModel {
//     throw new PropertyNotDefinedError('#revertChange');
//   }

//   /**
//    *
//    * 
//    * @returns {NextModel} 
//    * @memberof NextModel
//    */
//   revertChanges(): NextModel {
//     throw new PropertyNotDefinedError('#revertChanges');
//   }

//   /**
//    *
//    *
//    * @readonly
//    * @type {Changes}
//    * @memberof NextModel
//    */
//   get changes(): Changes {
//     throw new PropertyNotDefinedError('#changes');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {boolean}
//    * @memberof NextModel
//    */
//   get hasErrors(): boolean {
//     throw new PropertyNotDefinedError('#hasErrors');
//   }

//   /**
//    *
//    *
//    * @readonly
//    * @type {Errors}
//    * @memberof NextModel
//    */
//   get errors(): Errors {
//     throw new PropertyNotDefinedError('#errors');
//   }

//   /**
//    *
//    * 
//    * @readonly
//    * @type {typeof NextModel}
//    * @memberof NextModel
//    */
//   get model(): typeof NextModel {
//     throw new PropertyNotDefinedError('#model');
//   }

//   /**
//    *
//    * 
//    * @returns {Promise<boolean>} 
//    * @memberof NextModel
//    */
//   isValid(): Promise<boolean> {
//     throw new PropertyNotDefinedError('#isValid');
//   }
// };


// export default NextModel;
