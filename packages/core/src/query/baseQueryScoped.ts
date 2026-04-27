import { PersistenceError } from '../errors.js';
import type {
  AggregateKind,
  Connector,
  Dict,
  Filter,
  ParentScope,
  Projection,
  QueryScopedSpec,
} from '../types.js';
import { mergeFilters } from './QueryState.js';

async function selectColumn(
  connector: Connector,
  scope: { tableName: string; filter?: Filter<any>; order?: ParentScope['parentOrder']; limit?: number },
  column: string,
): Promise<unknown[]> {
  const rows = await connector.select(scope, column);
  const seen = new Set<unknown>();
  const values: unknown[] = [];
  for (const row of rows) {
    const v = (row as Dict<any>)[column];
    if (v == null || seen.has(v)) continue;
    seen.add(v);
    values.push(v);
  }
  return values;
}

function emptyResult(projection: Projection): unknown {
  if (projection === 'rows') return [];
  if (typeof projection === 'object' && projection.kind === 'aggregate') {
    return projection.op === 'count' ? 0 : undefined;
  }
  return [];
}

export async function baseQueryScoped(
  connector: Connector,
  spec: QueryScopedSpec,
): Promise<unknown> {
  // Walk parentScopes outermost-to-innermost. Each scope projects its
  // `link.parentColumn` and constrains the next scope (or the leaf) via
  // that scope's `link.childColumn`. Empty intermediate result short-circuits.
  let prevValues: unknown[] | undefined;
  let prevChildColumn: string | undefined;
  for (const parent of spec.parentScopes) {
    let augmented = parent.parentFilter;
    if (prevValues !== undefined && prevChildColumn !== undefined) {
      const inFilter: Filter<any> = { $in: { [prevChildColumn]: prevValues } } as Filter<any>;
      augmented = mergeFilters(augmented, inFilter);
    }
    const values = await selectColumn(
      connector,
      {
        tableName: parent.parentTable,
        filter: augmented,
        order: parent.parentOrder,
        limit: parent.parentLimit,
      },
      parent.link.parentColumn,
    );
    if (values.length === 0) return emptyResult(spec.projection);
    prevValues = values;
    prevChildColumn = parent.link.childColumn;
  }

  let filter = spec.filter;
  if (prevValues !== undefined && prevChildColumn !== undefined) {
    const inFilter: Filter<any> = { $in: { [prevChildColumn]: prevValues } } as Filter<any>;
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
    if (!projection.column) {
      throw new PersistenceError(
        `Aggregate '${projection.op}' requires a column; received undefined.`,
      );
    }
    return connector.aggregate(baseScope, projection.op as AggregateKind, projection.column);
  }
  throw new PersistenceError(`Unknown projection: ${JSON.stringify(projection)}`);
}
