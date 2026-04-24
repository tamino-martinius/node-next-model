import { KeyType, NotFoundError } from '@next-model/core';
import { type NextFunction, type Request, type Response, Router } from 'express';

import { bodyFor, httpStatusFor, UnauthorizedError } from './errors.js';
import { clampLimit, parseListQuery } from './query.js';
import {
  type ActionConfig,
  type ActionContext,
  type ActionName,
  type ActionOptions,
  DEFAULT_ACTIONS,
  type ModelConstructor,
  type RouterOptions,
} from './types.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizeActionConfig<M extends ModelConstructor>(
  config: ActionConfig<M> | undefined,
): ActionOptions<M> | null {
  if (config === false) return null;
  if (config === undefined || config === true) return {};
  return config;
}

function resolveActions<M extends ModelConstructor>(
  options: RouterOptions<M>,
): Map<ActionName, ActionOptions<M>> {
  const resolved = new Map<ActionName, ActionOptions<M>>();
  const explicit = options.actions;
  for (const name of DEFAULT_ACTIONS) {
    const config = explicit ? explicit[name] : undefined;
    const normalized = normalizeActionConfig<M>(config);
    if (normalized) resolved.set(name, normalized);
  }
  return resolved;
}

async function defaultSerialize(record: unknown): Promise<unknown> {
  if (record === null || record === undefined) return record;
  if (typeof (record as { toJSON?: () => unknown }).toJSON === 'function') {
    return (record as { toJSON: () => unknown }).toJSON();
  }
  if (typeof (record as { attributes?: () => unknown }).attributes === 'function') {
    return (record as { attributes: () => unknown }).attributes();
  }
  return record;
}

interface EnvelopeArgs {
  data: unknown;
  meta?: Record<string, unknown>;
}

function defaultEnvelope({ data, meta }: EnvelopeArgs): unknown {
  if (meta === undefined) return data;
  return { data, meta };
}

