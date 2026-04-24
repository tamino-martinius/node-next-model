import { type Filter, type Order, SortDirection } from '@next-model/core';

import { BadRequestError } from './errors.js';

export interface ParsedListQuery {
  filter?: Filter<any>;
  order?: Order<any>;
  limit?: number;
  skip?: number;
  page?: number;
  perPage?: number;
  after?: string;
  before?: string;
}

/**
 * Filter inputs accept either a JSON-encoded string (`?filter={"name":"Ada"}`) or
 * Express's nested bracket syntax (`?filter[name]=Ada`). Nested objects go through
 * `qs` parsing so operators like `{ $gte: { age: 18 } }` are also expressible as
 * `?filter[$gte][age]=18`.
 */
function parseFilter(raw: unknown): Filter<any> | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') {
    if (raw === '') return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Filter<any>;
    } catch (_err) {
      throw new BadRequestError(`filter query must be JSON or an object; got: ${raw}`);
    }
    throw new BadRequestError(`filter query must decode to an object`);
  }
  if (typeof raw === 'object') return raw as Filter<any>;
  throw new BadRequestError(`filter query must be JSON or an object`);
}

/**
 * Order inputs accept either a comma-separated string (`?order=-createdAt,name`) with a
 * leading `-` indicating descending, or the same JSON/bracket shape as the Model's
 * chainable `orderBy` accepts: `?order[key]=age&order[direction]=desc`.
 */
function parseOrder(raw: unknown): Order<any> | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === 'string') {
    if (raw === '') return undefined;
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        return JSON.parse(raw) as Order<any>;
      } catch (_err) {
        throw new BadRequestError(`order query must be JSON or an object; got: ${raw}`);
      }
    }
    const cols = raw.split(',').map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) throw new BadRequestError(`order query contains an empty segment`);
      if (trimmed.startsWith('-')) return { key: trimmed.slice(1), dir: SortDirection.Desc };
      return { key: trimmed, dir: SortDirection.Asc };
    });
    return cols.length === 1 ? cols[0] : (cols as unknown as Order<any>);
  }
  if (typeof raw === 'object') return raw as Order<any>;
  throw new BadRequestError(`order query must be JSON or an object`);
}

function parseNonNegativeInt(raw: unknown, name: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new BadRequestError(`${name} must be a number; got: ${raw}`);
    return Math.max(0, Math.floor(n));
  }
  throw new BadRequestError(`${name} must be a number`);
}

function parsePositiveInt(raw: unknown, name: string): number | undefined {
  const parsed = parseNonNegativeInt(raw, name);
  if (parsed === undefined) return undefined;
  return Math.max(1, parsed);
}

function parseCursor(raw: unknown, name: string): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw === 'string') return raw;
  throw new BadRequestError(`${name} must be a string`);
}

export function parseListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    filter: parseFilter(query.filter),
    order: parseOrder(query.order),
    limit: parsePositiveInt(query.limit, 'limit'),
    skip: parseNonNegativeInt(query.skip, 'skip'),
    page: parsePositiveInt(query.page, 'page'),
    perPage: parsePositiveInt(query.perPage ?? query.per_page, 'perPage'),
    after: parseCursor(query.after, 'after'),
    before: parseCursor(query.before, 'before'),
  };
}

export function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const chosen = limit ?? fallback;
  return Math.min(max, Math.max(1, Math.floor(chosen)));
}
