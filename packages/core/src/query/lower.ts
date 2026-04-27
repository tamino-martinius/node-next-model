import type { Projection, QueryScopedSpec } from '../types.js';
import type { QueryState } from './QueryState.js';

type AnyBuilder = { state: QueryState };

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
  return {
    target: { tableName: state.Model.tableName, keys: state.Model.keys },
    filter: state.filter,
    order: state.order.length > 0 ? state.order : undefined,
    limit: state.limit,
    skip: state.skip,
    selectedFields: state.selectedFields,
    pendingJoins: state.pendingJoins,
    parentScopes: flattenParents(state),
    projection,
  };
}
