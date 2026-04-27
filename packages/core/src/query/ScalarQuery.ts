import type { Dict, Filter, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import { PersistenceError } from '../errors.js';
import { NullConnector } from '../Model.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

/**
 * Mirrors CollectionQuery's makeScopedSubclass — projects QueryState onto a
 * temp Model subclass so the legacy aggregate path (`Model.count()` /
 * `.sum()` / etc., which read `this.<x>` static properties) operates on
 * the chained scope.
 */
function makeStateProjectedSubclass(M: any, state: QueryState): any {
  return class extends (M as any) {
    static filter = state.filter;
    static order = [...state.order];
    static limit = state.limit;
    static skip = state.skip;
    static selectedFields = state.selectedFields;
    static selectedIncludes = [...state.selectedIncludes];
    static includeStrategy = state.includeStrategy;
    static pendingJoins = [...state.pendingJoins];
    static havingPredicate = state.havingPredicate;
    static softDelete = state.softDelete;
    static connector = state.nullScoped ? new NullConnector() : (M as any).connector;
  };
}

export class ScalarQuery<T = unknown> implements PromiseLike<T> {
  protected memo: Promise<T> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
    public readonly projection: Projection,
  ) {}

  /**
   * Mix the soft-delete and STI filters into the state.filter so the
   * connector-side queryScoped path applies them too. (Model.modelScope
   * does this for the legacy path; without folding it in here, scoped
   * aggregates / pluck would ignore `softDelete: 'only'` etc.)
   */
  private applyImplicitScopes(filter: Filter<any> | undefined): Filter<any> | undefined {
    let out = filter;
    const M = this.model as any;
    const softColumn = M.softDeleteColumn ?? 'discardedAt';
    if (this.state.softDelete === 'active') {
      const sf = { $null: softColumn } as Filter<any>;
      out = out ? ({ $and: [sf, out] } as Filter<any>) : sf;
    } else if (this.state.softDelete === 'only') {
      const sf = { $notNull: softColumn } as Filter<any>;
      out = out ? ({ $and: [sf, out] } as Filter<any>) : sf;
    }
    if (M.inheritColumn && M.inheritType !== undefined) {
      const tf = { [M.inheritColumn]: M.inheritType } as Filter<any>;
      out = out ? ({ $and: [tf, out] } as Filter<any>) : tf;
    }
    return out;
  }

  protected async materialize(): Promise<T> {
    if (!this.memo) {
      this.memo = (async () => {
        if (this.state.nullScoped) return this.emptyResult();
        // pendingJoins (from `joins(...)` / `whereMissing(...)`) are resolved
        // by Model.modelScope() into concrete `$in` / `$notIn` filters; defer
        // to the legacy aggregate path so we get that resolution for free.
        if (this.state.pendingJoins.length > 0) {
          return (await this.viaLegacy()) as T;
        }
        const resolvedFilter = await resolveSubqueryFilters(this.state.filter);
        const scopedFilter = this.applyImplicitScopes(resolvedFilter);
        const builderForLower =
          scopedFilter !== this.state.filter
            ? new (this.constructor as any)(this.model, { ...this.state, filter: scopedFilter }, this.projection)
            : this;
        const spec = lower(builderForLower, this.projection);
        const M = this.model as any;
        const connector = M.connector;
        if (!connector || typeof connector.queryScoped !== 'function') {
          throw new PersistenceError(
            `${M.name || M.tableName || 'Model'}.connector does not implement queryScoped(spec).`,
          );
        }
        const result = await connector.queryScoped(spec);
        // For column projection on an InstanceQuery (limit 1 path), result is array; take [0]
        if (typeof this.projection === 'object' && this.projection.kind === 'column') {
          return ((result as unknown[])[0] as T) ?? (undefined as T);
        }
        return result as T;
      })();
    }
    return this.memo;
  }

  /**
   * Fall back to Model.modelScope() + the connector's native aggregate /
   * select. Used when the chain has pendingJoins (`joins(...)` /
   * `whereMissing(...)`) — modelScope() resolves those into `$in` / `$notIn`
   * filters, which baseQueryScoped doesn't know how to do on its own.
   * We bypass `Sub.count()` / `Sub.sum()` here because those now forward
   * back into ScalarQuery, which would re-enter this fallback infinitely.
   */
  private async viaLegacy(): Promise<unknown> {
    const M = this.model as any;
    const Sub = makeStateProjectedSubclass(M, this.state);
    const scope = await Sub.modelScope();
    const connector = Sub.connector;
    if (typeof this.projection === 'object' && this.projection.kind === 'aggregate') {
      const { op, column } = this.projection;
      if (op === 'count') return connector.count(scope);
      if (column === undefined) {
        throw new PersistenceError(
          `Aggregate '${op}' requires a column; received undefined.`,
        );
      }
      const value = await connector.aggregate(scope, op as any, column);
      if (op === 'sum') return value ?? 0;
      return value;
    }
    if (typeof this.projection === 'object' && this.projection.kind === 'column') {
      // Single-column scalar selection (called from InstanceQuery.pluck) — take
      // the first row's column value via the connector's select.
      const items = await connector.select(scope, this.projection.column);
      return (items[0] as Dict<any> | undefined)?.[this.projection.column];
    }
    throw new PersistenceError(`Unsupported projection in legacy fallback: ${JSON.stringify(this.projection)}`);
  }

  // Empty-set semantics for the nullScoped short-circuit:
  //   count → 0,  sum → 0,  avg/min/max → undefined,  column → undefined.
  private emptyResult(): T {
    if (typeof this.projection === 'object' && this.projection.kind === 'aggregate') {
      const { op } = this.projection;
      if (op === 'count' || op === 'sum') return 0 as T;
    }
    return undefined as T;
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.materialize().then(onFulfilled, onRejected);
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null) {
    return this.materialize().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null) {
    return this.materialize().finally(onFinally);
  }
}
