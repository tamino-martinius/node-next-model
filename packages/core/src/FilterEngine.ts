import { FilterError } from './errors.js';
import type { Dict, Filter, FilterBetween, FilterIn, FilterRaw, FilterSpecial } from './types.js';

const singleKey = (filter: Dict<any>, op: string): string => {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${op} expects exactly one key, got ${keys.length}`);
  }
  return keys[0];
};

/**
 * Operators that, when used at the top level, treat their value as-is:
 * `$and` / `$or` accept filter arrays; `$not` / `$async` / `$raw` accept a
 * filter or primitive. The shape normalizer never descends into these.
 */
const COMPOSITION_OPS = new Set(['$and', '$or', '$not', '$async', '$raw']);

/**
 * Column-level operators that can appear inside a `{column: {...}}` object.
 * Each one is rewritten to its top-level `{$op: {column: value}}` form so
 * the rest of the engine and every connector keep seeing a single shape.
 */
const COLUMN_OP_NAMES = [
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$notIn',
  '$null',
  '$notNull',
  '$between',
  '$notBetween',
  '$like',
  '$not',
] as const;
const COLUMN_OPS = new Set<string>(COLUMN_OP_NAMES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

function isColumnOpMap(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every((k) => COLUMN_OPS.has(k));
}

/**
 * Accepts both filter shapes and returns the legacy `{$op: {col: v}}` shape:
 *
 *   { age: { $gt: 18 } }                      -> { $gt: { age: 18 } }
 *   { age: { $gt: 18, $lt: 65 } }             -> { $and: [{ $gt: { age: 18 } }, { $lt: { age: 65 } }] }
 *   { name: { $not: 'john' } }                -> { $not: { name: 'john' } }
 *   { active: true }                          -> { active: true }        (unchanged)
 *   { $and: [{ age: { $gt: 18 } }, ...] }     -> { $and: [<normalized>, ...] }
 *   { $raw: '...' } / { $async: promise }     -> unchanged
 *
 * Equality against nested objects (e.g. `{ metadata: { source: 'web' } }`)
 * still works — a key is only treated as a column operator map when every
 * one of its keys starts with `$` and is in the known column-operator set.
 */
export function normalizeFilterShape<T extends Filter<any>>(filter: T): T {
  if (!isPlainObject(filter)) return filter;

  const normalized: Record<string, unknown> = {};
  const andPieces: unknown[] = [];

  for (const [key, value] of Object.entries(filter)) {
    if (COMPOSITION_OPS.has(key)) {
      if (key === '$and' || key === '$or') {
        normalized[key] = (value as unknown[]).map((child) =>
          normalizeFilterShape(child as Filter<any>),
        );
      } else if (key === '$not') {
        normalized[key] = isPlainObject(value) ? normalizeFilterShape(value as Filter<any>) : value;
      } else {
        normalized[key] = value;
      }
      continue;
    }

    if (key.startsWith('$')) {
      // Legacy `{$op: {col: v}}` — leave as-is.
      normalized[key] = value;
      continue;
    }

    if (isColumnOpMap(value)) {
      const ops = value as Record<string, unknown>;
      const opKeys = Object.keys(ops);
      if (opKeys.length === 1) {
        const op = opKeys[0];
        normalized[op] ??= {} as Record<string, unknown>;
        (normalized[op] as Record<string, unknown>)[key] = ops[op];
      } else {
        for (const op of opKeys) {
          andPieces.push({ [op]: { [key]: ops[op] } });
        }
      }
      continue;
    }

    // Plain equality (possibly against a nested object literal — kept unchanged).
    normalized[key] = value;
  }

  if (andPieces.length > 0) {
    const existing = Object.keys(normalized);
    if (existing.length === 0 && andPieces.length === 1) {
      return andPieces[0] as T;
    }
    const rest = existing.length > 0 ? [normalized] : [];
    return { $and: [...rest, ...andPieces] } as unknown as T;
  }

  return normalized as T;
}

async function propertyFilter(items: Dict<any>[], filter: Dict<any>): Promise<Dict<any>[]> {
  return items.filter((item) => {
    for (const key in filter) {
      if (item[key] !== filter[key]) return false;
    }
    return true;
  });
}

async function andFilter(items: Dict<any>[], filters: Filter<Dict<any>>[]): Promise<Dict<any>[]> {
  let result = items;
  for (const filter of filters) {
    result = await filterList(result, filter);
  }
  return result;
}

async function notFilter(items: Dict<any>[], filter: Filter<Dict<any>>): Promise<Dict<any>[]> {
  const excluded = new Set(await filterList(items, filter));
  return items.filter((item) => !excluded.has(item));
}

async function orFilter(items: Dict<any>[], filters: Filter<Dict<any>>[]): Promise<Dict<any>[]> {
  const arrays = await Promise.all(filters.map((filter) => filterList(items, filter)));
  const union = new Set(arrays.flat());
  return items.filter((item) => union.has(item));
}

async function inFilter(
  items: Dict<any>[],
  filter: Partial<FilterIn<Dict<any>>>,
): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$in');
  return items.filter((item) => {
    const values = filter[key];
    if (Array.isArray(values)) {
      for (const value of values) {
        if (item[key] === value) return true;
      }
    }
    return false;
  });
}

async function notInFilter(
  items: Dict<any>[],
  filter: Partial<FilterIn<Dict<any>>>,
): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$notIn');
  return items.filter((item) => {
    const values = filter[key];
    if (Array.isArray(values)) {
      for (const value of values) {
        if (item[key] === value) return false;
      }
    }
    return true;
  });
}

async function nullFilter(items: Dict<any>[], key: string): Promise<Dict<any>[]> {
  return items.filter((item) => item[key] === null || item[key] === undefined);
}

async function notNullFilter(items: Dict<any>[], key: string): Promise<Dict<any>[]> {
  return items.filter((item) => item[key] !== null && item[key] !== undefined);
}

async function betweenFilter(
  items: Dict<any>[],
  filter: Partial<FilterBetween<Dict<any>>>,
): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$between');
  const range = filter[key];
  if (range === undefined) return items;
  return items.filter((item) => range.to >= item[key] && item[key] >= range.from);
}

async function notBetweenFilter(
  items: Dict<any>[],
  filter: Partial<FilterBetween<Dict<any>>>,
): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$notBetween');
  const range = filter[key];
  if (range === undefined) return items;
  return items.filter((item) => range.to < item[key] || item[key] < range.from);
}

async function gtFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$gt');
  return items.filter((item) => item[key] > filter[key]);
}

async function gteFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$gte');
  return items.filter((item) => item[key] >= filter[key]);
}

async function ltFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$lt');
  return items.filter((item) => item[key] < filter[key]);
}

async function lteFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$lte');
  return items.filter((item) => item[key] <= filter[key]);
}

async function likeFilter(items: Dict<any>[], filter: Partial<Dict<any>>): Promise<Dict<any>[]> {
  const key = singleKey(filter, '$like');
  const pattern = filter[key];
  if (typeof pattern !== 'string') return [];
  const regex = new RegExp(
    `^${pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.')}$`,
  );
  return items.filter((item) => typeof item[key] === 'string' && regex.test(item[key]));
}

