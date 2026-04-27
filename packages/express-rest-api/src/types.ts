import type { ModelClass } from '@next-model/core';
import type { Request, Response } from 'express';

export type ModelConstructor = typeof ModelClass;

export type ActionName =
  | 'index'
  | 'show'
  | 'create'
  | 'update'
  | 'delete'
  | 'count'
  | 'first'
  | 'last';

export const DEFAULT_ACTIONS: readonly ActionName[] = Object.freeze([
  'index',
  'show',
  'create',
  'update',
  'delete',
  'count',
  'first',
  'last',
]);

export interface ActionContext<M extends ModelConstructor = ModelConstructor> {
  action: ActionName;
  req: Request;
  res: Response;
  Model: M;
  /** Populated for member actions (`show`, `update`, `delete`) after lookup. */
  record?: InstanceType<M>;
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

export interface EnvelopeInput<T = unknown> {
  action: ActionName;
  data: T;
  meta?: Record<string, unknown>;
}

export type Envelope<M extends ModelConstructor = ModelConstructor> = (
  input: EnvelopeInput,
  ctx: ActionContext<M>,
) => unknown | Promise<unknown>;

export interface ActionOptions<M extends ModelConstructor = ModelConstructor> {
  /** Return false (or throw) to reject the request. */
  authorize?: Authorize<M>;
  /** Fires after authorize + record lookup, before the action runs. */
  before?: BeforeAction<M>;
}

/** Per-action override: either a full options bag, `false` to disable, or `true` to enable with defaults. */
export type ActionConfig<M extends ModelConstructor = ModelConstructor> =
  | boolean
  | ActionOptions<M>;

export interface RouterOptions<M extends ModelConstructor = ModelConstructor> {
  /**
   * Enabled actions. Omit to enable every action in `DEFAULT_ACTIONS`.
   * Pass `false` for an action to disable it, or an options bag to wire auth/before hooks.
   */
  actions?: Partial<Record<ActionName, ActionConfig<M>>>;
  /** Global authorize applied to every action (runs before per-action authorize). */
  authorize?: Authorize<M>;
  /** Per-row serializer. Defaults to `record.toJSON()` when available, otherwise `record.attributes`. */
  serialize?: SerializeRow<M>;
  /** Wraps the full response. Defaults to `{ data, meta }` when meta is present, else just `data`. */
  envelope?: Envelope<M>;
  /**
   * Path param name used for member actions (defaults to `id`). Change this if your route is mounted
   * under a different path param — e.g. `app.use('/users/:slug', createRestRouter(User, { idParam: 'slug' }))`.
   */
  idParam?: string;
  /**
   * Default items-per-page when `limit`/`perPage` is not specified by the client. Defaults to `25`.
   */
  defaultLimit?: number;
  /** Hard upper bound on how many items a client can request. Defaults to `100`. */
  maxLimit?: number;
}
