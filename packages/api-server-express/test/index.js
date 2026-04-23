'use strict';

const NextModelApiServerExpress = require('..');
const NextModelApiRouter = require('next-model-api-router');
const NextModel = require('next-model');

const expect = require('expect.js');
const expectChange = require('expect-change');
const sinon = require('sinon');

const express = require('express');

const httpMocks = require('node-mocks-http')
const pluralize = require('pluralize');
const URL = require('url');
const querystring = require('querystring');

const lodash = require('lodash');
const filter = lodash.filter;
const includes = lodash.includes;
const isArray = lodash.isArray;
const keys = lodash.keys;
const map = lodash.map;
const omit = lodash.omit;
const orderBy = lodash.orderBy;
const values = lodash.values;
const words = lodash.words;

const mockConnector = function(data) {
  const all = (model) => {
    let result = filter(data, model.defaultScope);
    const order = model.defaultOrder;
    if (order) result = orderBy(result, keys(order), values(order));
    result = result.splice(model._skip, model._limit || Number.MAX_VALUE);
    return Promise.resolve(result);
  };
  const first = (model) => all(model).then(result => result[0]);
  const last = (model) => all(model).then(result => result[result.length - 1]);
  const count = (model) => all(model).then(result => result.length);
  const deleteFunction = (model) => {
    $items.splice(model.is - 1, 1);
    return Promise.resolve(model);
  }
  const save = (model) => {
    if (model.id) {
      $items[model.id - 1] = model.attributes;
    } else {
      model.id = 4;
      $items.push(model.attributes);
    }
    return Promise.resolve(model);
  };
  return { all, first, last, count, save, delete: deleteFunction };
};

