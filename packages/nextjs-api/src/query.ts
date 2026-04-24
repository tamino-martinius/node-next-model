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
  cursorRequested: boolean;
}

function parseFilter(raw: string | null): Filter<any> | undefined {
  if (raw === null || raw === '') return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Filter<any>;
  } catch (_err) {
    throw new BadRequestError(`filter query must be JSON; got: ${raw}`);
  }
  throw new BadRequestError('filter query must decode to an object');
}

function parseOrder(raw: string | null): Order<any> | undefined {
  if (raw === null || raw === '') return undefined;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw) as Order<any>;
    } catch (_err) {
      throw new BadRequestError(`order query must be JSON or CSV; got: ${raw}`);
    }
  }
  const cols = raw.split(',').map((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) throw new BadRequestError('order query contains an empty segment');
    if (trimmed.startsWith('-')) return { key: trimmed.slice(1), dir: SortDirection.Desc };
    return { key: trimmed, dir: SortDirection.Asc };
  });
  return cols.length === 1 ? cols[0] : (cols as unknown as Order<any>);
}

function parseNonNegativeInt(raw: string | null, name: string): number | undefined {
  if (raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new BadRequestError(`${name} must be a number; got: ${raw}`);
  return Math.max(0, Math.floor(n));
}

function parsePositiveInt(raw: string | null, name: string): number | undefined {
  const parsed = parseNonNegativeInt(raw, name);
  if (parsed === undefined) return undefined;
  return Math.max(1, parsed);
}

export function parseListQuery(url: URL): ParsedListQuery {
  const params = url.searchParams;
  return {
    filter: parseFilter(params.get('filter')),
    order: parseOrder(params.get('order')),
    limit: parsePositiveInt(params.get('limit'), 'limit'),
    skip: parseNonNegativeInt(params.get('skip'), 'skip'),
    page: parsePositiveInt(params.get('page'), 'page'),
    perPage: parsePositiveInt(params.get('perPage') ?? params.get('per_page'), 'perPage'),
    after: params.get('after') ?? undefined,
    before: params.get('before') ?? undefined,
    cursorRequested: params.has('after') || params.has('before'),
  };
}

export function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const chosen = limit ?? fallback;
  return Math.min(max, Math.max(1, Math.floor(chosen)));
}
