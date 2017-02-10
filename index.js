'use strict';

const {
  camelize,
  pluralize,
} = require('inflection');

const {
  assign,
  difference,
  filter,
  first,
  includes,
  isArray,
  isNil,
  isNumber,
  isObject,
  keys,
  last,
  map,
  mapValues,
  omit,
  pick,
  union,
  values,
  without,
} = require('lodash');


module.exports = class NextModel {
  // Static properties
  // - must be inherited
  static get modelName() {
    throw new Error(`static getter 'modelName' needs to be present`);
  }

  static get schema() {
    throw new Error(`static getter 'schema' needs to be present`);
  }

  static get connector() {
    throw new Error(`static getter 'connector' needs to be present for queries`);
  }

  // - optional
  static get identifier() {
    return 'id';
  }

  static get tableName() {
    let tableName = camelize(pluralize(this.modelName), true)
    try {
      tableName = this.connector.tableName(this.modelName);
    } finally {
      return tableName;
    }
  }

  static get attrAccessors() {
    return [];
  }

  static get belongsTo() {
    return {};
  }

  static get hasMany() {
    return {};
  }

  static get hasOne() {
    return {};
  }

  static get cacheData() {
    return true;
  }

  static get defaultScope() {
    return undefined;
  }

  static get defaultOrder() {
    return undefined;
  }

  // - computed
  static get keys() {
    return this.__keys || (this.__keys = union(this.attrAccessors, keys(this.fetchSchema())));
  }

  static get databaseKeys() {
    return without(keys(this.fetchSchema()), this.identifier);
  }

  static get all() {
    let promise;
    if (this.hasCache('all')) {
      promise = Promise.resolve(this.getCache('all'));
    } else {
      promise = this.connector.all(this)
      if (this.cacheData)
        promise = promise.then(data => this.setCache('all', data));
    }
    return promise.then(result => map(result, (attr) => new this(attr)));
  }

  static get first() {
    let promise;
    if (this.hasCache('first')) {
      promise = Promise.resolve(this.getCache('first'));
    } else {
      promise = this.connector.first(this)
      if (this.cacheData)
        promise = promise.then(data => this.setCache('first', data));
    }
    return promise.then(attributes => (attributes && new this(attributes)));
  }

  static get last() {
    let promise;
    if (this.hasCache('last')) {
      promise = Promise.resolve(this.getCache('last'));
    } else {
      promise = this.connector.last(this)
      if (this.cacheData)
        promise = promise.then(data => this.setCache('last', data));
    }
    return promise.then(attributes => (attributes && new this(attributes)));
  }

  static get count() {
    let scope = this
    if (this._skip) scope = this.unskip()
    if (this._limit) scope = this.unlimit();
    if (this.hasCache('count')) {
      return Promise.resolve(this.getCache('count'));
    } else {
      let promise = this.connector.count(this)
      if (this.cacheData)
        promise = promise.then(data => this.setCache('count', data));
      return promise;
    }
  }

  static get model() {
    return this.withScope(undefined).order(undefined);
  }

  static get withoutScope() {
    return this.withScope(undefined);
  }

  static get unorder() {
    return this.order(undefined);
  }

  static get reload() {
    const klass = class extends this {};
    klass.cache = undefined;
    return klass;
  }

  // Static functions

  static hasCache(queryType) {
    return !!(this.cacheData && this.cache && !isNil(this.cache[queryType]));
  }

  static getCache(queryType) {
    return this.cache && this.cache[queryType];
  }

  static setCache(queryType, value) {
    this.cache = this.cache || {};
    this.cache[queryType] = value;
    return value;
  }

  static build(attrs) {
    if (attrs && !isNil(attrs[this.identifier])) {
      throw new Error(`can't set identifier column`);
    }
    return new this(attrs);
  }

  static create(attrs) {
    return this.build(attrs).save();
  }

  static limit(amount) {
    if (!isNumber(amount)) throw new Error(`'limit' needs to be a number`);
    if (amount < 0) throw new Error(`'limit' needs to be at least 0`);
    const klass = this.reload;
    klass._limit = amount;
    return klass;
  }

  static unlimit() {
    const klass = this.reload;
    klass._limit = undefined;
    return klass;
  }

  static skip(amount) {
    if (!isNumber(amount)) throw new Error(`'skip' needs to be a number`);
    if (amount < 0) throw new Error(`'skip' needs to be at least 0`);
    const klass = this.reload;
    klass._skip = amount;
    return klass;
  }

  static unskip() {
    const klass = this.reload;
    klass._skip = undefined;
    return klass;
  }

  static withScope(scope) {
    const klass = class extends this.reload {
      static get defaultScope() {
        return scope;
      }
    };

    return klass;
  }

  static order(order) {
    const wrongKeys = difference(keys(order), keys(this.fetchSchema()));
    if (wrongKeys.length > 0) {
      throw new Error(`can't order by '${wrongKeys.join(`', '`)}', keys are missing in schema`);
    }
    const wrongValues = difference(values(order), ['asc', 'desc']);
    if (wrongValues.length > 0) {
      throw new Error(
        `can't order by directions '${wrongValues.join(`', '`)}', only 'asc' and 'desc' are allowed`
      );
    }

    const klass = class extends this.reload {
      static get defaultOrder() {
        return order;
      }
    };

    return klass;
  }

  static scope({where}) {
    const scope = this._mergeScopes(this.defaultScope, where);
    return this.withScope(scope);
  }

  static unscope(args) {
    const defScope = omit(this.defaultScope, args);
    return this.withScope(defScope);
  }

  static where(where) {
    return this.scope({ where });
  }

  static orWhere(where) {
    const scope = this._mergeScopes(this.defaultScope, where, false);
    return this.withScope(scope);
  }

  static createTable() {
    return this.connector.createTable(this);
  }

  static fetchSchema() {
    if (!this._schema) this._schema = this._addDefaultsToSchema();
    return this._schema;
  }

  static fetchBelongsTo() {
    if (!this._belongsTo) this._belongsTo = this._addDefaultsToBelongsTo();
    return this._belongsTo;
  }

  static fetchHasMany() {
    if (!this._hasMany) this._hasMany = this._addDefaultsToHasMany();
    return this._hasMany;
  }

  static fetchHasOne() {
    if (!this._hasOne) this._hasOne = this._addDefaultsToHasOne();
    return this._hasOne;
  }

  // Static private properties

  static get _defaultAttributes() {
    const schemaDefaults = mapValues(this.fetchSchema(), (value) => value.defaultValue);
    return pick(assign({}, schemaDefaults, this.defaultScope), this.keys);
  }

  static _mergeScopes(attrs1, attrs2, asAnd = true) {
    const query = asAnd ? '$and' : '$or';
    if (!isNil(attrs1) && !isNil(attrs2)) {
      return { [query]: [attrs1, attrs2] };
    } else {
      return attrs1 || attrs2;
    }
  }

  static _addDefaultsToBelongsTo() {
    let relations = this.belongsTo || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.model) throw new Error(
        `model property is missing for relation of 'belongsTo' relation`
      );
      relation.foreignKey = relation.foreignKey || camelize(relation.model.modelName + 'Id', true);
    }
    return relations;
  }

  static _addDefaultsToHasMany() {
    let relations = this.hasMany || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.model) throw new Error(
        `model property is missing for '${name}' from 'hasMany' relation`
      );
      relation.foreignKey = relation.foreignKey || camelize(this.modelName + 'Id', true);
    }
    return relations;
  }

  static _addDefaultsToHasOne() {
    let relations = this.hasOne || {};
    for (const name in relations) {
      const relation = relations[name];
      if (!relation.model) throw new Error(
        `model property is missing for '${name}' from 'hasOne' relation`
      );
      relation.foreignKey = relation.foreignKey || camelize(this.modelName + 'Id', true);
    }
    return relations;
  }

  static _addDefaultsToSchema() {
    let schema = this.schema || {};
    const relations = this.fetchBelongsTo();
    for (const name in relations) {
      const relation = relations[name];
      schema[relation.foreignKey] = {
        type: relation.model.schema[relation.model.identifier].type,
        defaultValue: relation.model.schema[relation.model.identifier].defaultValue,
      };
    }
    for (const key in schema) {
      schema[key].type = schema[key].type || 'string';
      if (schema[key].defaultValue === undefined) schema[key].defaultValue = null;
    }
    return schema;
  }

  // Constructor
  constructor(attrs = {}) {
    this.assign(this.constructor._defaultAttributes);
    this.assign(attrs);
    this._initBelongsToRelations(attrs);
    this._initHasManyRelations(attrs);
    this._initHasOneRelations(attrs);
  }

  // Properties
  get attributes() {
    return pick(this, this.constructor.keys);
  }

  get databaseAttributes() {
    return pick(this, this.constructor.databaseKeys);
  }

  get isNew() {
    return isNil(this[this.constructor.identifier]);
  }

  get isPersisted() {
    return !this.isNew;
  }

  // Functions
  assignAttribute(key, value) {
    const keys = this.constructor.keys;
    if (includes(keys, key)) {
      this[key] = value;
    } else {
      throw new Error(
        `Key '${key}' is not in schema or attrAccessors,
        please choose one of: ${keys.join(', ')}`
      );
    }
    return this;
  }

  assign(attrs) {
    for (const key in attrs) {
      this.assignAttribute(key, attrs[key]);
    }
    return this;
  }

  save(options) {
    return this.constructor.connector.save(this).then(result => this);
  }

  delete(options) {
    if (this.isNew) {
      return Promise.resolve(this);
    } else {
      return this.constructor.connector.delete(this).then(result => {
        delete this[this.constructor.identifier];
        return this;
      });
    }
  }

  reload() {
    if (this.isNew) {
      return Promise.resolve(this);
    } else {
      const identifier = this.constructor.identifier;
      return this.constructor.model
      .where({ [identifier]: this[identifier] }).first
      .then(klass => {
        if (!isNil(klass)) {
          return this.assign(klass.databaseAttributes);
        } else {
          this.id = undefined;
          return this;
        }
      });
    }
  }

  // Private functions
  _belongsToScope(id) {
    return {where: {id}};
  }

  _hasManyScope() {
    return {
      where: {
        [camelize(this.constructor.modelName, true) + 'Id']: this.id,
      },
    };
  }

  _initBelongsToRelations(attrs) {
    const relations = this.constructor.fetchBelongsTo();
    if (!isArray(relations)) return;
    for (const relation of relations) {
      Object.defineProperty(this, name, {
        get: () => {
          const id = this[relation.foreignKey];
          if (!isNil(id)) {
            if (!isNil(attrs[name])) return attrs[name];
            return relation.model.scope(this._belongsToScope(id)).first;
          } else {
            return null;
          }
        },
        set: (obj) => {
          this[foreignKey] = obj.id;
        },
        configurable: true,
      });
    }
  }

  _initHasManyRelations(attrs) {
    const relations = this.constructor.fetchHasMany();
    if (isObject(relations)) {
      for (let name in relations) {
        const relation = relations[name];
        Object.defineProperty(this, name, {
          get: () => {
            if (!isNil(attrs[name])) return attrs[name];
            return relation.model.scope(this._hasManyScope());
          },
          writeable: false,
          configurable: true,
        });
      }
    }
  }

  _initHasOneRelations() {
    const relations = this.constructor.fetchHasOne();
    if (isObject(relations)) {
      for (let name in relations) {
        const relation = relations[name];
        Object.defineProperty(this, name, {
          get: () => {
            return relation.model.scope(this._hasManyScope()).first;
          },
          writeable: false,
          configurable: true,
        });
      }
    }
  }
}
