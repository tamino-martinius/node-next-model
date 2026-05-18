import type { QueryPlan } from './ReactiveQuery.js';

/**
 * Walk a `filterBy` predicate (or any nested sub-filter from `$and` / `$or` /
 * `$not`) and collect every column name it references. Used by `useWatch` to
 * subscribe to per-column publishes — so a mutation that changes a column
 * the watch filters on causes a refetch (membership may have flipped).
 *
 * Supported predicate shapes (matching `@next-model/core`'s filter DSL):
 * - Plain column predicates: `{ projectId: 'p1' }` → adds `projectId`.
 * - `$null` / `$notNull` over a column name string: `{ $null: 'archivedAt' }` → adds `archivedAt`.
 * - `$in` / `$notIn` / `$between` keyed by column: `{ $in: { id: [1, 2] } }` → adds `id`.
 * - `$and` / `$or` arrays: recurse into each child.
 * - `$not` single child: recurse.
 *
 * Other `$`-prefixed operators are treated as scalars and ignored.
 */
export function extractFilterColumns(filter: unknown, columns: Set<string>): void {
  if (!filter || typeof filter !== 'object') return;
  for (const [k, v] of Object.entries(filter as Record<string, unknown>)) {
    if (k === '$and' || k === '$or') {
      if (Array.isArray(v)) {
        for (const sub of v) extractFilterColumns(sub, columns);
      }
      continue;
    }
    if (k === '$not') {
      extractFilterColumns(v, columns);
      continue;
    }
    if (k === '$null' || k === '$notNull') {
      if (typeof v === 'string') columns.add(v);
      continue;
    }
    if (k === '$in' || k === '$notIn' || k === '$between') {
      if (v && typeof v === 'object') {
        for (const col of Object.keys(v as object)) columns.add(col);
      }
      continue;
    }
    if (!k.startsWith('$')) {
      columns.add(k);
    }
  }
}

/**
 * Collect every column name a query's `filterBy` (and `whereMissing`) chain
 * references. Returns an empty set for queries that don't filter by any
 * column (e.g., `useModel(M).all().watch(...)` on the whole table).
 */
export function filterColumnsOf(plan: QueryPlan): Set<string> {
  const cols = new Set<string>();
  for (const step of plan.steps) {
    if (step.method === 'filterBy' && step.args.length > 0) {
      extractFilterColumns(step.args[0], cols);
    } else if (step.method === 'whereMissing' && typeof step.args[0] === 'string') {
      cols.add(step.args[0] as string);
    }
  }
  return cols;
}
