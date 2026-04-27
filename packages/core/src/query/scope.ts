import type { Connector, Dict, Filter } from '../types.js';
import { mergeFilters, type QueryState } from './QueryState.js';
import type { ParentScope } from '../types.js';

/**
 * Compute the connector-facing `Scope` for a chained read WITHOUT folding
 * `pendingJoins` into the filter — mirrors `Model.modelScopeBase()`. The fast
 * path (`Connector.queryWithJoins`) consumes this base scope and the
 * `pendingJoins` array separately.
 */
export function builderScopeBase(model: any, state: QueryState) {
  let filter = state.filter;
  const softColumn = (model.softDeleteColumn as string | undefined) ?? 'discardedAt';
  if (state.softDelete === 'active') {
    filter = filter
      ? ({ $and: [{ $null: softColumn }, filter] } as Filter<any>)
      : ({ $null: softColumn } as Filter<any>);
  } else if (state.softDelete === 'only') {
    filter = filter
      ? ({ $and: [{ $notNull: softColumn }, filter] } as Filter<any>)
      : ({ $notNull: softColumn } as Filter<any>);
  }
  if (model.inheritColumn && model.inheritType !== undefined) {
    const typeFilter = { [model.inheritColumn]: model.inheritType } as Filter<any>;
    filter = filter
      ? ({ $and: [typeFilter, filter] } as Filter<any>)
      : typeFilter;
  }
  return {
    tableName: model.tableName as string,
    filter,
    limit: state.limit,
    skip: state.skip,
    order: state.order,
  };
}

/**
 * Resolve the chained scope's `pendingJoins` into concrete `$in` / `$notIn`
 * filters by issuing each child query upfront. Mirrors `Model.modelScope()`.
 * Connectors that implement `queryWithJoins` skip this via the fast path; the
 * aggregate / scalar paths always go through this resolution because they
 * project a non-row column out of the leaf table.
 */
export async function resolvePendingJoinsToScope(
  model: any,
  state: QueryState,
): Promise<ReturnType<typeof builderScopeBase>> {
  const base = builderScopeBase(model, state);
  if (state.pendingJoins.length === 0) return base;
  const joinFilters: Filter<any>[] = [];
  const fallbackConnector = model.connector as Connector;
  for (const join of state.pendingJoins) {
    if (join.mode !== 'select' && join.mode !== 'antiJoin') continue;
    const targetModel = join.target as any;
    const childConnector = (targetModel?.connector as Connector | undefined) ?? fallbackConnector;
    const rows = await childConnector.select(
      { tableName: join.childTableName, filter: join.filter },
      join.on.childColumn,
    );
    const seen = new Set<unknown>();
    const values: unknown[] = [];
    for (const row of rows) {
      const v = (row as Dict<any>)[join.on.childColumn];
      if (v == null || seen.has(v)) continue;
      seen.add(v);
      values.push(v);
    }
    const op = join.mode === 'antiJoin' ? '$notIn' : '$in';
    joinFilters.push({ [op]: { [join.on.parentColumn]: values } } as Filter<any>);
  }
  if (joinFilters.length === 0) return base;
  const combined: Filter<any> =
    joinFilters.length === 1
      ? (joinFilters[0] as Filter<any>)
      : ({ $and: joinFilters } as Filter<any>);
  const merged: Filter<any> = base.filter
    ? ({ $and: [base.filter, combined] } as Filter<any>)
    : combined;
  return { ...base, filter: merged };
}

/**
 * Resolve top-level subquery `parentScopes` (CollectionQuery / InstanceQuery
 * values embedded as filter values, plus the upstream `state.parent` chain)
 * into a single `$in` / `$and` filter fragment that the connector path can
 * consume directly. Mirrors the nested loop in `baseQueryScoped` that walks
 * parentScopes outermost-first.
 */
export async function resolveParentScopesToFilter(
  connector: Connector,
  parentScopes: ParentScope[],
): Promise<Filter<any>> {
  const fragments: Filter<any>[] = [];
  let prevValues: unknown[] | undefined;
  let prevChildColumn: string | undefined;
  for (const parent of parentScopes) {
    let augmented: Filter<any> | undefined = parent.parentFilter;
    if (prevValues !== undefined && prevChildColumn !== undefined) {
      const inFilter: Filter<any> = { $in: { [prevChildColumn]: prevValues } } as Filter<any>;
      augmented = mergeFilters(augmented, inFilter);
    }
    const rows = await connector.select(
      {
        tableName: parent.parentTable,
        filter: augmented,
        order: parent.parentOrder,
        limit: parent.parentLimit,
      },
      parent.link.parentColumn,
    );
    const seen = new Set<unknown>();
    const values: unknown[] = [];
    for (const row of rows) {
      const v = (row as Dict<any>)[parent.link.parentColumn];
      if (v == null || seen.has(v)) continue;
      seen.add(v);
      values.push(v);
    }
    if (values.length === 0) {
      // Empty intermediate → final result is empty. Encode as `$in: []` so
      // the outer query short-circuits to no matches.
      fragments.push({ $in: { [parent.link.childColumn]: [] } } as Filter<any>);
      prevValues = undefined;
      prevChildColumn = undefined;
      continue;
    }
    prevValues = values;
    prevChildColumn = parent.link.childColumn;
  }
  if (prevValues !== undefined && prevChildColumn !== undefined) {
    fragments.push({ $in: { [prevChildColumn]: prevValues } } as Filter<any>);
  }
  return fragments.length === 1 ? fragments[0]! : ({ $and: fragments } as Filter<any>);
}

/** AND-merge two filter fragments — undefined-safe. */
export function mergeFiltersForLegacy(
  current: Filter<any> | undefined,
  next: Filter<any>,
): Filter<any> {
  if (!current) return next;
  return { $and: [current, next] } as Filter<any>;
}
