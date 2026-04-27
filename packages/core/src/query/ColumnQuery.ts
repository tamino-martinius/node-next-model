import { PersistenceError } from '../errors.js';
import type { Dict, Filter, KeyType, Projection } from '../types.js';
import { lower, resolveSubqueryFilters } from './lower.js';
import type { QueryState } from './QueryState.js';
import { resolvePendingJoinsToScope } from './scope.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ColumnQuery<Shape = unknown> implements PromiseLike<Shape> {
  protected memo: Promise<Shape> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly column: string,
    public readonly state: QueryState,
    public readonly projection: Projection,
  ) {}

  /** Mirror ScalarQuery: fold soft-delete + STI filters into state.filter. */
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

  protected async materialize(): Promise<Shape> {
    if (!this.memo) {
      this.memo = (async () => {
        if (this.state.nullScoped) return [] as unknown as Shape;
        // Resolve `pendingJoins` to flat `$in` / `$notIn` filters before
        // lowering — column projection on a chain with joins would otherwise
        // hit `queryWithJoins`, which always returns rows and discards the
        // projection.
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
          this.column,
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
        return result as Shape;
      })();
    }
    return this.memo;
  }

  // biome-ignore lint/suspicious/noThenProperty: ColumnQuery intentionally implements PromiseLike so it composes with await + .then.
  then<R1 = Shape, R2 = never>(
    onFulfilled?: ((value: Shape) => R1 | PromiseLike<R1>) | null,
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