describe('NextModelApiServerExpress', function() {
  this.timeout(10000);

  def('router', () => new NextModelApiRouter({
    domain: $apiDomain,
    path: $apiPath,
    version: $apiVersion,
  }));

  def('apiDomain', undefined);
  def('apiPath', undefined);
  def('apiVersion', undefined);

  def('app', () => express());

  def('server', () => new NextModelApiServerExpress($app, $router));

  def('items', []);

  def('BaseModel', () => class BaseModel extends NextModel {
    static get connector() {
      return mockConnector($items);
    }
  });

  def('User', () => {
    const User = class User extends $BaseModel {
      static get modelName() { return 'User'; }

      static get schema() {
        return {
          id: { type: 'integer' },
          name: { type: 'string' },
          age: { type: 'integer' },
        };
      }

      static get tableName() { return $tableName;}

      static get defaultScope() { return $defaultScope; }
      static get defaultOrder() { return $defaultOrder; }
    };

    User._skip = $skip;
    User._limit = $limit;

    return User;
  });

  def('tableName', 'users');

  def('defaultScope', undefined);
  def('defaultOrder', undefined);

  def('skip', undefined);
  def('limit', undefined);

  beforeEach(function() {
    $router.resource($User.modelName, {
      defaults: $resourceDefaults,
      only: $resourceOnly,
      except: $resourceExcept,
      collection: $resourceCollection,
      member: $resourceMember,
    });
  });

  def('resourceDefaults', undefined);
  def('resourceOnly', undefined);
  def('resourceExcept', undefined);
  def('resourceCollection', undefined);
  def('resourceMember', undefined);

  describe('#controller()', function() {
    def('controller', () => $server.controller($Klass, $actions));
    def('Klass', () => $User);
    def('actions', undefined);

    def('request', () => httpMocks.createRequest({
      method: $method || 'POST',
      url: $url,
      params: $params,
      body: $body,
      query: $query,
    }));

    def('method', undefined);
    def('params', undefined);
    def('body', undefined);
    def('query', undefined);

    def('data', () => ({
      limit: JSON.stringify($limit),
      skip: JSON.stringify($skip),
      order: JSON.stringify($order),
      scope: JSON.stringify($scope),
      attributes: JSON.stringify($attributes),
    }));

    def('limit', undefined);
    def('skip', undefined);
    def('order', undefined);
    def('scope', undefined);
    def('attributes', undefined);

    def('response', () => httpMocks.createResponse());

    def('item1', { id: 1, name: 'foo', age: 18 });
    def('item2', { id: 2, name: 'foo', age: 19 });
    def('item3', { id: 3, name: 'bar', age: 21 });

    def('items', () => [$item1, $item2, $item3]);

    const requestWithData = function(runTests) {
      context('query with data', function() {
        def('query', () => $data);

        runTests();
      });

      context('body with data', function() {
        def('body', () => $data);

        runTests();
      });
    }

    subject(() => (runTests) => {
      return new Promise(function(resolve, reject) {
        $response.end = () => {
          resolve(JSON.parse($response._getData()));
        };
        $controller.handle($request, $response, (err) => reject(err));
      }).then(response => {
        runTests(response);
      });
    });

    describe('default actions', function() {
      context('all', function() {
        def('url', '/users');

        it('returns all users', function() {
          return $subject(response => {
            expect(response).to.eql($items);
          });
        });

        requestWithData(function() {
          context('when limit is present', function() {
            def('limit', 1);

            it('returns limited amount of users', function() {
              return $subject(response => {
                expect(response).to.eql([$item1]);
              });
            });
          });

          context('when skip is present', function() {
            def('skip', 1);

            it('returns users after skipped amount', function() {
              return $subject(response => {
                expect(response).to.eql([$item2, $item3]);
              });
            });
          });

          context('when scope is present', function() {
            def('scope', { name: 'foo' });

            it('returns users filtered by scope', function() {
              return $subject(response => {
                expect(response).to.eql([$item1, $item2]);
              });
            });

            context('when scope contains numbers', function() {
              def('scope', { age: 21 });

              it('returns users filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql([$item3]);
                });
              });
            });

            context('when scope contains multiple attributes', function() {
              def('scope', { name: 'foo', age: 19 });

              it('returns users filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql([$item2]);
                });
              });
            });
          });

          context('when order is present', function() {
            def('order', { age: 'desc' });

            it('returns users after sorting', function() {
              return $subject(response => {
                expect(response).to.eql([$item3, $item2, $item1]);
              });
            });
          });
        });
      });

      context('first', function() {
        def('url', '/users/first');

        it('returns first users', function() {
          return $subject(response => {
            expect(response).to.eql($item1);
          });
        });

        requestWithData(function() {
          context('when skip is present', function() {
            def('skip', 1);

            it('returns user after skipped amount', function() {
              return $subject(response => {
                expect(response).to.eql($item2);
              });
            });
          });

          context('when scope is present', function() {
            def('scope', { name: 'foo' });

            it('returns user filtered by scope', function() {
              return $subject(response => {
                expect(response).to.eql($item1);
              });
            });

            context('when scope contains numbers', function() {
              def('scope', { age: 21 });

              it('returns user filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql($item3);
                });
              });
            });

            context('when scope contains multiple attributes', function() {
              def('scope', { name: 'foo', age: 19 });

              it('returns user filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql($item2);
                });
              });
            });
          });

          context('when order is present', function() {
            def('order', { age: 'desc' });

            it('returns user after sorting', function() {
              return $subject(response => {
                expect(response).to.eql($item3);
              });
            });
          });
        });
      });

      context('last', function() {
        def('url', '/users/last');

        it('returns last users', function() {
          return $subject(response => {
            expect(response).to.eql($item3);
          });
        });

        requestWithData(function() {
          context('when skip is present', function() {
            def('skip', 1);

            it('returns user after skipped amount', function() {
              return $subject(response => {
                expect(response).to.eql($item3);
              });
            });
          });

          context('when scope is present', function() {
            def('scope', { name: 'foo' });

            it('returns user filtered by scope', function() {
              return $subject(response => {
                expect(response).to.eql($item2);
              });
            });

            context('when scope contains numbers', function() {
              def('scope', { age: 21 });

              it('returns user filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql($item3);
                });
              });
            });

            context('when scope contains multiple attributes', function() {
              def('scope', { name: 'foo', age: 19 });

              it('returns user filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql($item2);
                });
              });
            });
          });

          context('when order is present', function() {
            def('order', { age: 'desc' });

            it('returns user after sorting', function() {
              return $subject(response => {
                expect(response).to.eql($item1);
              });
            });
          });
        });
      });

      context('count', function() {
        def('url', '/users/count');

        it('returns users count', function() {
          return $subject(response => {
            expect(response).to.eql(3);
          });
        });

        requestWithData(function() {
          context('when limit is present', function() {
            def('limit', 2);

            it('returns users count after skipped amount', function() {
              return $subject(response => {
                expect(response).to.eql(2);
              });
            });
          });

          context('when skip is present', function() {
            def('skip', 1);

            it('returns users count after skipped amount', function() {
              return $subject(response => {
                expect(response).to.eql(2);
              });
            });
          });

          context('when scope is present', function() {
            def('scope', { name: 'foo' });

            it('returns users count filtered by scope', function() {
              return $subject(response => {
                expect(response).to.eql(2);
              });
            });

            context('when scope contains numbers', function() {
              def('scope', { age: 21 });

              it('returns users count filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql(1);
                });
              });
            });

            context('when scope contains multiple attributes', function() {
              def('scope', { name: 'foo', age: 19 });

              it('returns users count filtered by scope', function() {
                return $subject(response => {
                  expect(response).to.eql(1);
                });
              });
            });
          });

          context('when order is present', function() {
            def('order', { age: 'desc' });

            it('does not change count', function() {
              return $subject(response => {
                expect(response).to.eql(3);
              });
            });
          });
        });
      });

      context('create', function() {
        def('url', () => '/users/create');

        it('creates user', function() {
          return $subject(response => {
            expect($items.length).to.eql(4);
            expect($items[3]).to.eql({
              id: 4,
              name: null,
              age: null,
            });
          });
        });

        requestWithData(function() {
          context('when attrubutes are present', function() {
            def('attributes', () => ({ id: $id, name: $name, age: $age }));
            def('id', undefined);
            def('name', 'test');
            def('age', 1);

            it('creates user with attrubtes', function() {
              return $subject(response => {
                expect($items.length).to.eql(4);
                expect($items[3]).to.eql({
                  id: 4,
                  name: $name,
                  age: $age,
                });
                expect(response).to.eql({
                  id: 4,
                  name: $name,
                  age: $age,
                });
              });
            });

            context('when id is present', function() {
              def('id', 1);

              it('returns error while creating', function() {
                return $subject(response => {
                  expect($items.length).to.eql(3);
                  expect(response).to.eql({
                    err: 'can\'t set identifier column',
                  });
                });
              });
            });
          });
        });
      });

      context('show', function() {
        def('id', () => $item1.id);
        def('url', () => '/user/' + $id);

        it('returns user', function() {
          return $subject(response => {
            expect(response).to.eql($item1);
          });
        });

        context('when id is invalid', function() {
          def('id', 0);

          it('returns error message', function() {
            return $subject(response => {
              expect(response).to.eql({ err: 'Item not found' });
            });
          });
        });
      });

      context('update', function() {
        def('id', () => $item1.id);
        def('url', () => '/user/' + $id + '/update');

        it('returns user', function() {
          return $subject(response => {
            expect(response).to.eql($item1);
          });
        });

        context('when id is invalid', function() {
          def('id', 0);

          it('returns error message', function() {
            return $subject(response => {
              expect(response).to.eql({ err: 'Item not found' });
            });
          });
        });

        requestWithData(function() {
          context('when attribute is present', function() {
            def('attributes', () => ({ name: $name, age: $age }));
            def('name', 'test');
            def('age', undefined);

            it('returns user with updated data', function() {
              return $subject(response => {
                expect(response).to.eql({ id: $id, name: $name, age: $item1.age });
                expect($items[0]).to.eql({ id: $id, name: $name, age: $item1.age });
              });
            });

            context('when multiple attributes are present', function() {
              def('age', 1);

              it('returns user with updated data', function() {
                return $subject(response => {
                  expect(response).to.eql({ id: $id, name: $name, age: $age });
                  expect($items[0]).to.eql({ id: $id, name: $name, age: $age });
                });
              });
            });
          });
        });
      });

      context('delete', function() {
        def('id', () => $item1.id);
        def('url', () => '/user/' + $id + '/delete');

        it('deletes user', function() {
          return $subject(response => {
            expect($items.length).to.eql(2);
            expect(response).to.eql({
              name: $item1.name,
              age: $item1.age,
            });
          });
        });

        context('when id is invalid', function() {
          def('id', 0);

          it('returns error message', function() {
            return $subject(response => {
              expect(response).to.eql({ err: 'Item not found' });
            });
          });
        });
      });
    });
  });
});