export function createRestRouter<M extends ModelConstructor>(
  Model: M,
  options: RouterOptions<M> = {},
): Router {
  const enabledActions = resolveActions(options);
  const idParam = options.idParam ?? 'id';
  const primaryKeyName = Object.keys(Model.keys ?? {})[0] ?? 'id';
  const primaryKeyType = Model.keys?.[primaryKeyName];
  const coerceId = (raw: string): string | number => {
    if (primaryKeyType === KeyType.number) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    return raw;
  };
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const serialize =
    options.serialize ?? (defaultSerialize as NonNullable<RouterOptions<M>['serialize']>);
  const envelope = options.envelope;
  const globalAuthorize = options.authorize;

  async function serializeMany(records: InstanceType<M>[], ctx: ActionContext<M>) {
    const serialized: unknown[] = new Array(records.length);
    for (let i = 0; i < records.length; i += 1) {
      serialized[i] = await serialize(records[i] as InstanceType<M>, ctx);
    }
    return serialized;
  }

  async function send(
    ctx: ActionContext<M>,
    data: unknown,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const body = envelope
      ? await envelope({ action: ctx.action, data, meta }, ctx)
      : defaultEnvelope({ data, meta });
    ctx.res.json(body);
  }

  async function runGuards(ctx: ActionContext<M>, config: ActionOptions<M>): Promise<void> {
    if (globalAuthorize) {
      const allowed = await globalAuthorize(ctx);
      if (!allowed) throw new UnauthorizedError('unauthorized');
    }
    if (config.authorize) {
      const allowed = await config.authorize(ctx);
      if (!allowed) throw new UnauthorizedError('unauthorized');
    }
    if (config.before) await config.before(ctx);
  }

  function wrap(action: ActionName, config: ActionOptions<M>, member: boolean) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ctx: ActionContext<M> = { action, req, res, Model };
      try {
        if (member) {
          const raw = req.params[idParam];
          if (raw === undefined || Array.isArray(raw)) {
            throw new NotFoundError(`missing ${idParam} path param`);
          }
          ctx.record = (await Model.find(coerceId(raw))) as InstanceType<M>;
        }
        await runGuards(ctx, config);
        await dispatch(ctx);
      } catch (err) {
        next(err);
      }
    };
  }

  async function dispatch(ctx: ActionContext<M>): Promise<void> {
    switch (ctx.action) {
      case 'index':
        return runIndex(ctx);
      case 'show':
        return runShow(ctx);
      case 'create':
        return runCreate(ctx);
      case 'update':
        return runUpdate(ctx);
      case 'delete':
        return runDelete(ctx);
      case 'count':
        return runCount(ctx);
      case 'first':
        return runSingleton(ctx, 'first');
      case 'last':
        return runSingleton(ctx, 'last');
    }
  }

  async function buildScope(ctx: ActionContext<M>) {
    const query = parseListQuery(ctx.req.query as Record<string, unknown>);
    let scope: any = Model;
    if (query.filter) scope = scope.filterBy(query.filter);
    if (query.order) scope = scope.orderBy(query.order);
    return { scope, query };
  }

  async function runIndex(ctx: ActionContext<M>): Promise<void> {
    const { scope, query } = await buildScope(ctx);
    const rawQuery = ctx.req.query as Record<string, unknown>;
    const cursorRequested = 'after' in rawQuery || 'before' in rawQuery;
    if (cursorRequested) {
      const limit = clampLimit(query.limit ?? query.perPage, defaultLimit, maxLimit);
      const page = await scope.paginateCursor({
        after: query.after,
        before: query.before,
        limit,
      });
      const items = await serializeMany(page.items, ctx);
      await send(ctx, items, {
        nextCursor: page.nextCursor,
        prevCursor: page.prevCursor,
        hasMore: page.hasMore,
      });
      return;
    }
    if (query.page !== undefined || query.perPage !== undefined) {
      const perPage = clampLimit(query.perPage, defaultLimit, maxLimit);
      const result = await scope.paginate(query.page ?? 1, perPage);
      const items = await serializeMany(result.items, ctx);
      await send(ctx, items, {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      });
      return;
    }
    const limit = clampLimit(query.limit, defaultLimit, maxLimit);
    const withLimit = scope.limitBy(limit);
    const withSkip = query.skip ? withLimit.skipBy(query.skip) : withLimit;
    const items = await withSkip.all();
    const serialized = await serializeMany(items, ctx);
    await send(ctx, serialized);
  }

  async function runShow(ctx: ActionContext<M>): Promise<void> {
    if (!ctx.record) throw new NotFoundError(`${Model.name} not found`);
    const payload = await serialize(ctx.record, ctx);
    await send(ctx, payload);
  }

  async function runCreate(ctx: ActionContext<M>): Promise<void> {
    const body = ctx.req.body ?? {};
    const created = (await Model.create(body)) as InstanceType<M>;
    ctx.record = created;
    const payload = await serialize(created, ctx);
    ctx.res.status(201);
    await send(ctx, payload);
  }

  async function runUpdate(ctx: ActionContext<M>): Promise<void> {
    if (!ctx.record) throw new NotFoundError(`${Model.name} not found`);
    const body = ctx.req.body ?? {};
    await (ctx.record as unknown as { update: (attrs: unknown) => Promise<unknown> }).update(body);
    const payload = await serialize(ctx.record, ctx);
    await send(ctx, payload);
  }

  async function runDelete(ctx: ActionContext<M>): Promise<void> {
    if (!ctx.record) throw new NotFoundError(`${Model.name} not found`);
    await (ctx.record as unknown as { delete: () => Promise<unknown> }).delete();
    ctx.res.status(204).end();
  }

  async function runCount(ctx: ActionContext<M>): Promise<void> {
    const { scope } = await buildScope(ctx);
    const count = await scope.count();
    await send(ctx, { count });
  }

  async function runSingleton(ctx: ActionContext<M>, which: 'first' | 'last'): Promise<void> {
    const { scope } = await buildScope(ctx);
    const record = which === 'first' ? await scope.first() : await scope.last();
    if (!record) {
      await send(ctx, null);
      return;
    }
    const payload = await serialize(record, ctx);
    await send(ctx, payload);
  }

  const router = Router();

  const collectionActions: { action: ActionName; method: 'get' | 'post'; path: string }[] = [
    { action: 'index', method: 'get', path: '/' },
    { action: 'count', method: 'get', path: '/count' },
    { action: 'first', method: 'get', path: '/first' },
    { action: 'last', method: 'get', path: '/last' },
    { action: 'create', method: 'post', path: '/' },
  ];
  for (const { action, method, path } of collectionActions) {
    const config = enabledActions.get(action);
    if (!config) continue;
    router[method](path, wrap(action, config, false));
  }

  const memberActions: { action: ActionName; method: 'get' | 'patch' | 'delete' }[] = [
    { action: 'show', method: 'get' },
    { action: 'update', method: 'patch' },
    { action: 'delete', method: 'delete' },
  ];
  for (const { action, method } of memberActions) {
    const config = enabledActions.get(action);
    if (!config) continue;
    router[method](`/:${idParam}`, wrap(action, config, true));
  }

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    const status = httpStatusFor(err);
    res.status(status).json(bodyFor(err));
  });

  return router;
}
