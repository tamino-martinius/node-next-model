import type { Dict } from '@next-model/core';
import { tagStore } from './instanceState.js';
import { wrapInstance } from './ReactiveInstance.js';
import type { Store } from './Store.js';

function keysOf(instance: object): Dict<unknown> {
  return (instance as { keys?: Dict<unknown> }).keys ?? {};
}

function isModelInstance(x: unknown): x is object {
  return Boolean(x && typeof x === 'object' && 'attributes' in (x as object));
}

/**
 * Tag a freshly fetched raw instance with the store, wrap it in a reactive
 * shell, and reconcile against any already-canonical shell in the store's
 * identity map. Shared by `useAsyncTerminal`, `useWatch`, and `run()`.
 *
 * Mutations performed through the returned shell auto-publish the row's
 * key via `ReactiveInstance`'s `BROADCAST_METHODS` wrapper.
 */
export function adopt(instance: object, tableName: string, store: Store): object {
  tagStore(instance, store);
  const shell = wrapInstance(instance);
  const keys = keysOf(instance);
  if (Object.keys(keys).length === 0) return shell;
  const cached = store.acquire(tableName, keys);
  if (cached) {
    const freshAttrs = (instance as { persistentProps?: Record<string, unknown> }).persistentProps;
    if (freshAttrs)
      (cached as { persistentProps: Record<string, unknown> }).persistentProps = freshAttrs;
    return cached;
  }
  store.softRegister(tableName, keys, shell);
  return shell;
}

export function decorate(raw: unknown, tableName: string, store: Store): unknown {
  if (Array.isArray(raw)) {
    const out: object[] = [];
    for (const row of raw) {
      if (isModelInstance(row)) out.push(adopt(row, tableName, store));
    }
    return out;
  }
  if (isModelInstance(raw)) return adopt(raw, tableName, store);
  return raw;
}
