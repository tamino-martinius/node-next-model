import { type Filter, FilterError } from '@next-model/core';
import type { PostgrestBuilderLike } from './types.js';

const COMPARISON: Record<string, 'gt' | 'gte' | 'lt' | 'lte'> = {
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
};

/**
 * Quote a value for interpolation into a PostgREST filter-mini-syntax STRING
 * (the `or=(...)`/`not.in.(...)` fragments built by hand below — NOT the
 * builder methods like `.eq()`/`.gt()`, which pass values through the client
 * library and never need this). Reserved characters (`,` `.` `:` `(` `)`
 * whitespace, `"`, `\`) would otherwise be parsed as syntax by PostgREST, so
 * any string containing one gets wrapped in double quotes with `"`/`\`
 * escaped — mirroring PostgREST's own quoting rules for filter values.
 */
export function pgrstValue(v: unknown): string {
  if (typeof v !== 'string') return String(v);
  if (v === '' || /[,.:()"\s\\]/.test(v)) return `"${v.replace(/(["\\])/g, '\\$1')}"`;
  return v;
}

/** PostgREST `or=(...)` mini-syntax value, e.g. `name.eq.ada,age.gt.3`. */
function toOrFragment(filter: Filter<any>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      if (key in COMPARISON) {
        for (const [col, v] of Object.entries(value as object)) {
          parts.push(`${col}.${COMPARISON[key].replace('$', '')}.${pgrstValue(v)}`);
        }
        continue;
      }
      throw new FilterError(`Unsupported operator inside $or for PostgREST: ${key}`);
    }
    parts.push(`${key}.eq.${pgrstValue(value)}`);
  }
  return parts.length > 1 ? `and(${parts.join(',')})` : parts[0];
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
        // Negate a nested sub-filter. PostgREST `.not(col, op, val)`.
        for (const [col, v] of Object.entries(value as Filter<any>)) {
          if (col in COMPARISON) {
            for (const [innerCol, innerV] of Object.entries(v as object)) {
              builder.not(innerCol, COMPARISON[col], innerV);
            }
            continue;
          }
          if (col === '$in') {
            for (const [innerCol, arr] of Object.entries(v as object)) {
              builder.not(innerCol, 'in', `(${(arr as unknown[]).map(pgrstValue).join(',')})`);
            }
            continue;
          }
          if (col === '$null') {
            builder.not(v as string, 'is', null);
            continue;
          }
          if (col.startsWith('$')) {
            throw new FilterError(
              `SupabaseConnector cannot translate $not over this operator: ${col}`,
            );
          }
          builder.not(col, 'eq', v);
        }
        break;
      }
      case '$in':
        for (const [col, arr] of Object.entries(value as object)) builder.in(col, arr as unknown[]);
        break;
      case '$notIn':
        for (const [col, arr] of Object.entries(value as object)) {
          builder.not(col, 'in', `(${(arr as unknown[]).map(pgrstValue).join(',')})`);
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
          const { from, to } = range as { from: unknown; to: unknown };
          builder.gte(col, from).lte(col, to);
        }
        break;
      case '$notBetween':
        for (const [col, range] of Object.entries(value as object)) {
          const { from, to } = range as { from: unknown; to: unknown };
          builder.or(`${col}.lt.${pgrstValue(from)},${col}.gt.${pgrstValue(to)}`);
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
