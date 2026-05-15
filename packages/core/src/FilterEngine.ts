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

  // Plain column equality. These all coexist fine in a single object via the
  // connector's `compileEquality` path, so we collect them together.
  const equality: Record<string, unknown> = {};

  // Each entry here becomes one AND-piece in the final wrapper. Top-level
  // operators (`$null`, `$in`, `$gt`, `$and`, `$or`, `$not`, `$raw`,
  // `$async`, ...) cannot coexist with each other or with equality in a
  // single object — every connector's `compileFilter` short-circuits on the
  // first operator it recognises and silently drops siblings. We split each
  // one into its own AND-piece so the wrapper preserves the user's intent.
  const andPieces: unknown[] = [];

  for (const [key, value] of Object.entries(filter)) {
    if (COMPOSITION_OPS.has(key)) {
      if (key === '$and' || key === '$or') {
        andPieces.push({
          [key]: (value as unknown[]).map((child) => normalizeFilterShape(child as Filter<any>)),
        });
      } else if (key === '$not') {
        andPieces.push({
          [key]: isPlainObject(value) ? normalizeFilterShape(value as Filter<any>) : value,
        });
      } else {
        andPieces.push({ [key]: value });
      }
      continue;
    }

    if (key.startsWith('$')) {
      // Top-level column operator (`$null`, `$in`, `$gt`, ...). Treat as its
      // own AND-piece so it can safely coexist with sibling equality or
      // other operators in the original filter.
      andPieces.push({ [key]: value });
      continue;
    }

    if (isColumnOpMap(value)) {
      const ops = value as Record<string, unknown>;
      const opKeys = Object.keys(ops);
      for (const op of opKeys) {
        andPieces.push({ [op]: { [key]: ops[op] } });
      }
      continue;
    }

    // Plain equality (possibly against a nested object literal — kept unchanged).
    equality[key] = value;
  }

  // Decide the simplest equivalent shape because downstream code paths
  // (lower, walkFilter, defaultScope pruning, the connector fast paths) all
  // already special-case the flat form.
  const equalityKeys = Object.keys(equality);

  // No top-level operators were present — keep the flat equality shape so
  // the connector's `compileEquality` fast path applies unchanged. (Empty
  // object is also returned here — it is a no-op filter.)
  if (andPieces.length === 0) return equality as T;

  // Exactly one piece and no equality — return the single piece directly so
  // single-operator filters keep their established shape (no spurious
  // `$and` wrapper that would break callers / pretty-printers).
  if (equalityKeys.length === 0 && andPieces.length === 1) {
    return andPieces[0] as T;
  }

  // Mixed form: wrap everything in $and. Equality (if any) is a single AND
  // piece so the connector's compileEquality fast path still applies inside.
  const wrapped: unknown[] = [];
  if (equalityKeys.length > 0) wrapped.push(equality);
  for (const piece of andPieces) wrapped.push(piece);
  return { $and: wrapped } as unknown as T;
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
    return items.filter((item) => Boolean(fn(item, ...params)));
  }
  if (params === undefined) {
    return items.filter((item) => Boolean(fn(item)));
  }
  return items.filter((item) => Boolean(fn(item, params)));
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

/**
 * In-memory `$raw` filters compile to a predicate function. The legacy v1.x
 * behaviour accepted a JavaScript-source string that was compiled at runtime
 * through dynamic-code evaluation — a CSP / tree-shaking / source-map hazard.
 * That code path has been removed; the runtime no longer compiles strings.
 *
 * Accepted shapes:
 *  - a function `(item, ...bindings) => boolean` — the recommended form
 *  - a string — throws `FilterError` with a migration hint
 *
 * SQL connectors (`KnexConnector`, `PostgresConnector`, `SqliteConnector`,
 * `MysqlConnector`, `MariaDbConnector`, `AuroraDataApiConnector`) keep the
 * string form because they treat `$query` as a SQL fragment, not JS source.
 * This change only affects JS-evaluating connectors that route through
 * `FilterEngine.filterList`.
 */
function compileRawQuery(query: string | ((...args: any[]) => any)): (...args: any[]) => any {
  if (typeof query === 'function') return query;
  if (typeof query === 'string') {
    throw new FilterError(
      '$raw.$query as a JavaScript-source string is not supported by JS-evaluating connectors. ' +
        'Pass a predicate function instead: ' +
        '`$raw: { $query: (item, x) => item.age > x, $bindings: [18] }`. ' +
        'SQL connectors still accept SQL strings.',
    );
  }
  throw new FilterError(`$raw.$query must be a function or SQL string; received ${typeof query}`);
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
