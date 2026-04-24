import { FilterError } from './errors';
import type { Dict, Filter, FilterBetween, FilterIn, FilterRaw, FilterSpecial } from './types';

const singleKey = (filter: Dict<any>, op: string): string => {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${op} expects exactly one key, got ${keys.length}`);
  }
  return keys[0];
};

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
