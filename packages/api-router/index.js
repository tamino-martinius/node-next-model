'use strict';

(function() {
  const isClient = typeof window === 'object';
  const isServer = !isClient;

  const context = isClient ? window : {};

  if (isServer) {
    context.lodash = require('lodash');
    context.pluralize = require('pluralize');
  }

  const pluralize = context.pluralize;
  const lodash = context.lodash || context._;

  const capitalize = lodash.capitalize;
  const compact = lodash.compact;
  const defaults = lodash.defaults;
  const defaultsDeep = lodash.defaultsDeep;
  const keys = lodash.keys;
  const mapValues = lodash.mapValues;
  const omit = lodash.omit;
  const pick = lodash.pick;
  const isArray = lodash.isArray;
  const snakeCase = lodash.snakeCase;
  const toLower = lodash.toLower;
  const trim = lodash.trim;
  const trimEnd = lodash.trimEnd;
  const zipObject = lodash.zipObject;

  const NextModelApiRouter = class NextModelApiRouter {
    static get isClient() {
      return isClient;
    }

    static get defaultActions() {
      return mapValues({
        all:    { type: 'collection', path: '' },
        first:  { type: 'collection', path: 'first' },
        last:   { type: 'collection', path: 'last' },
        count:  { type: 'collection', path: 'count' },
        create: { type: 'collection', path: 'create' },
        show:   { type: 'member',     path: '' },
        update: { type: 'member',     path: 'update' },
        delete: { type: 'member',     path: 'delete' },
      }, (value) => {
        value.isDefaultAction = true;
        return value;
      });
    }

    static get resourceDefaults() {
      return {
        collectionTransform: 'pluralize',
        memberTransform: 'singularize',
        method: 'post',
        postfix: '',
      };
    }

    constructor(options) {
      this.routes = [];
      this.domain = trimEnd(options.domain, '/');
      this.path = trim(options.path, '/');
      this.version = trim(options.version, '/');
    }

    get root() {
      if (!this._root) {
        const domain = this.constructor.isClient ? this.domain : '';
        this._root = domain + '/' + compact([this.path, this.version]).join('/')
      }
      return this._root;
    }

    resource(modelName, optionsParam) {
      const options = optionsParam || {};
      const actionDefaults = defaults(
        { modelName },
        options.defaults,
        this.constructor.resourceDefaults
      );
      let actions = this.constructor.defaultActions;
      actions = this._addResourceDefaults(actions, options);
      actions = this._addResourceCollection(actions, options);
      actions = this._addResourceMember(actions, options);
      for (const action in actions) {
        this._addRoute(defaults(actions[action], actionDefaults, { action }));
      }
    }

    _addResourceDefaults(actionsParam, options) {
      let actions = actionsParam || {};
      if (options.only) {
        if (isArray(options.only)) {
          actions = pick(actions, options.only)
        } else {
          actions = pick(actions, keys(options.only));
          actions = defaultsDeep(options.only, actions);
        }
      }
      if (options.except) {
        actions = omit(actions, options.except);
      }
      return actions;
    }

    _addResourceCollection(actionsParam, options) {
      let actions = actionsParam || {};
      if (options.collection) {
        let collectionActions = options.collection;
        if (isArray(options.collection)) {
          collectionActions = zipObject(options.collection);
        }
        for (const path in collectionActions) {
          const actionDefaults = { path, type: 'collection' };
          collectionActions[path] = defaults(collectionActions[path], actionDefaults);
        }
        actions = defaultsDeep(actions, collectionActions);
      }
      return actions;
    }

    _addResourceMember(actionsParam, options) {
      let actions = actionsParam || {};
      if (options.member) {
        let memberActions = options.member;
        if (isArray(options.member)) {
          memberActions = zipObject(options.member);
        }
        for (const path in memberActions) {
          const actionDefaults = { path, type: 'member' };
          memberActions[path] = defaults(memberActions[path], actionDefaults);
        }
        actions = defaultsDeep(actions, memberActions);
      }
      return actions;
    }

    _addRoute(options) {
      this._setRouteName(options);
      options.url = '/' + options.name;
      if (options.type === 'member') {
        options.identifier = pluralize(options.name, 1) + '_id';
        options.url += '/:' + options.identifier;
      }
      options.path = trim(options.path, '/');
      if (options.path) {
        options.url += '/' + options.path;
      }
      options.url += options.postfix || '';
      this.routes.push(options);
    }

    _setRouteName(options) {
      if (!options.name) {
        options.name = options.modelName;
      }
      options.name = snakeCase(options.name);
      const transform = options.transform || options[options.type + 'Transform'];
      if (transform === 'pluralize') {
        options.name = pluralize(options.name);
      }
      if (transform === 'singularize') {
        options.name = pluralize(options.name, 1);
      }
    }
  }

  if (isServer) {
    module.exports = NextModelApiRouter;
  } else {
    context.NextModelApiRouter = NextModelApiRouter;
  }
}());
