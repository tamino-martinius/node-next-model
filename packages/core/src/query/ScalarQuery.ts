import type { Dict, Filter, KeyType, Projection } from '../types.js';
import type { QueryState } from './QueryState.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import { PersistenceError } from '../errors.js';
import { resolvePendingJoinsToScope } from './scope.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

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
        // Resolve `pendingJoins` (`joins(...)` / `whereMissing(...)`) to
        // concrete `$in` / `$notIn` filters before lowering, so the connector
        // sees a flat scope — aggregates / column projections never go through
        // queryWithJoins, which would discard the projection.
        let stateForLower = this.state;
        if (this.state.pendingJoins.length > 0) {
          const resolvedScope = await resolvePendingJoinsToScope(this.model as any, this.state);
          stateForLower = {
            ...this.state,
            filter: resolvedScope.filter,
            pendingJoins: [],
          };
        }
        const resolvedFilter = await resolveSubqueryFilters(stateForLower.filter);
        const scopedFilter = this.applyImplicitScopes(resolvedFilter);
        const builderForLower = new (this.constructor as any)(
          this.model,
          { ...stateForLower, filter: scopedFilter },
          this.projection,
        );
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
