import type { ModelClass } from '@next-model/core';
import type { GraphQLResolveInfo } from 'graphql';

export type ModelConstructor = typeof ModelClass;

export type OperationName = 'list' | 'get' | 'count' | 'create' | 'update' | 'delete';

export const DEFAULT_OPERATIONS: readonly OperationName[] = Object.freeze([
  'list',
  'get',
  'count',
  'create',
  'update',
  'delete',
]);

/**
 * Per-field configuration. `type` is the GraphQL output type in SDL syntax
 * (e.g. `'Int!'`, `'String'`, `'[Tag!]'`). By default every field is exposed
 * in the `Create` + `Update` inputs and as a filter key — `input` / `filter`
 * let you opt out.
 */
export interface FieldDef {
  /** GraphQL output SDL type, e.g. `'String!'`, `'Int'`. */
  type: string;
  /** Omit from both inputs with `false`; pass `'create'` / `'update'` to restrict. */
  input?: boolean | 'create' | 'update';
  /** Omit from the filter input with `false`. */
  filter?: boolean;
}

export interface ResolverContext<C = unknown> {
  context: C;
  info: GraphQLResolveInfo;
  operation: OperationName;
  /** The Model class being queried. */
  Model: ModelConstructor;
  /** Arguments supplied by the client. */
  args: Record<string, unknown>;
}

export type Authorize<C = unknown> = (ctx: ResolverContext<C>) => boolean | Promise<boolean>;

export type SerializeRow<C = unknown> = (
  row: unknown,
  ctx: ResolverContext<C>,
) => unknown | Promise<unknown>;

export interface OperationOptions<C = unknown> {
  authorize?: Authorize<C>;
}

export type OperationConfig<C = unknown> = boolean | OperationOptions<C>;

export interface ResourceOptions<C = unknown> {
  Model: ModelConstructor;
  /** Singular PascalCase name — `User`. */
  name: string;
  /** Plural name used for list + create mutations. Defaults to `${name}s`. */
  pluralName?: string;
  /** Primary key field name. Defaults to `id`. */
  idField?: string;
  /** SDL type for the primary key — defaults to `ID!`. */
  idType?: string;
  fields: Record<string, FieldDef>;
  authorize?: Authorize<C>;
  operations?: Partial<Record<OperationName, OperationConfig<C>>>;
  serialize?: SerializeRow<C>;
  /** Cap on how many items a `list` query can return. Defaults to 100. */
  maxLimit?: number;
  /** Default items per page when the client omits `limit` / `perPage`. Defaults to 25. */
  defaultLimit?: number;
}

export interface Resource<C = unknown> {
  typeDefs: string;
  resolvers: Record<string, Record<string, (...args: unknown[]) => unknown>>;
  resource: ResourceOptions<C>;
}
