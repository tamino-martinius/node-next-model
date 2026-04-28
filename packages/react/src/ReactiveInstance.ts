import type { Dict } from '@next-model/core';
import { emitterFor, linkEmitter, storeFor } from './instanceState.js';

const proxies = new WeakMap<object, object>();

export const BROADCAST_METHODS = new Set([
  'assign', 'save', 'delete', 'update',
  'revertChange', 'revertChanges',
  'reload', 'increment', 'decrement',
]);

export type ReactiveInstance<T> = T;

export interface WrapOptions {
  /** Expose `.reset(props?)` — only true for `.build()` shells. */
  resettable?: boolean;
}

export function wrapInstance<T extends object>(instance: T, options: WrapOptions = {}): ReactiveInstance<T> {
  const existing = proxies.get(instance);
  if (existing) return existing as T;

  let proxy: T;
  proxy = new Proxy(instance, {
    get(target, prop, receiver) {
      if (options.resettable && prop === 'reset') {
        return (props: Dict<unknown> = {}) => {
          const ModelCtor = (target as object).constructor as { init: (p: Dict<unknown>) => Dict<unknown> };
          const fresh = ModelCtor.init(props);
          (target as { persistentProps: Dict<unknown> }).persistentProps = fresh;
          (target as { changedProps: Dict<unknown> }).changedProps = {};
          (target as { keys: Dict<unknown> | undefined }).keys = undefined;
          (target as { lastSavedChanges: Dict<unknown> }).lastSavedChanges = {};
          const errors = (target as { _errors?: { clear(): void } })._errors;
          if (errors) errors.clear();
          emitterFor(target).emit();
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && BROADCAST_METHODS.has(prop) && typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).then(
              (r) => {
                emitterFor(target).emit();
                const store = storeFor(target);
                if (store && !store.isDisposed()) {
                  const keys = (target as { keys?: Record<string, unknown> }).keys;
                  const tableName = ((target as object).constructor as { tableName?: string }).tableName;
                  if (keys && tableName) {
                    if (prop === 'delete') {
                      store.drop(tableName, keys);
                    } else {
                      // save / update / reload / increment / decrement: this row is now canonical.
                      store.softRegister(tableName, keys, proxy as object);
                    }
                    store.publishRow(tableName, keys);
                  }
                }
                return r;
              },
              (e) => { emitterFor(target).emit(); throw e; },
            );
          }
          emitterFor(target).emit();
          return result;
        };
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const ok = Reflect.set(target, prop, value, receiver);
      if (ok) emitterFor(target).emit();
      return ok;
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
  }) as T;

  proxies.set(instance, proxy);
  linkEmitter(proxy as object, instance);
  return proxy as T;
}
