import type { Dict } from '@next-model/core';

export function pkKey(keys: Dict<unknown>): string {
  const sorted: Dict<unknown> = {};
  for (const k of Object.keys(keys).sort()) sorted[k] = keys[k];
  return JSON.stringify(sorted);
}

export function rowKey(tableName: string, keys: Dict<unknown>): string {
  return `row:${tableName}:${pkKey(keys)}`;
}
