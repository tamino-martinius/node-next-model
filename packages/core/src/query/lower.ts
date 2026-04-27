import type { Dict, Filter, ParentScope, Projection, QueryScopedSpec } from '../types.js';
import type { QueryState } from './QueryState.js';
import { CollectionQuery } from './CollectionQuery.js';
import { InstanceQuery } from './InstanceQuery.js';
import { ColumnQuery } from './ColumnQuery.js';
import { ScalarQuery } from './ScalarQuery.js';

// Operator keys where the value is directly comparable (scalar operators).
const SCALAR_OPS = new Set(['$gt', '$gte', '$lt', '$lte', '$eq']);
// Operator keys where the value is an array of comparables (set operators).
const SET_OPS = new Set(['$in', '$notIn']);

type AnyBuilder = { state: QueryState };

type SubqueryBuilder = CollectionQuery | InstanceQuery | ColumnQuery<any> | ScalarQuery<any>;

function isSubqueryBuilder(v: unknown): v is SubqueryBuilder {
  return (
    v instanceof CollectionQuery ||
    v instanceof InstanceQuery ||
    v instanceof ColumnQuery ||
    v instanceof ScalarQuery
  );
}

// ---------------------------------------------------------------------------
// Operator-form subquery resolution (Task 31)
//
// After normalizeFilterShape, the filter is in the legacy `{$op: {col: v}}`
// form. For example:
//   Input (pre-normalize):  { total: { $gt: scalarQuery } }
//   Stored in state:        { $gt: { total: scalarQuery } }
//
// The normalized node structure is:
//   { $gt: { columnName: builderOrValue } }
//   { $in: { columnName: builderOrValue } }
//
// This function walks the already-normalized filter tree and, for any column
// value that is a builder inside a scalar/set operator, eagerly resolves it
// (by awaiting the builder) and splices the literal value back in.
//
// Top-level builder values (e.g., { userId: builder }) are NOT touched here —
// those are left for walkFilter / extractSubqueryScopes to handle as parentScopes.
// ---------------------------------------------------------------------------

/**
 * Walk a filter node and resolve any builder values nested inside
 * scalar/set operator objects (e.g., `{ $gt: { total: scalarQuery } }`).
 *
 * Returns a Promise that resolves to `{ value: resolvedNode }` — the outer
 * `{ value }` box prevents JavaScript's automatic PromiseLike unwrapping from
 * materialising top-level builder values that should be left intact for
 * `walkFilter` to handle as parentScopes.
 *
 * @param node  The filter node (already normalized by normalizeFilterShape).
 * @param insideOperator  True when we are processing the COLUMN→VALUE map
 *   that lives directly under a `$gt`/`$in`/etc. key — i.e., the values at
 *   this level are "comparable literals", not sub-filter trees.
 */
async function resolveOperatorBuilders(
  node: unknown,
  insideOperator: boolean,
): Promise<{ value: unknown }> {
  if (node === null || typeof node !== 'object') return { value: node };

  // A builder instance found at a position where a comparable literal is
  // expected → await and splice the resolved literal value.
  if (isSubqueryBuilder(node)) {
    if (insideOperator) {
      // Eagerly materialise: await via .then to avoid re-entrant async issues.
      const resolved: unknown = await new Promise<unknown>((res, rej) => {
        (node as PromiseLike<unknown>).then(res, rej);
      });
      return { value: resolved };
    }
    // Top-level position — leave alone for walkFilter / extractSubqueryScopes.
    // We wrap in { value } to prevent the async engine from auto-unwrapping
    // the PromiseLike CollectionQuery we return.
    return { value: node };
  }

  if (Array.isArray(node)) {
    const results = await Promise.all(
      node.map((item) => resolveOperatorBuilders(item, insideOperator)),
    );
    return { value: results.map((r) => r.value) };
  }

  const obj = node as Record<string, unknown>;
  const out: Dict<unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (SCALAR_OPS.has(key) || SET_OPS.has(key)) {
      // The value under a scalar/set operator is `{ columnName: literal }`.
      // The column values ARE inside an operator context → resolve builders.
      out[key] = (await resolveOperatorBuilders(value, true)).value;
    } else if (key === '$and' || key === '$or') {
      // Array of sub-filters — each child resets to non-operator context.
      const childResults = await Promise.all(
        (value as unknown[]).map((child) => resolveOperatorBuilders(child, false)),
      );
      out[key] = childResults.map((r) => r.value);
    } else if (key === '$not') {
      // Single sub-filter — resets to non-operator context.
      out[key] = (await resolveOperatorBuilders(value, false)).value;
    } else {
      // Plain column key or any other key — pass through with current context.
      out[key] = (await resolveOperatorBuilders(value, insideOperator)).value;
    }
  }
  return { value: out };
}

