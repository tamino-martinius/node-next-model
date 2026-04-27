import type {
  Dict,
  Filter,
  JoinClause,
  KeyType,
  OrderColumn,
} from '../types.js';

export type AssociationLink = {
  childColumn: string;
  parentColumn: string;
  direction: 'belongsTo' | 'hasOne' | 'hasMany';
};

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
  parent?: { upstream: { state: QueryState; terminalKind?: string }; via: AssociationLink };
}

const hasSpecial = (f: Filter<any> | undefined): boolean =>
  !!f && Object.keys(f).some((k) => k.startsWith('$'));

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
