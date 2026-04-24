import { KeyType, NotFoundError } from '@next-model/core';

import { errorResponse, UnauthorizedError } from './errors.js';
import { clampLimit, parseListQuery } from './query.js';
import {
  type ActionConfig,
  type ActionContext,
  type ActionName,
  type ActionOptions,
  type CollectionAction,
  DEFAULT_COLLECTION_ACTIONS,
  DEFAULT_MEMBER_ACTIONS,
  type MemberAction,
  type MemberRouteContext,
  type ModelConstructor,
  type RouteParams,
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

function enabledActions<M extends ModelConstructor>(
  options: RouterOptions<M>,
  names: readonly ActionName[],
): Map<ActionName, ActionOptions<M>> {
  const resolved = new Map<ActionName, ActionOptions<M>>();
  const explicit = options.actions;
  for (const name of names) {
    const normalized = normalizeActionConfig<M>(explicit ? explicit[name] : undefined);
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

function defaultEnvelope(data: unknown, meta?: Record<string, unknown>): unknown {
  if (meta === undefined) return data;
  return { data, meta };
}

async function resolveParams(
  params: RouteParams | Promise<RouteParams> | undefined,
): Promise<RouteParams> {
  if (!params) return {};
  return (await params) as RouteParams;
}

function coerceId(raw: string, Model: ModelConstructor): string | number {
  const keys = Model.keys ?? {};
  const primaryKeyName = Object.keys(keys)[0] ?? 'id';
  if (keys[primaryKeyName] === KeyType.number) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  const text = await req.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch (_err) {
    // swallow — runAction turns this into a 400 via runGuards' error path
  }
  return {};
}

interface HandlerSpec<M extends ModelConstructor> {
  Model: M;
  options: RouterOptions<M>;
}

function makeContext<M extends ModelConstructor>(
  Model: M,
  action: ActionName,
  req: Request,
  params: RouteParams,
): ActionContext<M> {
  return { action, req, Model, params };
}

async function runGuards<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
  config: ActionOptions<M>,
): Promise<void> {
  const { authorize: globalAuthorize } = spec.options;
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

async function serializeMany<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  records: InstanceType<M>[],
  ctx: ActionContext<M>,
): Promise<unknown[]> {
  const serialize =
    spec.options.serialize ?? (defaultSerialize as NonNullable<typeof spec.options.serialize>);
  const out: unknown[] = new Array(records.length);
  for (let i = 0; i < records.length; i += 1) {
    out[i] = await serialize(records[i] as InstanceType<M>, ctx);
  }
  return out;
}

async function send<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
  data: unknown,
  meta: Record<string, unknown> | undefined,
  status = 200,
): Promise<Response> {
  const envelope = spec.options.envelope;
  const body = envelope
    ? await envelope({ action: ctx.action, data, meta }, ctx)
    : defaultEnvelope(data, meta);
  return Response.json(body, { status });
}

async function runIndex<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  const url = new URL(ctx.req.url);
  const query = parseListQuery(url);
  const maxLimit = spec.options.maxLimit ?? MAX_LIMIT;
  const defaultLimit = spec.options.defaultLimit ?? DEFAULT_LIMIT;
  let scope: any = spec.Model;
  if (query.filter) scope = scope.filterBy(query.filter);
  if (query.order) scope = scope.orderBy(query.order);
  if (query.cursorRequested) {
    const limit = clampLimit(query.limit ?? query.perPage, defaultLimit, maxLimit);
    const after = query.after === '' ? undefined : query.after;
    const before = query.before === '' ? undefined : query.before;
    const page = await scope.paginateCursor({ after, before, limit });
    const items = await serializeMany(spec, page.items, ctx);
    return send(spec, ctx, items, {
      nextCursor: page.nextCursor,
      prevCursor: page.prevCursor,
      hasMore: page.hasMore,
    });
  }
  if (query.page !== undefined || query.perPage !== undefined) {
    const perPage = clampLimit(query.perPage, defaultLimit, maxLimit);
    const result = await scope.paginate(query.page ?? 1, perPage);
    const items = await serializeMany(spec, result.items, ctx);
    return send(spec, ctx, items, {
      page: result.page,
      perPage: result.perPage,
      total: result.total,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
    });
  }
  const limit = clampLimit(query.limit, defaultLimit, maxLimit);
  const withLimit = scope.limitBy(limit);
  const withSkip = query.skip ? withLimit.skipBy(query.skip) : withLimit;
  const items = await withSkip.all();
  const serialized = await serializeMany(spec, items, ctx);
  return send(spec, ctx, serialized, undefined);
}

async function runCount<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  const url = new URL(ctx.req.url);
  const query = parseListQuery(url);
  let scope: any = spec.Model;
  if (query.filter) scope = scope.filterBy(query.filter);
  const count = await scope.count();
  return send(spec, ctx, { count }, undefined);
}

async function runSingleton<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
  which: 'first' | 'last',
): Promise<Response> {
  const url = new URL(ctx.req.url);
  const query = parseListQuery(url);
  let scope: any = spec.Model;
  if (query.filter) scope = scope.filterBy(query.filter);
  if (query.order) scope = scope.orderBy(query.order);
  const record = which === 'first' ? await scope.first() : await scope.last();
  if (!record) return send(spec, ctx, null, undefined);
  const serialize =
    spec.options.serialize ?? (defaultSerialize as NonNullable<typeof spec.options.serialize>);
  const payload = await serialize(record, ctx);
  return send(spec, ctx, payload, undefined);
}

