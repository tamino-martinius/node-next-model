import type { Dict } from '@next-model/core';

export interface PostgrestResult<T = Dict<any>> {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}

export interface PostgrestBuilderLike extends PromiseLike<PostgrestResult> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): this;
  insert(values: Dict<any> | Dict<any>[]): this;
  update(values: Dict<any>): this;
  delete(): this;
  upsert(values: Dict<any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this;
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  like(column: string, pattern: string): this;
  ilike(column: string, pattern: string): this;
  in(column: string, values: unknown[]): this;
  is(column: string, value: null): this;
  or(filters: string): this;
  not(column: string, operator: string, value: unknown): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
  range(from: number, to: number): this;
}

export interface SupabaseClientLike {
  from(table: string): PostgrestBuilderLike;
}

/** Config accepted by `SupabaseConnector` when it should build its own client. */
export interface SupabaseCredentials {
  url: string;
  key: string;
  options?: Record<string, unknown>;
}
