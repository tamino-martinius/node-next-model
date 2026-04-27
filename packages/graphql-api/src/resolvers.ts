import { KeyType } from '@next-model/core';
import type { GraphQLResolveInfo } from 'graphql';

import { notFound, unauthorized, wrapError } from './errors.js';
import { resolveNames } from './sdl.js';
import type {
  ModelConstructor,
  OperationConfig,
  OperationName,
  OperationOptions,
  ResolverContext,
  ResourceOptions,
} from './types.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizeOperationConfig<C>(
  config: OperationConfig<C> | undefined,
): OperationOptions<C> | null {
  if (config === false) return null;
  if (config === undefined || config === true) return {};
  return config;
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const chosen = limit ?? fallback;
  return Math.min(max, Math.max(1, Math.floor(chosen)));
}

function coerceId(raw: unknown, Model: ModelConstructor): string | number {
  if (typeof raw === 'number') return raw;
  const str = String(raw);
  const keys = Model.keys ?? {};
  const primaryKeyName = Object.keys(keys)[0] ?? 'id';
  if (keys[primaryKeyName] === KeyType.number) {
    const n = Number(str);
    if (Number.isFinite(n)) return n;
  }
  return str;
}

async function defaultSerialize(record: unknown): Promise<unknown> {
  if (record === null || record === undefined) return record;
  if (typeof (record as { toJSON?: () => unknown }).toJSON === 'function') {
    return (record as { toJSON: () => unknown }).toJSON();
  }
  const attrs = (record as { attributes?: unknown }).attributes;
  if (attrs && typeof attrs === 'object') {
    return attrs;
  }
  return record;
}

