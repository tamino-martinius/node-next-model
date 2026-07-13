import { type Filter, FilterError } from '@next-model/core';
import type { PostgrestBuilderLike } from './types.js';

const COMPARISON: Record<string, 'gt' | 'gte' | 'lt' | 'lte'> = {
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
};

/** PostgREST `or=(...)` mini-syntax value, e.g. `name.eq.ada,age.gt.3`. */
function toOrFragment(filter: Filter<any>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      if (key in COMPARISON) {
        for (const [col, v] of Object.entries(value as object)) {
          parts.push(`${col}.${COMPARISON[key].replace('$', '')}.${v}`);
        }
        continue;
      }
      throw new FilterError(`Unsupported operator inside $or for PostgREST: ${key}`);
    }
    parts.push(`${key}.eq.${value}`);
  }
  return parts.join(',');
}

export function applyFilters<B extends PostgrestBuilderLike>(
  builder: B,
  filter: Filter<any> | undefined,
): B {
  if (!filter) return builder;
  for (const [key, value] of Object.entries(filter)) {
    switch (key) {
      case '$and':
        for (const sub of value as Filter<any>[]) applyFilters(builder, sub);
        break;
      case '$or':
        builder.or((value as Filter<any>[]).map(toOrFragment).join(','));
        break;
      case '$not': {
        // Negate a single-key equality/comparison. PostgREST `.not(col, op, val)`.
        for (const [col, v] of Object.entries(value as object)) {
          builder.not(col, 'eq', v);
        }
        break;
      }
      case '$in':
        for (const [col, arr] of Object.entries(value as object)) builder.in(col, arr as unknown[]);
        break;
      case '$notIn':
        for (const [col, arr] of Object.entries(value as object)) {
          builder.not(col, 'in', `(${(arr as unknown[]).join(',')})`);
        }
        break;
      case '$null':
        builder.is(value as string, null);
        break;
      case '$notNull':
        builder.not(value as string, 'is', null);
        break;
      case '$between':
        for (const [col, range] of Object.entries(value as object)) {
          const [min, max] = range as [unknown, unknown];
          builder.gte(col, min).lte(col, max);
        }
        break;
      case '$notBetween':
        for (const [col, range] of Object.entries(value as object)) {
          const [min, max] = range as [unknown, unknown];
          builder.or(`${col}.lt.${min},${col}.gt.${max}`);
        }
        break;
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte':
        for (const [col, v] of Object.entries(value as object)) builder[COMPARISON[key]](col, v);
        break;
      case '$like':
        for (const [col, v] of Object.entries(value as object)) builder.like(col, v as string);
        break;
      case '$raw':
        throw new FilterError(
          'SupabaseConnector cannot evaluate $raw filters: PostgREST has no SQL-fragment equivalent. Use a Postgres RPC or a native filter operator.',
        );
      case '$async':
        throw new FilterError(
          'SupabaseConnector received an unresolved $async filter. Await the promise before querying.',
        );
      default:
        // Plain equality: `{ column: value }`.
        builder.eq(key, value as unknown);
    }
  }
  return builder;
}
