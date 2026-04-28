import { Emitter } from './Emitter.js';
import type { Store } from './Store.js';

const emitters = new WeakMap<object, Emitter>();
const stores = new WeakMap<object, Store>();

export function emitterFor(instance: object): Emitter {
  let e = emitters.get(instance);
  if (!e) { e = new Emitter(); emitters.set(instance, e); }
  return e;
}

export function linkEmitter(alias: object, original: object): void {
  emitters.set(alias, emitterFor(original));
}

export function storeFor(instance: object): Store | undefined {
  return stores.get(instance);
}

export function tagStore(instance: object, store: Store): void {
  stores.set(instance, store);
}
