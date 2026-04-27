import type { Dict, Filter, ParentScope, Projection, QueryScopedSpec } from '../types.js';
import type { QueryState } from './QueryState.js';
import { CollectionQuery } from './CollectionQuery.js';
import { InstanceQuery } from './InstanceQuery.js';
import { ColumnQuery } from './ColumnQuery.js';
import { ScalarQuery } from './ScalarQuery.js';

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