/**
 * Pre-pass for materialize: resolves any builder values embedded in operator
 * forms (`$gt`, `$lt`, `$gte`, `$lte`, `$eq`, `$in`, `$notIn`) to their
 * literal values before calling `lower()`. Top-level builder values (e.g.,
 * `{ userId: collectionQuery }`) are left intact for `walkFilter`.
 */
export async function resolveSubqueryFilters(
  filter: Filter<any> | undefined,
): Promise<Filter<any> | undefined> {
  if (!filter) return undefined;
  const { value } = await resolveOperatorBuilders(filter, false);
  return value as Filter<any>;
}

function builderToParentScope(childColumn: string, builder: SubqueryBuilder): ParentScope {
  const targetState = builder.state;
  let parentColumn: string;
  if (builder instanceof ColumnQuery) {
    parentColumn = builder.column;
  } else if (builder instanceof ScalarQuery) {
    // ScalarQuery aggregates can't be lowered as IN/= against a column;
    // they need an operator-form path. For now, throw — Task 31 wires aggregates.
    throw new Error(
      'ScalarQuery as a top-level filter value is not yet supported (Task 31). Use { $gt: scalarQuery } operator form.',
    );
  } else {
    parentColumn = Object.keys(targetState.Model.keys)[0] ?? 'id';
  }
  const direction: ParentScope['link']['direction'] =
    builder instanceof InstanceQuery ? 'belongsTo' : 'hasMany';
  const parentLimit =
    builder instanceof InstanceQuery ? targetState.limit ?? 1 : targetState.limit;
  return {
    parentTable: targetState.Model.tableName,
    parentKeys: targetState.Model.keys,
    parentFilter: targetState.filter,
    parentOrder: targetState.order.length > 0 ? targetState.order : undefined,
    parentLimit,
    link: { childColumn, parentColumn, direction },
  };
}

// Recursively walks $and / $or / $not into the filter tree; extracts any
// builder-valued column entry into a ParentScope and removes it from the
// returned cleanFilter. Operator-form builder values (e.g., {$gt: scalar})
// are out of scope here and handled by Task 31.
function walkFilter(node: Filter<any>, scopes: ParentScope[]): Filter<any> {
  const cleaned: Dict<any> = {};
  for (const key of Object.keys(node as Dict<any>)) {
    const value = (node as Dict<any>)[key];
    if (key === '$and' || key === '$or') {
      cleaned[key] = (value as Filter<any>[]).map((child) => walkFilter(child, scopes));
      continue;
    }
    if (key === '$not') {
      cleaned[key] = walkFilter(value as Filter<any>, scopes);
      continue;
    }
    if (key.startsWith('$')) {
      cleaned[key] = value;
      continue;
    }
    if (isSubqueryBuilder(value)) {
      scopes.push(builderToParentScope(key, value));
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned as Filter<any>;
}

function extractSubqueryScopes(
  filter: Filter<any> | undefined,
): { cleanFilter: Filter<any> | undefined; subqueryScopes: ParentScope[] } {
  const subqueryScopes: ParentScope[] = [];
  if (!filter) return { cleanFilter: undefined, subqueryScopes };
  const cleaned = walkFilter(filter, subqueryScopes);
  const cleanFilter =
    Object.keys(cleaned as Dict<any>).length > 0 ? cleaned : undefined;
  return { cleanFilter, subqueryScopes };
}

function flattenParents(state: QueryState): QueryScopedSpec['parentScopes'] {
  const scopes: QueryScopedSpec['parentScopes'] = [];
  let current = state.parent;
  while (current) {
    const upstream = current.upstream.state;
    scopes.unshift({
      parentTable: upstream.Model.tableName,
      parentKeys: upstream.Model.keys,
      parentFilter: upstream.filter,
      parentOrder: upstream.order.length > 0 ? upstream.order : undefined,
      parentLimit: upstream.limit,
      link: current.via,
    });
    current = upstream.parent;
  }
  return scopes;
}

export function lower(builder: AnyBuilder, projection: Projection): QueryScopedSpec {
  const state = builder.state;
  const { cleanFilter, subqueryScopes } = extractSubqueryScopes(state.filter);
  const parentScopes = [...flattenParents(state), ...subqueryScopes];
  return {
    target: { tableName: state.Model.tableName, keys: state.Model.keys },
    filter: cleanFilter,
    order: state.order.length > 0 ? state.order : undefined,
    limit: state.limit,
    skip: state.skip,
    selectedFields: state.selectedFields,
    pendingJoins: state.pendingJoins,
    parentScopes,
    projection,
  };
}
