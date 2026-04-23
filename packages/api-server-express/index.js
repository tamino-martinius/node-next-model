'use strict';

const lodash = require('lodash');
const express = require('express');
const pluralize = require('pluralize');

const assign = lodash.assign;
const defaults = lodash.defaults;
const filter = lodash.filter;
const isArray = lodash.isArray;
const isNumber = lodash.isNumber;
const map = lodash.map;
const omit = lodash.omit;

module.exports = class NextModelApiServerExpress {
  static responseHeaders(req, res, next) {
    const headers = {
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Amz-Date, X-Api-Key',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PATCH,PUT,DELETE',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': req.get('Origin'),
    };
    if (req.method === 'OPTIONS') {
      const maxAge = 2592000;
      headers['Cache-Control'] = 'public, max-age=' + maxAge;
      headers['Expires'] = new Date(Date.now() + maxAge * 1000).toUTCString();
      res.set(headers);
      res.sendStatus(200);
    } else {
      res.set(headers);
      return next();
    }
  }

  static respond(res, promise) {
    promise
      .then(data => this.handleData(res, data))
      .catch(err => this.handleError(res, err))
    ;
  }

  static handleData(res, data) {
    let content = data;
    if (isArray(data)) {
      content = map(data, 'attributes');
    } else if (data && data.attributes) {
      content = data.attributes;
    }
    if (isNumber(data)) {
      content = data.toString();
    }
    res.json(content);
  }

  static handleError(res, err) {
    res.json({ err: err.message });
  }

  static payload(req) {
    return assign({}, req.params, req.body, req.query);
  }

  static scopedKlass(Klass, route, req) {
    const data = this.payload(req);
    const ScopedKlass =  class ScopedKlass extends Klass {
      static get defaultScope() {
        if (data && data.scope) {
          return JSON.parse(data.scope);
        }
      }

      static get defaultOrder() {
        if (data && data.order) {
          return JSON.parse(data.order);
        }
      }
    };

    if (data) {
      if (data.skip) ScopedKlass._skip = JSON.parse(data.skip);
      if (data.limit) ScopedKlass._limit = JSON.parse(data.limit);
    }

    return ScopedKlass;
  }

  static klassPromise(Klass, route, req) {
    const data = this.payload(req);
    const attributes = JSON.parse(data.attributes || '{}');
    if (data[route.identifier]) {
      const query = { [Klass.identifier]: JSON.parse(data[route.identifier]) };
      return Klass.model.where(query).first
       .then(klass => {
         if (klass) {
           return klass.assign(omit(attributes, Klass.identifier));
         }
         throw new Error('Item not found');
       });
    } else {
      return Klass.model.promiseBuild(attributes);
    }
  }

  constructor(app, router) {
    this.app = app;
    this.root = router.root;
    this.routes = router.routes;
    app.use(this.root, this.constructor.responseHeaders);
  }


  controller(Klass, actionsParam) {
    const router = express.Router();
    const actions = defaults(actionsParam, this._defaultActions(Klass));
    for (const route of this._routesForClass(Klass)) {
      const action = actions[route.action];
      if (action) {
        const handler = (req, res) => {
          const scopedKlass = this.constructor.scopedKlass(Klass, route, req);
          let klassPromise;
          if (route.type === 'member' || route.action === 'create') {
            klassPromise = this.constructor.klassPromise(Klass, route, req);
          }
          return action(scopedKlass, klassPromise, req, res);
        };
        router.route(route.url)[route.method](handler);
      } else {
        console.log(`can't find action '${action}' for model '${Klass.modelName}'`);
      }
    }
    this.app.use(this.root, router);
    return router;
  }

  _defaultActions(Klass) {
    return {
      all: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, scopedKlass.all);
      },
      first: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, scopedKlass.first);
      },
      last: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, scopedKlass.last);
      },
      count: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, scopedKlass.count);
      },
      create: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, klassPromise.then(klass => klass.save()));
      },
      show: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, klassPromise);
      },
      update: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, klassPromise.then(klass => klass.save()));
      },
      delete: (scopedKlass, klassPromise, req, res) => {
        this.constructor.respond(res, klassPromise.then(klass => klass.delete()));
      },
    };
  }

  _routesForClass(Klass) {
    return filter(this.routes, (route) => (
      route.modelName === Klass.modelName
    ));
  }
};
