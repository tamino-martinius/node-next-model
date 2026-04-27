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

function extractSubqueryScopes(
  filter: Filter<any> | undefined,
): { cleanFilter: Filter<any> | undefined; subqueryScopes: ParentScope[] } {
  const subqueryScopes: ParentScope[] = [];
  if (!filter) return { cleanFilter: undefined, subqueryScopes };
  const cleanFilter: Dict<any> = {};
  for (const key in filter as Dict<any>) {
    const value = (filter as Dict<any>)[key];
    if (isSubqueryBuilder(value)) {
      const builder = value as SubqueryBuilder;
      const targetState = builder.state;
      let parentColumn: string;
      if (builder instanceof ColumnQuery) {
        parentColumn = builder.column;
      } else if (builder instanceof ScalarQuery) {
        // ScalarQuery aggregates can't be lowered as IN/= against a column;
        // they need a different operator path. For now, throw — Task 31 wires aggregates.
        throw new Error(
          'ScalarQuery as a top-level filter value is not yet supported (Task 31). Use { $gt: scalarQuery } operator form.',
        );
      } else {
        // CollectionQuery or InstanceQuery — use target's pk
        parentColumn = Object.keys(targetState.Model.keys)[0] ?? 'id';
      }
      const direction: ParentScope['link']['direction'] =
        builder instanceof InstanceQuery ? 'belongsTo' : 'hasMany';
      const parentLimit =
        builder instanceof InstanceQuery ? targetState.limit ?? 1 : targetState.limit;
      subqueryScopes.push({
        parentTable: targetState.Model.tableName,
        parentKeys: targetState.Model.keys,
        parentFilter: targetState.filter,
        parentOrder: targetState.order.length > 0 ? targetState.order : undefined,
        parentLimit,
        link: { childColumn: key, parentColumn, direction },
      });
    } else {
      cleanFilter[key] = value;
    }
  }
  const cleaned = Object.keys(cleanFilter).length > 0 ? (cleanFilter as Filter<any>) : undefined;
  return { cleanFilter: cleaned, subqueryScopes };
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
