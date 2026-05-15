import type { AssociationLink, Dict, Filter, JoinClause, KeyType, OrderColumn } from '../types.js';

export type { AssociationLink };

export type TerminalKind = 'first' | 'last' | 'findBy' | 'find' | 'findOrFail' | 'findOrNull';

export interface ParentRef {
  upstream: { state: QueryState; terminalKind?: TerminalKind };
  via: AssociationLink;
}

export interface QueryState {
  Model: { tableName: string; keys: Dict<KeyType> };
  filter?: Filter<any>;
  order: OrderColumn<any>[];
  limit?: number;
  skip?: number;
  selectedFields?: string[];
  selectedIncludes: string[];
  includeStrategy: 'preload' | 'join' | 'auto';
  pendingJoins: JoinClause[];
  havingPredicate?: (count: number) => boolean;
  softDelete: 'active' | 'only' | false;
  nullScoped?: boolean;
  parent?: ParentRef;
  /** Column names whose `defaultScope` clauses are suppressed for this builder. */
  unscopedKeys?: string[];
  /** When true, `defaultScope` is suppressed entirely for this builder. */
  unscopedAll?: boolean;
}

const hasSpecial = (f: Filter<any> | undefined): boolean =>
  !!f && Object.keys(f).some((k) => k.startsWith('$'));

/**
 * Reduce "current scope's filter + new chain-op's filter" into a single
 * filter. Returns `undefined` when both inputs contribute no constraints.
 * AND-wraps when either side has `$`-prefixed special operators or the two
 * sides share a column key; otherwise flat-merges into a single object.
 */
export function mergeFilters(
  current: Filter<any> | undefined,
  next: Filter<any>,
): Filter<any> | undefined {
  if (Object.keys(next).length === 0) return current;
  if (!current) return next;
  if (hasSpecial(current) || hasSpecial(next)) {
    return { $and: [current, next] } as Filter<any>;
  }
  const merged: Dict<any> = { ...(current as Dict<any>) };
  for (const key in next as Dict<any>) {
    if (merged[key] !== undefined) {
      return { $and: [current, next] } as Filter<any>;
    }
    merged[key] = (next as Dict<any>)[key];
  }
  return merged as Filter<any>;
}

export function mergeOrders(
  current: OrderColumn<any>[],
  next: OrderColumn<any>[],
): OrderColumn<any>[] {
  return [...current, ...next];
}
