import { NotFoundError, PersistenceError } from '../errors.js';
import type { AssociationDefinition } from '../Model.js';
import type { AssociationLink, Dict, KeyType } from '../types.js';
import type { CollectionQuery } from './CollectionQuery.js';
import { lower } from './lower.js';
import type { ParentRef, QueryState, TerminalKind } from './QueryState.js';
import { ScalarQuery } from './ScalarQuery.js';
import { createAssociationQuery } from './associationQuery.js';

export type { TerminalKind };

type ModelLike = { tableName: string; keys: Dict<KeyType>; name?: string };

export class InstanceQuery<Result = unknown> implements PromiseLike<Result> {
  protected memo: Promise<Result> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly terminalKind: TerminalKind,
    public readonly state: QueryState,
  ) {
    const associations = (this.model as any).associations as
      | Record<string, AssociationDefinition>
      | undefined;
    if (associations) {
      for (const name in associations) {
        if (Object.getOwnPropertyDescriptor(this, name)) continue;
        const spec = associations[name];
        // enumerable:false — query builders are not data records; we don't
        // want association getters to surface via Object.keys / spread / JSON.
        // (ModelClass instance accessors use enumerable:true precisely
        // because those are the data records.)
        Object.defineProperty(this, name, {
          get: () => createAssociationQuery(this, spec),
          enumerable: false,
          configurable: true,
        });
      }
    }
  }

  protected async materialize(): Promise<Result> {
    if (!this.memo) {
      this.memo = (async () => {
        if (this.state.nullScoped) {
          return this.missingResult();
        }
        const spec = lower(this, 'rows');
        const M = this.model as any;
        const connector = M.connector;
        if (!connector || typeof connector.queryScoped !== 'function') {
          throw new PersistenceError(
            `${M.name || M.tableName || 'Model'}.connector does not implement queryScoped(spec).`,
          );
        }
        const rows = (await connector.queryScoped(spec)) as Dict<any>[];
        const row = rows[0];
        if (row === undefined) {
          return this.missingResult();
        }
        return this.hydrate(row) as Result;
      })();
    }
    return this.memo;
  }

  private missingResult(): Result {
    if (this.terminalKind === 'find' || this.terminalKind === 'findOrFail') {
      const label = this.model.name || this.model.tableName || 'Record';
      throw new NotFoundError(`${label} not found`);
    }
    return undefined as unknown as Result;
  }

  // TODO(Task 13/26): align hydrate with Model.find/findBy's full materializer:
  // afterFind callbacks, eager-loaded includes attachment, STI dispatch via
  // inheritColumn → inheritRegistry. Mirrors the same gap on CollectionQuery.
  protected hydrate(row: Dict<any>): unknown {
    const M = this.model as any;
    const keys: Dict<any> = {};
    const data: Dict<any> = { ...row };
    for (const k in M.keys) {
      keys[k] = data[k];
      delete data[k];
    }
    return new M(data, keys);
  }

  withParent(upstream: CollectionQuery | InstanceQuery, link: AssociationLink): this {
    const parentRef: ParentRef = {
      upstream: {
        state: upstream.state,
        terminalKind: 'terminalKind' in upstream ? upstream.terminalKind : undefined,
      },
      via: link,
    };
    return new (this.constructor as any)(this.model, this.terminalKind, {
      ...this.state,
      parent: parentRef,
    });
  }

  pluck<T = unknown>(column: string): ScalarQuery<T | undefined> {
    return new ScalarQuery<T | undefined>(
      this.model,
      { ...this.state, limit: 1 },
      { kind: 'column', column },
    );
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
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
