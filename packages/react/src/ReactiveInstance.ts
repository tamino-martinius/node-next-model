import type { Dict } from '@next-model/core';
import { emitterFor, linkEmitter, storeFor } from './instanceState.js';
import { columnKey } from './pkKey.js';

const proxies = new WeakMap<object, object>();

/**
 * Compute the column names whose persistent value the in-flight mutation
 * is about to change. Used to publish `columnKey(...)` so collection
 * watches that filter on any of those columns can refetch (the row's
 * membership in their result may have flipped).
 *
 * - `update(patch)`: diff `patch` against `persistentProps` so we only
 *   broadcast columns whose value actually changes.
 * - `save()`: read `changedProps` keys — the diff staged by prior
 *   `assign(...)` or setter calls.
 * - `increment(col)` / `decrement(col)`: the arg names the column.
 *
 * `assign` / `revertChange*` don't persist, `reload` doesn't know what
 * changed, and `delete` is handled separately by `store.drop()` plus
 * `publishRow`'s `!stillAlive` branch — all return `[]` here.
 */
function mutatedColumns(prop: string, args: unknown[], target: unknown): string[] {
  if (prop === 'update' && args[0] && typeof args[0] === 'object') {
    const patch = args[0] as Record<string, unknown>;
    const persistent = ((target as { persistentProps?: Record<string, unknown> }).persistentProps ??
      {}) as Record<string, unknown>;
    return Object.keys(patch).filter((k) => persistent[k] !== patch[k]);
  }
  if (prop === 'save') {
    const changed = (target as { changedProps?: Record<string, unknown> }).changedProps ?? {};
    return Object.keys(changed);
  }
  if (prop === 'increment' || prop === 'decrement') {
    return typeof args[0] === 'string' ? [args[0] as string] : [];
  }
  return [];
}
/**
 * Tracks resettable shells (form drafts created via `useModel(M).build(...)`).
 * They must not be inserted into the Store's identity map on save —
 * doing so would let watch refetches return the draft shell, and the next
 * `reset()` would wipe the row's data in every watcher. Build shells are
 * always transient form state, never canonical row representatives.
 */
const buildShells = new WeakSet<object>();

export const BROADCAST_METHODS = new Set([
  'assign',
  'save',
  'delete',
  'update',
  'revertChange',
  'revertChanges',
  'reload',
  'increment',
  'decrement',
]);

export type ReactiveInstance<T> = T;

export interface WrapOptions {
  /** Expose `.reset(props?)` — only true for `.build()` shells. */
  resettable?: boolean;
}

export function wrapInstance<T extends object>(
  instance: T,
  options: WrapOptions = {},
): ReactiveInstance<T> {
  const existing = proxies.get(instance);
  if (existing) return existing as T;

  let proxy: T;
  proxy = new Proxy(instance, {
    get(target, prop, receiver) {
      if (options.resettable && prop === 'reset') {
        return (props: Dict<unknown> = {}) => {
          const ModelCtor = (target as object).constructor as unknown as {
            init: (p: Dict<unknown>) => Dict<unknown>;
          };
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
          // Capture keys before calling the method — delete() clears target.keys to undefined.
          const keysBefore = (target as { keys?: Record<string, unknown> }).keys;
          const tableName = ((target as object).constructor as { tableName?: string }).tableName;
          // Compute the columns the mutation will change BEFORE running it
          // — `save()` clears `changedProps`, and `update(patch)` needs the
          // pre-mutation `persistentProps` to compute the diff.
          const changedCols = mutatedColumns(prop, args, target);
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).then(
              (r) => {
                emitterFor(target).emit();
                const store = storeFor(target);
                if (store && !store.isDisposed()) {
                  const keys =
                    prop === 'delete'
                      ? keysBefore
                      : (target as { keys?: Record<string, unknown> }).keys;
                  if (keys && tableName) {
                    if (prop === 'delete') {
                      store.drop(tableName, keys);
                    } else if (!buildShells.has(proxy as object)) {
                      // save / update / reload / increment / decrement on a fetched
                      // shell: this row is now canonical. Build shells stay out of
                      // the identity map so reset() can't wipe row data in watchers.
                      store.softRegister(tableName, keys, proxy as object);
                    }
                    store.publishRow(tableName, keys);
                  }
                  // Publish per-column keys for any actually-changed columns
                  // so collection watches whose `filterBy` references those
                  // columns refetch (membership may have flipped).
                  if (tableName) {
                    for (const col of changedCols) {
                      store.publish(columnKey(tableName, col));
                    }
                  }
                }
                return r;
              },
              (e) => {
                emitterFor(target).emit();
                throw e;
              },
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
  if (options.resettable) buildShells.add(proxy as object);
  return proxy as T;
}

export function isBuildShell(proxy: object): boolean {
  return buildShells.has(proxy);
}
