'use strict';

const NextModel = require('..');
const expect = require('expect.js');
const expectChange = require('expect-change');
const sinon = require('sinon');

const lodash = require('lodash');
const upperFirst = lodash.upperFirst;

const promiseError = function() {
  return $subject
    .then(() => expect().fail('Promise is not expected to reach'))
    .catch(() => {});
};

const behavesLikeActionWhichSupportsCallbacks = function(options) {
  const action = options.action;
  const actionIsStatic = options.actionIsStatic;
  const actionIsPromise = options.actionIsPromise;
  const Action = upperFirst(action);
  const beforeAction = `before${Action}`;
  const afterAction = `after${Action}`;
  const innerActionBase = options.innerActionBase || 'connector';
  const innerActionName = options.innerActionName || action;

  context(`when callbacks for ${beforeAction} and ${afterAction} are present`, function() {
    def('context', () => actionIsStatic ? $Klass : $klass);
    def('beforeAction', () => sinon.stub($context, beforeAction));
    def('afterAction', () => sinon.stub($context, afterAction));
    def('beforeActionSpy', () => $beforeAction);
    def('action', () => sinon.stub(get(innerActionBase), innerActionName));
    def('actionSpy', () => $action);
    def('afterActionSpy', () => $afterAction);
    def('redirectAction', () => sinon.stub($context, 'redirect'));
    def('redirectActionSpy', () => $redirectAction);

    beforeEach(function() {
      $context[beforeAction] = function() {};
      $context[afterAction] = function() {};
      $context.redirect = function() {};
      if (actionIsPromise) {
        $beforeAction.returns(Promise.resolve(true));
        $action.returns(Promise.resolve($klass));
        $afterAction.returns(Promise.resolve(true));
        $redirectAction.returns(Promise.resolve(true));
      } else {
        $beforeAction.returns(true);
        $action.returns($context);
        $afterAction.returns(true);
        $redirectAction.returns(true);
      }
    });

    it('does action and calls callbacks in right order', function() {
      expect($actionSpy.called).to.be(false);
      return $subject.then(data => {
        expect($beforeActionSpy.calledOnce).to.be(true);
        expect($actionSpy.calledOnce).to.be(true);
        expect($afterActionSpy.calledOnce).to.be(true);

        expect($actionSpy.calledAfter($beforeActionSpy)).to.be(true);
        expect($actionSpy.calledBefore($afterActionSpy)).to.be(true);
      });
    });

    context('when beforeAction redirects to another property', function() {
      beforeEach(function() {
        $context[beforeAction] = 'redirect';
      });

      it('follows redirect', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($redirectActionSpy.calledOnce).to.be(true);
          expect($beforeActionSpy.called).to.be(false);
          expect($actionSpy.calledOnce).to.be(true);
          expect($afterActionSpy.calledOnce).to.be(true);

          expect($actionSpy.calledAfter($redirectActionSpy)).to.be(true);
          expect($actionSpy.calledBefore($afterActionSpy)).to.be(true);
        });
      });
    });

    context('when beforeAction is array of redirects', function() {
      beforeEach(function() {
        $context[beforeAction] = ['redirect', 'redirect'];
      });

      it('follows redirect', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($redirectActionSpy.calledTwice).to.be(true);
          expect($beforeActionSpy.called).to.be(false);
          expect($actionSpy.calledOnce).to.be(true);
          expect($afterActionSpy.calledOnce).to.be(true);

          expect($actionSpy.calledAfter($redirectActionSpy)).to.be(true);
          expect($actionSpy.calledBefore($afterActionSpy)).to.be(true);
        });
      });
    });

    context('when beforeAction is mixed array', function() {
      def('beforeActionSpy', () => sinon.spy());
      beforeEach(function() {
        $context[beforeAction] = ['redirect', $beforeActionSpy];
      });

      it('follows redirect', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($redirectActionSpy.calledOnce).to.be(true);
          expect($beforeActionSpy.calledOnce).to.be(true);
          expect($actionSpy.calledOnce).to.be(true);
          expect($afterActionSpy.calledOnce).to.be(true);

          expect($beforeActionSpy.calledAfter($redirectActionSpy)).to.be(true);
          expect($actionSpy.calledAfter($beforeActionSpy)).to.be(true);
          expect($actionSpy.calledBefore($afterActionSpy)).to.be(true);
        });
      });
    });

    context('when beforeAction redirects multiple times', function() {
      def('beforeActionSpy', () => sinon.spy());
      beforeEach(function() {
        $context[beforeAction] = ['proxy', $beforeActionSpy];
        $context.proxy = ['redirect', 'redirect'];
      });

      it('follows redirect', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($redirectActionSpy.calledTwice).to.be(true);
          expect($beforeActionSpy.calledOnce).to.be(true);
          expect($actionSpy.calledOnce).to.be(true);
          expect($afterActionSpy.calledOnce).to.be(true);

          expect($beforeActionSpy.calledAfter($redirectActionSpy)).to.be(true);
          expect($actionSpy.calledAfter($beforeActionSpy)).to.be(true);
          expect($actionSpy.calledBefore($afterActionSpy)).to.be(true);
        });
      });
    });

    context('when before callback throws error', function() {
      beforeEach(function() {
        $beforeAction.throws(new Error('Should be catched'));
      });

      it('catches promise reject', promiseError);

      it('stops the record action', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($beforeActionSpy.calledOnce).to.be(true);
          expect($actionSpy.called).to.be(false);
          expect($afterActionSpy.called).to.be(false);
        });
      });
    });

    if (actionIsPromise) {
      context('when before callback rejects error', function() {
        beforeEach(function() {
          $beforeAction.returns(Promise.reject(new Error('Should be catched')));
        });

        it('catches promise reject', promiseError);

        it('stops the record action', function() {
          expect($actionSpy.called).to.be(false);
          return $subject.then(data => {
            expect($beforeActionSpy.calledOnce).to.be(true);
            expect($actionSpy.called).to.be(false);
            expect($afterActionSpy.called).to.be(false);
          });
        });
      });
    }

    context('when action failes', function() {
      beforeEach(function() {
        if (actionIsPromise) {
          $action.returns(Promise.reject('Should be catched'));
        } else {
          $action.throws(new Error('Should be catched'));
        }
      });

      it('catches promise reject', promiseError);

      it('tries action and stops callbacks', function() {
        expect($actionSpy.called).to.be(false);
        return $subject.then(data => {
          expect($actionSpy.called).to.be(true);
          expect($beforeActionSpy.calledOnce).to.be(true);
          expect($actionSpy.calledOnce).to.be(true);
          expect($afterActionSpy.called).to.be(false);

          expect($actionSpy.calledAfter($beforeActionSpy)).to.be(true);
        });
      });
    });
  });
};

module.exports = {
  promiseError,
  behavesLikeActionWhichSupportsCallbacks,
};