async function rawFilter(items: Dict<any>[], filter: FilterRaw): Promise<Dict<any>[]> {
  const fn = compileRawQuery(filter.$query);
  const params = filter.$bindings;
  if (Array.isArray(params)) {
    return items.filter((item) => fn(item, ...params));
  }
  return items.filter((item) => fn(item, params));
}

async function asyncFilter(
  items: Dict<any>[],
  pending: Promise<Filter<Dict<any>>>,
): Promise<Dict<any>[]> {
  const filter = await pending;
  if (filter && Object.keys(filter).length > 0) {
    return filterList(items, filter);
  }
  return items;
}

async function specialFilter(
  items: Dict<any>[],
  filter: FilterSpecial<Dict<any>>,
): Promise<Dict<any>[]> {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`special filter expects exactly one operator, got ${keys.length}`);
  }
  if (filter.$and !== undefined) return andFilter(items, filter.$and);
  if (filter.$or !== undefined) return orFilter(items, filter.$or);
  if (filter.$not !== undefined) return notFilter(items, filter.$not);
  if (filter.$in !== undefined) return inFilter(items, filter.$in);
  if (filter.$notIn !== undefined) return notInFilter(items, filter.$notIn);
  if (filter.$null !== undefined) return nullFilter(items, filter.$null as string);
  if (filter.$notNull !== undefined) return notNullFilter(items, filter.$notNull as string);
  if (filter.$between !== undefined) return betweenFilter(items, filter.$between);
  if (filter.$notBetween !== undefined) return notBetweenFilter(items, filter.$notBetween);
  if (filter.$gt !== undefined) return gtFilter(items, filter.$gt);
  if (filter.$gte !== undefined) return gteFilter(items, filter.$gte);
  if (filter.$lt !== undefined) return ltFilter(items, filter.$lt);
  if (filter.$lte !== undefined) return lteFilter(items, filter.$lte);
  if (filter.$like !== undefined) return likeFilter(items, filter.$like);
  if (filter.$raw !== undefined) return rawFilter(items, filter.$raw);
  if (filter.$async !== undefined) return asyncFilter(items, filter.$async);
  throw new FilterError(`unknown special filter operator: ${keys[0]}`);
}

function compileRawQuery(source: string): (...args: any[]) => any {
  // biome-ignore lint/security/noGlobalEval: in-memory filter evaluates raw predicate strings by design
  return eval(source);
}

export async function filterList(
  items: Dict<any>[],
  filter: Filter<Dict<any>> = {},
): Promise<Dict<any>[]> {
  for (const key in filter) {
    if (key.startsWith('$')) {
      return specialFilter(items, <FilterSpecial<Dict<any>>>filter);
    }
  }
  return propertyFilter(items, <Partial<Dict<any>>>filter);
}
