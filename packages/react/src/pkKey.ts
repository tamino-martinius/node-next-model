import type { Dict } from '@next-model/core';

export function pkKey(keys: Dict<unknown>): string {
  const sorted: Dict<unknown> = {};
  for (const k of Object.keys(keys).sort()) sorted[k] = keys[k];
  return JSON.stringify(sorted);
}

export function rowKey(tableName: string, keys: Dict<unknown>): string {
  return `row:${tableName}:${pkKey(keys)}`;
}

/**
 * Key published when a mutation changes the value of `columnName` on any
 * row of `tableName`. Collection watches whose `filterBy` predicate names
 * this column subscribe to it so the watch refetches when membership may
 * have flipped (a row matching the filter now no longer matches, or vice
 * versa).
 */
export function columnKey(tableName: string, columnName: string): string {
  return `col:${tableName}:${columnName}`;
}
