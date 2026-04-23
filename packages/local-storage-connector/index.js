'use strict';

(function() {
  const context = (typeof window === 'object' && window) || {};

  if (typeof require === 'function') {
    context.lodash = require('lodash');
  }

  const lodash = context.lodash || context._;
  const assign = lodash.assign;
  const filter = lodash.filter;
  const findIndex = lodash.findIndex;
  const first = lodash.first;
  const includes = lodash.includes;
  const intersectionBy = lodash.intersectionBy;
  const inRange = lodash.inRange;
  const isFunction = lodash.isFunction;
  const isNil = lodash.isNil;
  const isPlainObject = lodash.isPlainObject;
  const isString = lodash.isString;
  const keys = lodash.keys;
  const last = lodash.last;
  const map = lodash.map;
  const maxBy = lodash.maxBy;
  const omit = lodash.omit;
  const orderBy = lodash.orderBy;
  const remove = lodash.remove;
  const startsWith = lodash.startsWith;
  const union = lodash.unionBy;
  const upperFirst = lodash.upperFirstBy;
  const unionBy = lodash.unionBy;
  const values = lodash.values;

  const NextModelLocalStorageConnector = class NextModelLocalStorageConnector {

    // Static functions

    static get localStorage() {
      return context.localStorage;
    }

    // Functions

    constructor(options) {
      this.cache = {};
      this.prefix = options.prefix || '';
      this.postfix = options.postfix || '';
    }

    storageKey(Klass) {
      return this.prefix + Klass.tableName + this.postfix;
    }

    getNextId(Klass) {
      const key = this.storageKey(Klass) + '__nextId';
      const nextId = this.constructor.localStorage.getItem(key) * 1 || 1;
      this.constructor.localStorage.setItem(key, nextId + 1);
      return nextId;
    }

    getStorage(Klass) {
      const key = this.storageKey(Klass);
      if (!this.cache[key]) {
        const data = this.constructor.localStorage.getItem(key) || '[]';
        this.cache[key] = JSON.parse(data);
      }
      return this.cache[key];
    }

    setStorage(Klass) {
      const key = this.storageKey(Klass);
      const data = JSON.stringify(this.cache[key]);
      this.constructor.localStorage.setItem(key, data);
    }

    all(Klass) {
      const data = this.getStorage(Klass);
      let result = this._filter(Klass, data, Klass.defaultScope);
      const order = Klass.defaultOrder || { [Klass.identifier]: 'asc' };
      if (order) result = orderBy(result, keys(order), values(order));
      result = result.splice(Klass._skip, Klass._limit || Number.MAX_VALUE);
      return Promise.resolve(result);
    }

    first(Klass) {
      return this.all(Klass).then(result => first(result));
    }

    last(Klass) {
      return this.all(Klass).then(result => last(result));
    }

    count(Klass) {
      return this.all(Klass).then(result => ((result && result.length) || 0));
    }

    createTable(Klass) {
      const key = this.storageKey(Klass);
      const data = this.constructor.localStorage.setItem(key, '[]');
      this.cache[key] = [];
      this.cache[key].nextId = 1;
    }

    save(klass) {
      if (klass.isNew) {
        return this._insert(klass);
      } else {
        return this._update(klass);
      }
    }

    delete(klass) {
      if (klass.isNew) {
        return Promise.resolve(null);
      } else {
        const Klass = klass.constructor;
        const cache = this.getStorage(Klass);
        const query = { [Klass.identifier]: klass[Klass.identifier] };
        remove(cache, query);
        this.setStorage(Klass);
        return Promise.resolve(klass);
      }
    }

    // Private functions

    _filter(Klass, dataParam, query) {
      let data = dataParam || [];
      if (isPlainObject(query)) {
        const queryKeys = keys(query);
        const specialKeys = filter(queryKeys, (key) => startsWith(key, '$'));
        const simpleScope = omit(query, specialKeys);
        data = filter(data, simpleScope);
        for (const specialKey of specialKeys) {
          data = this._specialFilter(Klass, specialKey, data, query[specialKey]);
        }
      }
      return data;
    }

    _specialFilter(Klass, specialKey, data, query) {
      const key = '_' + specialKey.substr(1) + 'Query';
      if (isFunction(this[key])) {
        return this[key](Klass, data, query);
      } else {
        throw new Error('Unknown specialKey `' + specialKey+ '`');
      }
    }

    _andQuery(Klass, data, queryArr) {
      const queryResults = queryArr.map((query) => this._filter(Klass, data, query))
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _orQuery(Klass, data, queryArr) {
      const queryResults = queryArr.map((query) => this._filter(Klass, data, query))
      queryResults.push(Klass.identifier);
      return unionBy.apply(this, queryResults);
    }

    _notQuery(Klass, data, query) {
      const blacklistIds = map(this._filter(Klass, data, query), Klass.identifier);
      return this._notInQuery(Klass, data, { [Klass.identifier]: blacklistIds });
    }

    _nullQuery(Klass, data, query) {
      return filter(data, (item) => isNil(item[query]));
    }

    _notNullQuery(Klass, data, query) {
      return filter(data, (item) => !isNil(item[query]));
    }

    _inQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) =>
          includes(query[key], item[key])
        )
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _notInQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) =>
          !includes(query[key], item[key])
        )
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _betweenQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) =>
          inRange(item[key], query[key][0], query[key][1])
        )
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _notBetweenQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) =>
          !inRange(item[key], query[key][0], query[key][1])
        )
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _eqQuery(Klass, data, query) {
      return this._filter(Klass, data, query);
    }

    _ltQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) => item[key] < query[key])
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _lteQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) => item[key] <= query[key])
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _gtQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) => item[key] > query[key])
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _gteQuery(Klass, data, query) {
      const queryResults = keys(query).map((key) =>
        filter(data, (item) => item[key] >= query[key])
      );
      queryResults.push(Klass.identifier);
      return intersectionBy.apply(this, queryResults);
    }

    _filterQuery(Klass, data, query) {
      return filter(data, query);
    }

    _insert(klass) {
      const Klass = klass.constructor;
      const cache = this.getStorage(Klass);
      const data = klass.databaseAttributes;
      data[Klass.identifier] = klass[Klass.identifier] = this.getNextId(Klass);
      cache.push(data);
      this.setStorage(Klass);
      return Promise.resolve(klass);
    }

    _update(klass) {
      const Klass = klass.constructor;
      const cache = this.getStorage(Klass);
      const query = { [Klass.identifier]: klass[Klass.identifier] };
      const index = findIndex(cache, query);
      const data = klass.databaseAttributes;
      data[Klass.identifier] = klass[Klass.identifier];
      cache[index] = data;
      this.setStorage(Klass);
      return Promise.resolve(klass);
    }
  };

  if (typeof module === 'object') {
    module.exports = NextModelLocalStorageConnector;
  } else {
    context.NextModelLocalStorageConnector = NextModelLocalStorageConnector;
  }
}());