export function buildResolvers<C>(opts: ResourceOptions<C>) {
  const names = resolveNames(opts as ResourceOptions<unknown>);
  const operations = new Map<OperationName, OperationOptions<C>>();
  const explicit = opts.operations;
  const defaultOps: OperationName[] = ['list', 'get', 'count', 'create', 'update', 'delete'];
  for (const op of defaultOps) {
    const normalized = normalizeOperationConfig<C>(explicit?.[op]);
    if (normalized) operations.set(op, normalized);
  }

  const idField = opts.idField ?? 'id';
  const maxLimit = opts.maxLimit ?? MAX_LIMIT;
  const defaultLimit = opts.defaultLimit ?? DEFAULT_LIMIT;
  const serialize = opts.serialize ?? defaultSerialize;
  const Model = opts.Model;

  async function runGuards(
    operation: OperationName,
    opOpts: OperationOptions<C>,
    ctx: ResolverContext<C>,
  ) {
    if (opts.authorize && !(await opts.authorize(ctx))) {
      throw unauthorized(`${operation} denied`);
    }
    if (opOpts.authorize && !(await opOpts.authorize(ctx))) {
      throw unauthorized(`${operation} denied`);
    }
  }

  async function serializeMany(rows: unknown[], ctx: ResolverContext<C>): Promise<unknown[]> {
    const out = new Array(rows.length);
    for (let i = 0; i < rows.length; i += 1) out[i] = await serialize(rows[i], ctx);
    return out;
  }

  function buildScope(args: Record<string, unknown>) {
    let scope: any = Model;
    if (args.filter && typeof args.filter === 'object') {
      const filter = args.filter as Record<string, unknown>;
      const cleanEntries = Object.entries(filter).filter(([, v]) => v !== undefined && v !== null);
      if (cleanEntries.length > 0) {
        scope = scope.filterBy(Object.fromEntries(cleanEntries));
      }
    }
    if (Array.isArray(args.order) && args.order.length > 0) {
      const orderColumns = (args.order as Array<{ key: string; dir?: string }>).map((col) => ({
        key: col.key,
        dir: col.dir === 'DESC' ? -1 : 1,
      }));
      scope = scope.orderBy(orderColumns);
    }
    return scope;
  }

  const resolvers: Record<string, Record<string, (...args: any[]) => any>> = {
    Query: {},
    Mutation: {},
  };

  if (operations.has('list')) {
    const opOpts = operations.get('list') ?? {};
    resolvers.Query[names.queryList] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'list', Model, args };
      try {
        await runGuards('list', opOpts, ctx);
        const scope = buildScope(args);
        const cursorMode = 'after' in args || 'before' in args;
        if (cursorMode) {
          const limit = clampLimit(
            (args.limit as number | undefined) ?? (args.perPage as number | undefined),
            defaultLimit,
            maxLimit,
          );
          const after =
            typeof args.after === 'string' && args.after !== '' ? args.after : undefined;
          const before =
            typeof args.before === 'string' && args.before !== '' ? args.before : undefined;
          const page = await scope.paginateCursor({ after, before, limit });
          return {
            items: await serializeMany(page.items, ctx),
            meta: {
              hasMore: page.hasMore,
              nextCursor: page.nextCursor ?? null,
              prevCursor: page.prevCursor ?? null,
              total: null,
              page: null,
              perPage: null,
              totalPages: null,
              hasNext: null,
              hasPrev: null,
            },
          };
        }
        if (args.page !== undefined || args.perPage !== undefined) {
          const perPage = clampLimit(args.perPage as number | undefined, defaultLimit, maxLimit);
          const result = await scope.paginate((args.page as number | undefined) ?? 1, perPage);
          return {
            items: await serializeMany(result.items, ctx),
            meta: {
              total: result.total,
              page: result.page,
              perPage: result.perPage,
              totalPages: result.totalPages,
              hasNext: result.hasNext,
              hasPrev: result.hasPrev,
              hasMore: null,
              nextCursor: null,
              prevCursor: null,
            },
          };
        }
        const limit = clampLimit(args.limit as number | undefined, defaultLimit, maxLimit);
        const withLimit = scope.limitBy(limit);
        const withSkip =
          typeof args.skip === 'number' ? withLimit.skipBy(Math.max(0, args.skip)) : withLimit;
        const items = await withSkip.all();
        return {
          items: await serializeMany(items, ctx),
          meta: {
            total: null,
            page: null,
            perPage: null,
            totalPages: null,
            hasNext: null,
            hasPrev: null,
            hasMore: null,
            nextCursor: null,
            prevCursor: null,
          },
        };
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  if (operations.has('get')) {
    const opOpts = operations.get('get') ?? {};
    resolvers.Query[names.queryGet] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'get', Model, args };
      try {
        await runGuards('get', opOpts, ctx);
        const id = coerceId(args[idField], Model);
        const record = await (Model as any).findBy({ [idField]: id });
        if (!record) return null;
        return await serialize(record, ctx);
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  if (operations.has('count')) {
    const opOpts = operations.get('count') ?? {};
    resolvers.Query[names.queryCount] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'count', Model, args };
      try {
        await runGuards('count', opOpts, ctx);
        return await buildScope(args).count();
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  if (operations.has('create')) {
    const opOpts = operations.get('create') ?? {};
    resolvers.Mutation[names.mutationCreate] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'create', Model, args };
      try {
        await runGuards('create', opOpts, ctx);
        const created = await (Model as any).create(args.input ?? {});
        return await serialize(created, ctx);
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  if (operations.has('update')) {
    const opOpts = operations.get('update') ?? {};
    resolvers.Mutation[names.mutationUpdate] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'update', Model, args };
      try {
        await runGuards('update', opOpts, ctx);
        const id = coerceId(args[idField], Model);
        const record = await (Model as any).find(id);
        if (!record) throw notFound(`${opts.name} ${String(args[idField])} not found`);
        await record.update(args.input ?? {});
        return await serialize(record, ctx);
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  if (operations.has('delete')) {
    const opOpts = operations.get('delete') ?? {};
    resolvers.Mutation[names.mutationDelete] = async (
      _src: unknown,
      args: Record<string, unknown>,
      context: C,
      info: GraphQLResolveInfo,
    ) => {
      const ctx: ResolverContext<C> = { context, info, operation: 'delete', Model, args };
      try {
        await runGuards('delete', opOpts, ctx);
        const id = coerceId(args[idField], Model);
        const record = await (Model as any).find(id);
        if (!record) throw notFound(`${opts.name} ${String(args[idField])} not found`);
        await record.delete();
        return true;
      } catch (err) {
        throw wrapError(err);
      }
    };
  }

  return { resolvers, names, operations };
}