async function runCreate<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  const body = await readJsonBody(ctx.req);
  const created = (await (spec.Model as any).create(body)) as InstanceType<M>;
  ctx.record = created;
  const serialize =
    spec.options.serialize ?? (defaultSerialize as NonNullable<typeof spec.options.serialize>);
  const payload = await serialize(created, ctx);
  return send(spec, ctx, payload, undefined, 201);
}

async function runShow<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  if (!ctx.record) throw new NotFoundError(`${spec.Model.name} not found`);
  const serialize =
    spec.options.serialize ?? (defaultSerialize as NonNullable<typeof spec.options.serialize>);
  const payload = await serialize(ctx.record, ctx);
  return send(spec, ctx, payload, undefined);
}

async function runUpdate<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  if (!ctx.record) throw new NotFoundError(`${spec.Model.name} not found`);
  const body = await readJsonBody(ctx.req);
  await (ctx.record as unknown as { update: (attrs: unknown) => Promise<unknown> }).update(body);
  const serialize =
    spec.options.serialize ?? (defaultSerialize as NonNullable<typeof spec.options.serialize>);
  const payload = await serialize(ctx.record, ctx);
  return send(spec, ctx, payload, undefined);
}

async function runDelete<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  ctx: ActionContext<M>,
): Promise<Response> {
  if (!ctx.record) throw new NotFoundError(`${spec.Model.name} not found`);
  await (ctx.record as unknown as { delete: () => Promise<unknown> }).delete();
  return new Response(null, { status: 204 });
}

async function dispatchCollection<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  action: CollectionAction,
  ctx: ActionContext<M>,
): Promise<Response> {
  switch (action) {
    case 'index':
      return runIndex(spec, ctx);
    case 'count':
      return runCount(spec, ctx);
    case 'first':
      return runSingleton(spec, ctx, 'first');
    case 'last':
      return runSingleton(spec, ctx, 'last');
    case 'create':
      return runCreate(spec, ctx);
  }
}

async function dispatchMember<M extends ModelConstructor>(
  spec: HandlerSpec<M>,
  action: MemberAction,
  ctx: ActionContext<M>,
): Promise<Response> {
  switch (action) {
    case 'show':
      return runShow(spec, ctx);
    case 'update':
      return runUpdate(spec, ctx);
    case 'delete':
      return runDelete(spec, ctx);
  }
}

function resolveCollectionAction(req: Request): CollectionAction | null {
  const url = new URL(req.url);
  const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (last === 'count') return 'count';
  if (last === 'first') return 'first';
  if (last === 'last') return 'last';
  if (req.method === 'GET') return 'index';
  if (req.method === 'POST') return 'create';
  return null;
}

export interface CollectionHandlers {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
}

export interface MemberHandlers {
  GET: (req: Request, ctx: MemberRouteContext) => Promise<Response>;
  PATCH: (req: Request, ctx: MemberRouteContext) => Promise<Response>;
  DELETE: (req: Request, ctx: MemberRouteContext) => Promise<Response>;
}

export function createCollectionHandlers<M extends ModelConstructor>(
  Model: M,
  options: RouterOptions<M> = {},
): CollectionHandlers {
  const spec: HandlerSpec<M> = { Model, options };
  const enabled = enabledActions<M>(options, DEFAULT_COLLECTION_ACTIONS);

  async function handle(req: Request): Promise<Response> {
    try {
      const action = resolveCollectionAction(req);
      if (!action)
        return Response.json(
          { error: 'MethodNotAllowed', message: 'method not allowed' },
          { status: 405 },
        );
      const config = enabled.get(action);
      if (!config)
        return Response.json({ error: 'NotFound', message: 'action disabled' }, { status: 404 });
      const ctx = makeContext(Model, action, req, {});
      await runGuards(spec, ctx, config);
      return await dispatchCollection(spec, action, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  }

  return {
    GET: (req) => handle(req),
    POST: (req) => handle(req),
  };
}

export function createMemberHandlers<M extends ModelConstructor>(
  Model: M,
  options: RouterOptions<M> = {},
): MemberHandlers {
  const spec: HandlerSpec<M> = { Model, options };
  const idParam = options.idParam ?? 'id';
  const enabled = enabledActions<M>(options, DEFAULT_MEMBER_ACTIONS);

  async function handle(
    req: Request,
    routeCtx: MemberRouteContext,
    action: MemberAction,
  ): Promise<Response> {
    try {
      const config = enabled.get(action);
      if (!config)
        return Response.json({ error: 'NotFound', message: 'action disabled' }, { status: 404 });
      const params = await resolveParams(routeCtx.params);
      const rawId = params[idParam];
      if (rawId === undefined || Array.isArray(rawId)) {
        throw new NotFoundError(`missing ${idParam} path param`);
      }
      const ctx = makeContext(Model, action, req, params);
      ctx.record = (await (Model as any).find(coerceId(rawId, Model))) as InstanceType<M>;
      await runGuards(spec, ctx, config);
      return await dispatchMember(spec, action, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  }

  return {
    GET: (req, ctx) => handle(req, ctx, 'show'),
    PATCH: (req, ctx) => handle(req, ctx, 'update'),
    DELETE: (req, ctx) => handle(req, ctx, 'delete'),
  };
}
