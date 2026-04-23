'use strict';

const NextModelApiRouter = require('..');
const expect = require('expect.js');
const pluralize = require('pluralize');

const lodash = require('lodash');
const pick = lodash.pick;

describe('NextModelApiRouter', function() {
  this.timeout(10000);

  def('Router', () => class Router extends NextModelApiRouter{
    static get isClient() {
      return $isClient;
    }

    static get resourceDefaults() {
      return $resourceDefaults || super.resourceDefaults;
    }
  });

  def('router', () => new $Router({
    domain: $domain,
    path: $path,
    version: $version,
  }));

  def('modelName', () => 'Klass');
  def('name', () => undefined);
  def('isClient', () => false);
  def('resourceDefaults', () => undefined);
  def('domain', () => undefined);
  def('path', () => undefined);
  def('version', () => undefined);

  describe('#root', function() {
    subject(() => $router.root);

    it('returns route', function() {
      expect($subject).to.be('/');
    });

    context('when domain is present', function() {
      def('domain', () => 'http://example.com');

      it('ignores domain', function() {
        expect($subject).to.be('/');
      });

      context('when is on client', function() {
        def('isClient', () => true);

        it('adds domain to root', function() {
          expect($subject).to.be('http://example.com/');
        });

        context('when domain ends with /', function() {
          def('domain', () => 'http://example.com/');

          it('adds domain to root', function() {
            expect($subject).to.be('http://example.com/');
          });
        });
      });
    });

    context('when path is present', function() {
      def('path', () => 'api');

      it('adds path to route', function() {
        expect($subject).to.be('/api');
      });

      context('when path ends with /', function() {
        def('path', () => 'api/');

        it('adds path to route', function() {
          expect($subject).to.be('/api');
        });
      });

      context('when path starts with /', function() {
        def('path', () => '/api');

        it('adds path to route', function() {
          expect($subject).to.be('/api');
        });
      });

      context('when path is /', function() {
        def('path', () => '/');

        it('does not add path to route', function() {
          expect($subject).to.be('/');
        });
      });
    });

    context('when version is present', function() {
      def('version', () => 'v1');

      it('adds version to route', function() {
        expect($subject).to.be('/v1');
      });

      context('when version ends with /', function() {
        def('version', () => 'v1/');

        it('adds version to route', function() {
          expect($subject).to.be('/v1');
        });
      });

      context('when version starts with /', function() {
        def('version', () => '/v1');

        it('adds version to route', function() {
          expect($subject).to.be('/v1');
        });
      });

      context('when version is /', function() {
        def('version', () => '/');

        it('does not add version to route', function() {
          expect($subject).to.be('/');
        });
      });
    });

    context('when path and version is present', function() {
      def('path', () => 'api');
      def('version', () => 'v1');

      it('adds path and version to route', function() {
        expect($subject).to.be('/api/v1');
      });
    });
  });

  describe('#resource()', function() {
    beforeEach(function() {
      $router.resource($modelName, {
        defaults: $defaults,
        only: $only,
        except: $except,
        collection: $collection,
        member: $member,
      });
    });
    subject(() => $router.routes.map(
      item => pick(item, ['method', 'url'])
    ));

    def('defaults', () => undefined);
    def('only', () => undefined);
    def('except', () => undefined);
    def('collection', () => undefined);
    def('member', () => undefined);

    it('returns all default routes', function() {
      expect($subject).to.eql([
        { method: 'post', url: '/klasses' },
        { method: 'post', url: '/klasses/first' },
        { method: 'post', url: '/klasses/last' },
        { method: 'post', url: '/klasses/count' },
        { method: 'post', url: '/klasses/create' },
        { method: 'post', url: '/klass/:klass_id' },
        { method: 'post', url: '/klass/:klass_id/update' },
        { method: 'post', url: '/klass/:klass_id/delete' },
      ]);
    });

    describe('defaults', function() {
      context('when defaults.collectionTransform is `singularize`', function() {
        def('defaults', () => ({
          collectionTransform: 'singularize',
        }));

        it('returns all default routes with singular table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klass' },
            { method: 'post', url: '/klass/first' },
            { method: 'post', url: '/klass/last' },
            { method: 'post', url: '/klass/count' },
            { method: 'post', url: '/klass/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
            { method: 'post', url: '/klass/:klass_id/delete' },
          ]);
        });
      });

      context('when defaults.collectionTransform is `pluralize`', function() {
        def('defaults', () => ({
          collectionTransform: 'pluralize',
        }));

        it('returns all default routes with pluralize table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klasses/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
            { method: 'post', url: '/klass/:klass_id/delete' },
          ]);
        });
      });

      context('when defaults.collectionTransform is `none`', function() {
        def('defaults', () => ({
          collectionTransform: 'none',
        }));

        it('returns all default routes with unchanges table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klass' },
            { method: 'post', url: '/klass/first' },
            { method: 'post', url: '/klass/last' },
            { method: 'post', url: '/klass/count' },
            { method: 'post', url: '/klass/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
            { method: 'post', url: '/klass/:klass_id/delete' },
          ]);
        });

        context('when name is plural', function() {
          def('defaults', () => ({
            collectionTransform: 'none',
            name: 'klasses',
          }));

          it('returns all default routes with unchanges table names', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
              { method: 'post', url: '/klasses/first' },
              { method: 'post', url: '/klasses/last' },
              { method: 'post', url: '/klasses/count' },
              { method: 'post', url: '/klasses/create' },
              { method: 'post', url: '/klass/:klass_id' },
              { method: 'post', url: '/klass/:klass_id/update' },
              { method: 'post', url: '/klass/:klass_id/delete' },
            ]);
          });
        });
      });

      context('when defaults.memberTransform is `singularize`', function() {
        def('defaults', () => ({
          memberTransform: 'singularize',
        }));

        it('returns all default routes with singular table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klasses/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
            { method: 'post', url: '/klass/:klass_id/delete' },
          ]);
        });
      });

      context('when defaults.memberTransform is `pluralize`', function() {
        def('defaults', () => ({
          memberTransform: 'pluralize',
        }));

        it('returns all default routes with pluralize table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klasses/create' },
            { method: 'post', url: '/klasses/:klass_id' },
            { method: 'post', url: '/klasses/:klass_id/update' },
            { method: 'post', url: '/klasses/:klass_id/delete' },
          ]);
        });
      });

      context('when defaults.memberTransform is `none`', function() {
        def('defaults', () => ({
          memberTransform: 'none',
        }));

        it('returns all default routes with unchanges table names', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klasses/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
            { method: 'post', url: '/klass/:klass_id/delete' },
          ]);
        });
        context('when name is plural', function() {
          def('defaults', () => ({
            memberTransform: 'none',
            name: 'klasses',
          }));

          it('returns all default routes with unchanges table names', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
              { method: 'post', url: '/klasses/first' },
              { method: 'post', url: '/klasses/last' },
              { method: 'post', url: '/klasses/count' },
              { method: 'post', url: '/klasses/create' },
              { method: 'post', url: '/klasses/:klass_id' },
              { method: 'post', url: '/klasses/:klass_id/update' },
              { method: 'post', url: '/klasses/:klass_id/delete' },
            ]);
          });
        });
      });

      context('when defaults.method is present', function() {
        def('defaults', () => ({
          method: 'get',
        }));

        it('returns all routes with default method', function() {
          expect($subject).to.eql([
            { method: 'get', url: '/klasses' },
            { method: 'get', url: '/klasses/first' },
            { method: 'get', url: '/klasses/last' },
            { method: 'get', url: '/klasses/count' },
            { method: 'get', url: '/klasses/create' },
            { method: 'get', url: '/klass/:klass_id' },
            { method: 'get', url: '/klass/:klass_id/update' },
            { method: 'get', url: '/klass/:klass_id/delete' },
          ]);
        });
      });

      context('when defaults.postfix is present', function() {
        def('defaults', () => ({
          postfix: '.json',
        }));

        it('returns all routes with default postfix', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses.json' },
            { method: 'post', url: '/klasses/first.json' },
            { method: 'post', url: '/klasses/last.json' },
            { method: 'post', url: '/klasses/count.json' },
            { method: 'post', url: '/klasses/create.json' },
            { method: 'post', url: '/klass/:klass_id.json' },
            { method: 'post', url: '/klass/:klass_id/update.json' },
            { method: 'post', url: '/klass/:klass_id/delete.json' },
          ]);
        });
      });
    });

    describe('only', function() {
      context('when only is an array', function() {
        def('only', () => []);

        it('returns only default actions from array', function() {
          expect($subject).to.eql([]);
        });

        context('key in array', function() {
          def('only', () => ['all']);

          it('returns only default actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
            ]);
          });
        });

        context('when multiple keys array', function() {
          def('only', () => ['all', 'show']);

          it('returns only default actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
              { method: 'post', url: '/klass/:klass_id' },
            ]);
          });
        });
      });

      context('when only is an object', function() {
        def('only', () => ({}));

        it('returns only default actions from object', function() {
          expect($subject).to.eql([]);
        });

        context('key in object', function() {
          def('only', () => ({ all: $actionOptions }));
          def('actionOptions', () => ({}));

          it('returns only default actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
            ]);
          });

          context('when options.path is present', function() {
            def('actionOptions', () => ({ path: 'foo' }));

            it('returns action with path', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klasses/foo' },
              ]);
            });

            context('when options.path ends with /', function() {
              def('actionOptions', () => ({ path: 'foo/' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klasses/foo' },
                ]);
              });
            });

            context('when options.path starts with /', function() {
              def('actionOptions', () => ({ path: '/foo' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klasses/foo' },
                ]);
              });
            });
          });

          context('when options.method is present', function() {
            def('actionOptions', () => ({ method: 'get' }));

            it('returns action with method', function() {
              expect($subject).to.eql([
                { method: 'get', url: '/klasses' },
              ]);
            });
          });

          context('when options.transform is present', function() {
            def('actionOptions', () => ({ transform: 'singularize' }));

            it('returns action with name transform', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klass' },
              ]);
            });
          });

          context('when options.postfix is present', function() {
            def('actionOptions', () => ({ postfix: '.json' }));

            it('returns action with postfix', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klasses.json' },
              ]);
            });
          });
        });

        context('when multiple keys object', function() {
          def('only', () => ({ all: {}, show: {}}));

          it('returns only default actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses' },
              { method: 'post', url: '/klass/:klass_id' },
            ]);
          });
        });
      });
    });

    describe('except', function() {
      def('except', () => []);

      it('returns all default routes', function() {
        expect($subject).to.eql([
          { method: 'post', url: '/klasses' },
          { method: 'post', url: '/klasses/first' },
          { method: 'post', url: '/klasses/last' },
          { method: 'post', url: '/klasses/count' },
          { method: 'post', url: '/klasses/create' },
          { method: 'post', url: '/klass/:klass_id' },
          { method: 'post', url: '/klass/:klass_id/update' },
          { method: 'post', url: '/klass/:klass_id/delete' },
        ]);
      });

      context('key in array', function() {
        def('except', () => ['delete']);

        it('returns all default actions except passed keys', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klasses/create' },
            { method: 'post', url: '/klass/:klass_id' },
            { method: 'post', url: '/klass/:klass_id/update' },
          ]);
        });
      });

      context('when multiple keys array', function() {
        def('except', () => ['delete', 'create', 'update']);

        it('returns all default actions except passed keys', function() {
          expect($subject).to.eql([
            { method: 'post', url: '/klasses' },
            { method: 'post', url: '/klasses/first' },
            { method: 'post', url: '/klasses/last' },
            { method: 'post', url: '/klasses/count' },
            { method: 'post', url: '/klass/:klass_id' },
          ]);
        });
      });
    });

    describe('collection', function() {
      def('only', () => []);

      context('when collection is an array', function() {
        def('collection', () => []);

        it('creates collection actions from array', function() {
          expect($subject).to.eql([]);
        });

        context('key in array', function() {
          def('collection', () => ['foo']);

          it('creates collection actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses/foo' },
            ]);
          });
        });

        context('when multiple keys array', function() {
          def('collection', () => ['foo', 'bar']);

          it('creates collection actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses/foo' },
              { method: 'post', url: '/klasses/bar' },
            ]);
          });
        });
      });

      context('when collection is an object', function() {
        def('collection', () => ({}));

        it('creates collection actions from object', function() {
          expect($subject).to.eql([]);
        });

        context('key in object', function() {
          def('collection', () => ({ foo: $actionOptions }));
          def('actionOptions', () => ({}));

          it('creates collection actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses/foo' },
            ]);
          });

          context('when options.path is present', function() {
            def('actionOptions', () => ({ path: 'bar' }));

            it('returns action with path', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klasses/bar' },
              ]);
            });

            context('when options.path ends with /', function() {
              def('actionOptions', () => ({ path: 'bar/' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klasses/bar' },
                ]);
              });
            });

            context('when options.path starts with /', function() {
              def('actionOptions', () => ({ path: '/bar' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klasses/bar' },
                ]);
              });
            });
          });

          context('when options.method is present', function() {
            def('actionOptions', () => ({ method: 'get' }));

            it('returns action with method', function() {
              expect($subject).to.eql([
                { method: 'get', url: '/klasses/foo' },
              ]);
            });
          });

          context('when options.transform is present', function() {
            def('actionOptions', () => ({ transform: 'singularize' }));

            it('returns action with name transform', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klass/foo' },
              ]);
            });
          });

          context('when options.postfix is present', function() {
            def('actionOptions', () => ({ postfix: '.json' }));

            it('returns action with postfix', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klasses/foo.json' },
              ]);
            });
          });
        });

        context('when multiple keys object', function() {
          def('collection', () => ({ foo: {}, bar: {}}));

          it('returns collection default actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klasses/foo' },
              { method: 'post', url: '/klasses/bar' },
            ]);
          });
        });
      });
    });

    describe('member', function() {
      def('only', () => []);

      context('when member is an array', function() {
        def('member', () => []);

        it('creates member actions from array', function() {
          expect($subject).to.eql([]);
        });

        context('key in array', function() {
          def('member', () => ['foo']);

          it('creates member actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klass/:klass_id/foo' },
            ]);
          });
        });

        context('when multiple keys array', function() {
          def('member', () => ['foo', 'bar']);

          it('creates member actions from array', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klass/:klass_id/foo' },
              { method: 'post', url: '/klass/:klass_id/bar' },
            ]);
          });
        });
      });

      context('when member is an object', function() {
        def('member', () => ({}));

        it('creates member actions from object', function() {
          expect($subject).to.eql([]);
        });

        context('key in object', function() {
          def('member', () => ({ foo: $actionOptions }));
          def('actionOptions', () => ({}));

          it('creates member actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klass/:klass_id/foo' },
            ]);
          });

          context('when options.path is present', function() {
            def('actionOptions', () => ({ path: 'bar' }));

            it('returns action with path', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klass/:klass_id/bar' },
              ]);
            });

            context('when options.path ends with /', function() {
              def('actionOptions', () => ({ path: 'bar/' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klass/:klass_id/bar' },
                ]);
              });
            });

            context('when options.path starts with /', function() {
              def('actionOptions', () => ({ path: '/bar' }));

              it('returns action with path', function() {
                expect($subject).to.eql([
                  { method: 'post', url: '/klass/:klass_id/bar' },
                ]);
              });
            });
          });

          context('when options.method is present', function() {
            def('actionOptions', () => ({ method: 'get' }));

            it('returns action with method', function() {
              expect($subject).to.eql([
                { method: 'get', url: '/klass/:klass_id/foo' },
              ]);
            });
          });

          context('when options.transform is present', function() {
            def('actionOptions', () => ({ transform: 'pluralize' }));

            it('returns action with name transform', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klasses/:klass_id/foo' },
              ]);
            });
          });

          context('when options.postfix is present', function() {
            def('actionOptions', () => ({ postfix: '.json' }));

            it('returns action with postfix', function() {
              expect($subject).to.eql([
                { method: 'post', url: '/klass/:klass_id/foo.json' },
              ]);
            });
          });
        });

        context('when multiple keys object', function() {
          def('member', () => ({ foo: {}, bar: {}}));

          it('returns member default actions from object', function() {
            expect($subject).to.eql([
              { method: 'post', url: '/klass/:klass_id/foo' },
              { method: 'post', url: '/klass/:klass_id/bar' },
            ]);
          });
        });
      });
    });
  });
});
