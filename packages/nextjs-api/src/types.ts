import type { ModelClass } from '@next-model/core';

export type ModelConstructor = typeof ModelClass;

export type CollectionAction = 'index' | 'create' | 'count' | 'first' | 'last';
export type MemberAction = 'show' | 'update' | 'delete';
export type ActionName = CollectionAction | MemberAction;

export const DEFAULT_COLLECTION_ACTIONS: readonly CollectionAction[] = Object.freeze([
  'index',
  'create',
  'count',
  'first',
  'last',
]);
export const DEFAULT_MEMBER_ACTIONS: readonly MemberAction[] = Object.freeze([
  'show',
  'update',
  'delete',
]);

export interface RouteParams {
  /** The `[id]` segment. Other dynamic segments pass through unchanged. */
  [key: string]: string | string[];
}

/**
 * Next.js App Router passes `(request, { params: Promise<Params> })` to dynamic
 * route handlers from 15.x onward. This adapter accepts either a sync or
 * promise-wrapped params bag so the same export works against 14.x + 15.x.
 */
export interface MemberRouteContext {
  params: RouteParams | Promise<RouteParams>;
}

export interface ActionContext<M extends ModelConstructor = ModelConstructor> {
  action: ActionName;
  req: Request;
  Model: M;
  /** Populated for member actions before the handler runs. */
  record?: InstanceType<M>;
  /** Resolved dynamic-route params (empty object for collection handlers). */
  params: RouteParams;
}

export type Authorize<M extends ModelConstructor = ModelConstructor> = (
  ctx: ActionContext<M>,
) => boolean | Promise<boolean>;

export type BeforeAction<M extends ModelConstructor = ModelConstructor> = (
  ctx: ActionContext<M>,
) => void | Promise<void>;

export type SerializeRow<M extends ModelConstructor = ModelConstructor> = (
  record: InstanceType<M>,
  ctx: ActionContext<M>,
) => unknown | Promise<unknown>;

export interface EnvelopeInput {
  action: ActionName;
  data: unknown;
  meta?: Record<string, unknown>;
}

export type Envelope<M extends ModelConstructor = ModelConstructor> = (
  input: EnvelopeInput,
  ctx: ActionContext<M>,
) => unknown | Promise<unknown>;

export interface ActionOptions<M extends ModelConstructor = ModelConstructor> {
  authorize?: Authorize<M>;
  before?: BeforeAction<M>;
}

export type ActionConfig<M extends ModelConstructor = ModelConstructor> =
  | boolean
  | ActionOptions<M>;

export interface RouterOptions<M extends ModelConstructor = ModelConstructor> {
  actions?: Partial<Record<ActionName, ActionConfig<M>>>;
  authorize?: Authorize<M>;
  serialize?: SerializeRow<M>;
  envelope?: Envelope<M>;
  /** Dynamic-route segment that carries the primary key. Defaults to `'id'`. */
  idParam?: string;
  defaultLimit?: number;
  maxLimit?: number;
}
