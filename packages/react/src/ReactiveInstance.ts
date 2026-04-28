import { emitterFor, linkEmitter } from './instanceState.js';

const proxies = new WeakMap<object, object>();

export const BROADCAST_METHODS = new Set([
  'assign', 'save', 'delete', 'update',
  'revertChange', 'revertChanges',
  'reload', 'increment', 'decrement',
]);

export type ReactiveInstance<T> = T;

export interface WrapOptions {
  /** Expose `.reset(props?)` — only true for `.build()` shells. (Task 7 wires the behaviour.) */
  resettable?: boolean;
}

export function wrapInstance<T extends object>(instance: T, _options: WrapOptions = {}): ReactiveInstance<T> {
  const existing = proxies.get(instance);
  if (existing) return existing as T;

  const proxy = new Proxy(instance, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && BROADCAST_METHODS.has(prop) && typeof value === 'function') {
        return function (this: unknown, ...args: unknown[]) {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).then(
              (r) => { emitterFor(target).emit(); return r; },
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
  });

  proxies.set(instance, proxy);
  linkEmitter(proxy, instance);
  return proxy as T;
}
