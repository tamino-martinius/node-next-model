import type {
  Connector,
  Dict,
  Filter,
  ParentScope,
  Projection,
  QueryScopedSpec,
} from '../types.js';
import { mergeFilters } from './QueryState.js';

async function resolveParent(
  connector: Connector,
  scope: ParentScope,
): Promise<unknown[]> {
  const rows = await connector.select(
    {
      tableName: scope.parentTable,
      filter: scope.parentFilter,
      order: scope.parentOrder,
      limit: scope.parentLimit,
    },
    scope.link.parentColumn,
  );
  const seen = new Set<unknown>();
  const values: unknown[] = [];
  for (const row of rows) {
    const v = (row as Dict<any>)[scope.link.parentColumn];
    if (v == null || seen.has(v)) continue;
    seen.add(v);
    values.push(v);
  }
  return values;
}

export async function baseQueryScoped(
  connector: Connector,
  spec: QueryScopedSpec,
): Promise<unknown> {
  let filter = spec.filter;
  for (const parent of spec.parentScopes) {
    const values = await resolveParent(connector, parent);
    const inFilter: Filter<any> = { $in: { [parent.link.childColumn]: values } } as Filter<any>;
    filter = mergeFilters(filter, inFilter);
  }
  const baseScope = {
    tableName: spec.target.tableName,
    filter,
    order: spec.order,
    limit: spec.limit,
    skip: spec.skip,
  };
  const projection: Projection = spec.projection;
  if (projection === 'rows') {
    return connector.query(baseScope);
  }
  if (typeof projection === 'object' && projection.kind === 'pk') {
    const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
    const rows = await connector.select(baseScope, pkName);
    return rows.map((row) => (row as Dict<any>)[pkName]);
  }
  if (typeof projection === 'object' && projection.kind === 'column') {
    const rows = await connector.select(baseScope, projection.column);
    return rows.map((row) => (row as Dict<any>)[projection.column]);
  }
  if (typeof projection === 'object' && projection.kind === 'aggregate') {
    if (projection.op === 'count') {
      return connector.count(baseScope);
    }
    const kind =
      projection.op === 'avg'
        ? 'avg'
        : projection.op === 'sum'
          ? 'sum'
          : projection.op === 'min'
            ? 'min'
            : 'max';
    return connector.aggregate(baseScope, kind, projection.column ?? '');
  }
  throw new Error(`Unknown projection: ${JSON.stringify(projection)}`);
}
