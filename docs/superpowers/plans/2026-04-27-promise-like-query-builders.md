# Promise-Like Chainable Query Builders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the eager `Promise<…>`-returning query terminals on `@next-model/core` with deferred `CollectionQuery` / `InstanceQuery` / `ColumnQuery` / `ScalarQuery` builders that compose end-to-end and execute as one SQL statement when the connector supports it.

**Architecture:** Four deferred builder classes hold accumulated query state plus an optional parent link. A new `Connector.queryScoped` entry point compiles the whole chain into one structured request. Native-SQL connectors emit a single nested-subquery / JOIN statement; KV/document connectors inherit a default fallback that pre-resolves nested builders to `$in: [...]` filters before hitting their existing `query` primitive.

**Tech Stack:** TypeScript, vitest, pnpm workspaces. Native runtimes use Knex / pg / sqlite / mysql2 / mariadb / Aurora Data API; KV stores include Memory, Redis, Valkey, Mongo, LocalStorage.

**Spec:** `docs/superpowers/specs/2026-04-27-promise-like-query-builders-design.md`

**Granularity note.** Phases 9 (six SQL connector overrides), 12 (six conformance test cases), and 13 (docs) follow the same pattern repeatedly. Each task in those phases shows the pattern in full; the engineer applies it to each connector / test case in turn.

**Run tests with:** `pnpm --filter @next-model/core test` from repo root, or `pnpm test -r` to run every workspace package.

---

## Phase 1 — Foundation: types and shared state

### Task 1: Add `Projection` and `ParentScope` types

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add types alongside the existing `Scope` / `JoinClause` declarations**

Append to `packages/core/src/types.ts`:

```ts
export type Projection =
  | 'rows'
  | { kind: 'pk' }
  | { kind: 'column'; column: string }
  | { kind: 'aggregate'; op: 'count' | 'sum' | 'avg' | 'min' | 'max'; column?: string };

export interface ParentScope {
  parentTable: string;
  parentKeys: Dict<KeyType>;
  parentFilter?: Filter<any>;
  parentOrder?: OrderColumn<any>[];
  parentLimit?: number;
  link: {
    childColumn: string;
    parentColumn: string;
    direction: 'belongsTo' | 'hasOne' | 'hasMany';
  };
}

export interface QueryScopedSpec {
  target: { tableName: string; keys: Dict<KeyType> };
  filter?: Filter<any>;
  order?: OrderColumn<any>[];
  limit?: number;
  skip?: number;
  selectedFields?: string[];
  pendingJoins: JoinClause[];
  parentScopes: ParentScope[];
  projection: Projection;
}
```

- [ ] **Step 2: Add `queryScoped` to the `Connector` interface as optional**

In `Connector`, after `queryWithJoins?(...)`:

```ts
  /**
   * Run `spec` with optional nested parent-scope subqueries and a projection.
   * Returns rows, primary keys, plucked column values, or a single aggregate
   * scalar depending on `spec.projection`. Connectors that don't override get
   * the default `baseQueryScoped` fallback (pre-resolves nested scopes into
   * `$in: [...]` filters).
   */
  queryScoped?(spec: QueryScopedSpec): Promise<unknown>;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @next-model/core typecheck`
Expected: PASS (no usages yet, just type additions).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "core(types): Projection, ParentScope, QueryScopedSpec, optional Connector.queryScoped"
```

---

### Task 2: `QueryState` shape and merge helpers

**Files:**
- Create: `packages/core/src/query/QueryState.ts`
- Create: `packages/core/src/__tests__/queryState.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/__tests__/queryState.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeFilters, mergeOrders, type QueryState } from '../query/QueryState.js';

describe('mergeFilters', () => {
  it('returns the new filter when current is undefined', () => {
    expect(mergeFilters(undefined, { active: true })).toEqual({ active: true });
  });

  it('returns the current filter when next is empty', () => {
    expect(mergeFilters({ active: true }, {})).toEqual({ active: true });
  });

  it('AND-merges disjoint column filters into a flat object', () => {
    expect(mergeFilters({ active: true }, { role: 'admin' })).toEqual({
      active: true,
      role: 'admin',
    });
  });

  it('AND-wraps when both filters share a column', () => {
    expect(mergeFilters({ active: true }, { active: false })).toEqual({
      $and: [{ active: true }, { active: false }],
    });
  });

  it('AND-wraps when either side has special operators', () => {
    expect(mergeFilters({ $null: 'email' as any }, { active: true })).toEqual({
      $and: [{ $null: 'email' }, { active: true }],
    });
  });
});

describe('mergeOrders', () => {
  it('appends new order columns onto existing ones', () => {
    expect(
      mergeOrders([{ key: 'a' as any }], [{ key: 'b' as any }, { key: 'c' as any }]),
    ).toEqual([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @next-model/core test queryState.spec.ts`
Expected: FAIL with "Cannot find module ../query/QueryState.js".

- [ ] **Step 3: Implement `QueryState` and helpers**

Create `packages/core/src/query/QueryState.ts`:

```ts
import type {
  Dict,
  Filter,
  JoinClause,
  KeyType,
  OrderColumn,
} from '../types.js';

export type AssociationLink = {
  childColumn: string;
  parentColumn: string;
  direction: 'belongsTo' | 'hasOne' | 'hasMany';
};

export interface QueryState {
  Model: { tableName: string; keys: Dict<KeyType> };
  filter?: Filter<any>;
  order: OrderColumn<any>[];
  limit?: number;
  skip?: number;
  selectedFields?: string[];
  selectedIncludes: string[];
  includeStrategy: 'preload' | 'join' | 'auto';
  pendingJoins: JoinClause[];
  havingPredicate?: (count: number) => boolean;
  softDelete: 'active' | 'only' | false;
  parent?: { upstream: { state: QueryState; terminalKind?: string }; via: AssociationLink };
}

const hasSpecial = (f: Filter<any> | undefined): boolean =>
  !!f && Object.keys(f).some((k) => k.startsWith('$'));

export function mergeFilters(
  current: Filter<any> | undefined,
  next: Filter<any>,
): Filter<any> | undefined {
  if (Object.keys(next).length === 0) return current;
  if (!current) return next;
  if (hasSpecial(current) || hasSpecial(next)) {
    return { $and: [current, next] } as Filter<any>;
  }
  const merged: Dict<any> = { ...(current as Dict<any>) };
  for (const key in next as Dict<any>) {
    if (merged[key] !== undefined) {
      return { $and: [current, next] } as Filter<any>;
    }
    merged[key] = (next as Dict<any>)[key];
  }
  return merged as Filter<any>;
}

export function mergeOrders(
  current: OrderColumn<any>[],
  next: OrderColumn<any>[],
): OrderColumn<any>[] {
  return [...current, ...next];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @next-model/core test queryState.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/QueryState.ts packages/core/src/__tests__/queryState.spec.ts
git commit -m "core(query): QueryState shape, mergeFilters, mergeOrders"
```

---

### Task 3: `CollectionQuery` skeleton with thenable behavior

**Files:**
- Create: `packages/core/src/query/CollectionQuery.ts`
- Create: `packages/core/src/__tests__/collectionQuery.spec.ts`

- [ ] **Step 1: Write failing tests for thenable + identity behavior**

```ts
import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';

const FakeModel = { tableName: 'todos', keys: { id: 1 } };

describe('CollectionQuery', () => {
  it('resolves to its execute() result when awaited', async () => {
    const q = new CollectionQuery(FakeModel as any, async () => [{ id: 1 }, { id: 2 }]);
    const rows = await q;
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('only executes once per await chain (memoized)', async () => {
    let calls = 0;
    const q = new CollectionQuery(FakeModel as any, async () => {
      calls += 1;
      return [];
    });
    await q;
    await q;
    expect(calls).toBe(1);
  });

  it('catch returns a chained PromiseLike', async () => {
    const q = new CollectionQuery(FakeModel as any, async () => {
      throw new Error('boom');
    });
    const recovered = await q.catch((e: Error) => e.message);
    expect(recovered).toBe('boom');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @next-model/core test collectionQuery.spec.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement skeleton**

```ts
// packages/core/src/query/CollectionQuery.ts
import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly execute: () => Promise<Items>,
  ) {}

  protected materialize(): Promise<Items> {
    if (!this.memo) this.memo = this.execute();
    return this.memo;
  }

  then<R1 = Items, R2 = never>(
    onFulfilled?: ((value: Items) => R1 | PromiseLike<R1>) | null,
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
```

- [ ] **Step 4: Run tests to verify pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQuery.spec.ts
git commit -m "core(query): CollectionQuery skeleton with thenable + memoized execute"
```

---

### Task 4: `InstanceQuery` skeleton with terminalKind

**Files:**
- Create: `packages/core/src/query/InstanceQuery.ts`
- Create: `packages/core/src/__tests__/instanceQuery.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { InstanceQuery } from '../query/InstanceQuery.js';
import { NotFoundError } from '../errors.js';

const FakeModel = { tableName: 'users', keys: { id: 1 } };

describe('InstanceQuery', () => {
  it('resolves to undefined when execute returns undefined', async () => {
    const q = new InstanceQuery(FakeModel as any, 'first', async () => undefined);
    expect(await q).toBeUndefined();
  });

  it('resolves to the record when execute returns one', async () => {
    const q = new InstanceQuery(FakeModel as any, 'first', async () => ({ id: 1 }));
    expect(await q).toEqual({ id: 1 });
  });

  it('findOrFail terminal throws NotFoundError on undefined', async () => {
    const q = new InstanceQuery(FakeModel as any, 'findOrFail', async () => undefined);
    await expect(q).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run tests — fail**

- [ ] **Step 3: Implement skeleton**

```ts
// packages/core/src/query/InstanceQuery.ts
import { NotFoundError } from '../errors.js';
import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType>; name?: string };

export type TerminalKind = 'first' | 'last' | 'findBy' | 'find' | 'findOrFail';

export class InstanceQuery<Result = unknown> implements PromiseLike<Result> {
  protected memo: Promise<Result> | undefined;

  constructor(
    public readonly model: ModelLike,
    public readonly terminalKind: TerminalKind,
    public readonly execute: () => Promise<Result | undefined>,
  ) {}

  protected materialize(): Promise<Result> {
    if (!this.memo) {
      this.memo = this.execute().then((result) => {
        if (result === undefined && (this.terminalKind === 'find' || this.terminalKind === 'findOrFail')) {
          const label = this.model.name || this.model.tableName || 'Record';
          throw new NotFoundError(`${label} not found`);
        }
        return result as Result;
      });
    }
    return this.memo;
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
```

- [ ] **Step 4: Run tests — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/InstanceQuery.ts packages/core/src/__tests__/instanceQuery.spec.ts
git commit -m "core(query): InstanceQuery skeleton with terminalKind missing-record policy"
```

---

### Task 5: `ColumnQuery` and `ScalarQuery` skeletons

**Files:**
- Create: `packages/core/src/query/ColumnQuery.ts`
- Create: `packages/core/src/query/ScalarQuery.ts`
- Create: `packages/core/src/__tests__/columnScalarQuery.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { ColumnQuery } from '../query/ColumnQuery.js';
import { ScalarQuery } from '../query/ScalarQuery.js';

const FakeModel = { tableName: 't', keys: { id: 1 } };

describe('ColumnQuery', () => {
  it('resolves to a list of values', async () => {
    const q = new ColumnQuery(FakeModel as any, 'email', async () => ['a@b', 'c@d']);
    expect(await q).toEqual(['a@b', 'c@d']);
  });
});

describe('ScalarQuery', () => {
  it('resolves to a single scalar', async () => {
    const q = new ScalarQuery(FakeModel as any, async () => 42);
    expect(await q).toBe(42);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement (mirror CollectionQuery's thenable plumbing)**

```ts
// packages/core/src/query/ColumnQuery.ts
import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ColumnQuery<Shape = unknown> implements PromiseLike<Shape> {
  protected memo: Promise<Shape> | undefined;
  constructor(
    public readonly model: ModelLike,
    public readonly column: string,
    public readonly execute: () => Promise<Shape>,
  ) {}
  protected materialize() {
    if (!this.memo) this.memo = this.execute();
    return this.memo;
  }
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
```

```ts
// packages/core/src/query/ScalarQuery.ts
import type { Dict, KeyType } from '../types.js';

type ModelLike = { tableName: string; keys: Dict<KeyType> };

export class ScalarQuery<T = unknown> implements PromiseLike<T> {
  protected memo: Promise<T> | undefined;
  constructor(
    public readonly model: ModelLike,
    public readonly execute: () => Promise<T>,
  ) {}
  protected materialize() {
    if (!this.memo) this.memo = this.execute();
    return this.memo;
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
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/ColumnQuery.ts packages/core/src/query/ScalarQuery.ts packages/core/src/__tests__/columnScalarQuery.spec.ts
git commit -m "core(query): ColumnQuery and ScalarQuery skeletons"
```

---

## Phase 2 — `baseQueryScoped` fallback

### Task 6: `baseQueryScoped` resolves nested scopes into concrete `$in`

**Files:**
- Create: `packages/core/src/query/baseQueryScoped.ts`
- Create: `packages/core/src/__tests__/baseQueryScoped.spec.ts`

- [ ] **Step 1: Write failing tests using a recording connector**

```ts
import { describe, expect, it } from 'vitest';
import { baseQueryScoped } from '../query/baseQueryScoped.js';
import { MemoryConnector } from '../MemoryConnector.js';
import { KeyType } from '../types.js';

describe('baseQueryScoped', () => {
  it('returns rows for the simple no-parent-scope case', async () => {
    const c = new MemoryConnector({ users: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'users', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: 'rows',
    });
    expect(rows).toHaveLength(2);
  });

  it('resolves a parent scope into an $in filter', async () => {
    const c = new MemoryConnector({
      users: [{ id: 1, email: 'a@b' }, { id: 2, email: 'c@d' }],
      todos: [{ id: 10, userId: 1 }, { id: 11, userId: 2 }],
    });
    const rows = await baseQueryScoped(c, {
      target: { tableName: 'todos', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [
        {
          parentTable: 'users',
          parentKeys: { id: KeyType.number },
          parentFilter: { email: 'a@b' },
          parentLimit: 1,
          link: { childColumn: 'userId', parentColumn: 'id', direction: 'hasMany' },
        },
      ],
      projection: 'rows',
    });
    expect(rows).toEqual([expect.objectContaining({ id: 10 })]);
  });

  it('aggregate projection returns a scalar', async () => {
    const c = new MemoryConnector({ orders: [{ id: 1, total: 5 }, { id: 2, total: 7 }] });
    const result = await baseQueryScoped(c, {
      target: { tableName: 'orders', keys: { id: KeyType.number } },
      pendingJoins: [],
      parentScopes: [],
      projection: { kind: 'aggregate', op: 'sum', column: 'total' },
    });
    expect(result).toBe(12);
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

```ts
// packages/core/src/query/baseQueryScoped.ts
import type {
  Connector,
  Dict,
  Filter,
  ParentScope,
  Projection,
  QueryScopedSpec,
} from '../types.js';
import { mergeFilters } from './QueryState.js';

async function resolveParent(
  connector: Connector,
  scope: ParentScope,
): Promise<unknown[]> {
  const rows = await connector.select(
    {
      tableName: scope.parentTable,
      filter: scope.parentFilter,
      order: scope.parentOrder,
      limit: scope.parentLimit,
    },
    scope.link.parentColumn,
  );
  const seen = new Set<unknown>();
  const values: unknown[] = [];
  for (const row of rows) {
    const v = (row as Dict<any>)[scope.link.parentColumn];
    if (v == null || seen.has(v)) continue;
    seen.add(v);
    values.push(v);
  }
  return values;
}

export async function baseQueryScoped(
  connector: Connector,
  spec: QueryScopedSpec,
): Promise<unknown> {
  let filter = spec.filter;
  for (const parent of spec.parentScopes) {
    const values = await resolveParent(connector, parent);
    const inFilter: Filter<any> = { $in: { [parent.link.childColumn]: values } } as Filter<any>;
    filter = mergeFilters(filter, inFilter);
  }
  const baseScope = {
    tableName: spec.target.tableName,
    filter,
    order: spec.order,
    limit: spec.limit,
    skip: spec.skip,
  };
  const projection: Projection = spec.projection;
  if (projection === 'rows') {
    return connector.query(baseScope);
  }
  if (typeof projection === 'object' && projection.kind === 'pk') {
    const pkName = Object.keys(spec.target.keys)[0] ?? 'id';
    const rows = await connector.select(baseScope, pkName);
    return rows.map((row) => (row as Dict<any>)[pkName]);
  }
  if (typeof projection === 'object' && projection.kind === 'column') {
    const rows = await connector.select(baseScope, projection.column);
    return rows.map((row) => (row as Dict<any>)[projection.column]);
  }
  if (typeof projection === 'object' && projection.kind === 'aggregate') {
    if (projection.op === 'count') {
      return connector.count(baseScope);
    }
    const kind = projection.op === 'avg' ? 'avg' : projection.op === 'sum' ? 'sum'
      : projection.op === 'min' ? 'min' : 'max';
    return connector.aggregate(baseScope, kind, projection.column ?? '');
  }
  throw new Error(`Unknown projection: ${JSON.stringify(projection)}`);
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/baseQueryScoped.ts packages/core/src/__tests__/baseQueryScoped.spec.ts
git commit -m "core(query): baseQueryScoped fallback resolves parent scopes to in-filters"
```

---

### Task 7: Default `queryScoped` on connectors that don't override

**Files:**
- Modify: `packages/core/src/MemoryConnector.ts`

- [ ] **Step 1: Write a test asserting Memory connector exposes queryScoped via default delegation**

Append to `packages/core/src/__tests__/MemoryConnector.spec.ts`:

```ts
import { baseQueryScoped } from '../query/baseQueryScoped.js';

it('queryScoped delegates to baseQueryScoped fallback', async () => {
  const c = new MemoryConnector({ items: [{ id: 1 }, { id: 2 }] });
  const rows = await c.queryScoped!({
    target: { tableName: 'items', keys: { id: 1 } as any },
    pendingJoins: [],
    parentScopes: [],
    projection: 'rows',
  });
  expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
});
```

- [ ] **Step 2: Run — fail (queryScoped not defined yet)**

- [ ] **Step 3: Add the default `queryScoped` to `MemoryConnector`**

In `packages/core/src/MemoryConnector.ts`, add a method:

```ts
import { baseQueryScoped } from './query/baseQueryScoped.js';
// …
async queryScoped(spec: QueryScopedSpec) {
  return baseQueryScoped(this, spec);
}
```

(Import `QueryScopedSpec` from `./types.js`.)

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/MemoryConnector.ts packages/core/src/__tests__/MemoryConnector.spec.ts
git commit -m "core(memory): queryScoped delegates to baseQueryScoped"
```

---

## Phase 3 — Migrate static chainable methods to return `CollectionQuery`

The current pattern in `Model.ts` is "every chainable returns a class extending `this`." We're replacing it with "every chainable returns a `CollectionQuery` (or `InstanceQuery`)." The class still carries the *static* methods (so `Todo.filterBy(…)` works as today), but now they construct a `CollectionQuery<typeof Todo>` instead of returning a subclass.

The migration strategy: introduce a `CollectionQuery` constructor that takes a model class + state, and rewrite each static chainable method to return `new CollectionQuery(this, mergedState)`. Methods on `CollectionQuery` mirror them and return `new CollectionQuery(this.model, mergedState)`.

### Task 8: `CollectionQuery.fromModel(M)` — seed a builder from a Model class

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/collectionQuery.spec.ts`

- [ ] **Step 1: Write failing test**

Append:

```ts
import { ModelClass } from '../Model.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static filter = { active: true } as any;
  static connector = { query: async () => [] } as any;
}

it('fromModel seeds default scope', () => {
  const q = CollectionQuery.fromModel(Todo as any);
  expect(q.state.filter).toEqual({ active: true });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Add `state` and `fromModel`**

Modify `CollectionQuery`:

```ts
import type { QueryState } from './QueryState.js';

export class CollectionQuery<Items = unknown[]> implements PromiseLike<Items> {
  protected memo: Promise<Items> | undefined;
  constructor(
    public readonly model: ModelLike,
    public readonly state: QueryState,
  ) {}

  static fromModel(M: typeof import('../Model.js').ModelClass): CollectionQuery {
    return new CollectionQuery(M, {
      Model: M,
      filter: M.filter,
      order: [...M.order],
      limit: M.limit,
      skip: M.skip,
      selectedFields: M.selectedFields,
      selectedIncludes: [...M.selectedIncludes],
      includeStrategy: M.includeStrategy,
      pendingJoins: [...M.pendingJoins],
      havingPredicate: M.havingPredicate,
      softDelete: M.softDelete,
    });
  }

  // execute is no longer a constructor arg; it's resolved at await time
  // through Connector.queryScoped (Task 19+). Until then, use a stub.
  protected materialize(): Promise<Items> {
    if (!this.memo) this.memo = Promise.resolve([] as unknown as Items);
    return this.memo;
  }
  // … then/catch/finally unchanged
}
```

(The earlier execute-callback constructor goes away — tests in Task 3 need updating.)

- [ ] **Step 4: Update Task 3 tests to use `state` shape**

Rewrite the Task 3 tests to seed with `fromModel` and stub `materialize` via a subclass.

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQuery.spec.ts
git commit -m "core(query): CollectionQuery.fromModel seeds state from Model defaults"
```

---

### Task 9: Chain methods on `CollectionQuery` — filter/order/limit/skip/scope-clearers

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Create: `packages/core/src/__tests__/collectionQueryChain.spec.ts`

- [ ] **Step 1: Write failing tests for each chain op**

```ts
import { describe, expect, it } from 'vitest';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { ModelClass } from '../Model.js';
import { SortDirection } from '../types.js';

class Todo extends ModelClass {
  static tableName = 'todos';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

describe('CollectionQuery chain methods', () => {
  it('filterBy merges into state.filter', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true });
    expect(q.state.filter).toEqual({ active: true });
  });

  it('orderBy appends to state.order', () => {
    const q = CollectionQuery.fromModel(Todo as any).orderBy({ key: 'createdAt' as any });
    expect(q.state.order).toEqual([{ key: 'createdAt' }]);
  });

  it('reorder replaces state.order', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .orderBy({ key: 'a' as any })
      .reorder({ key: 'b' as any });
    expect(q.state.order).toEqual([{ key: 'b' }]);
  });

  it('limitBy / skipBy / unlimited / unskipped', () => {
    const q = CollectionQuery.fromModel(Todo as any).limitBy(5).skipBy(2);
    expect(q.state.limit).toBe(5);
    expect(q.state.skip).toBe(2);
    expect(q.unlimited().state.limit).toBeUndefined();
    expect(q.unskipped().state.skip).toBeUndefined();
  });

  it('unfiltered clears state.filter', () => {
    const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).unfiltered();
    expect(q.state.filter).toBeUndefined();
  });

  it('reverse flips order direction', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .orderBy({ key: 'a' as any, dir: SortDirection.Asc })
      .reverse();
    expect(q.state.order[0].dir).toBe(SortDirection.Desc);
  });

  it('unscoped clears every scope state', () => {
    const q = CollectionQuery.fromModel(Todo as any)
      .filterBy({ a: 1 })
      .orderBy({ key: 'a' as any })
      .limitBy(1)
      .unscoped();
    expect(q.state.filter).toBeUndefined();
    expect(q.state.order).toEqual([]);
    expect(q.state.limit).toBeUndefined();
  });

  it('does not mutate the receiver (immutable chain)', () => {
    const a = CollectionQuery.fromModel(Todo as any);
    const b = a.filterBy({ x: 1 });
    expect(a.state.filter).toBeUndefined();
    expect(b.state.filter).toEqual({ x: 1 });
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement chain methods on `CollectionQuery`**

Add inside the class (use `mergeFilters` / `mergeOrders` from `QueryState.ts`, and `normalizeFilterShape` from `../FilterEngine.js`):

```ts
import { normalizeFilterShape } from '../FilterEngine.js';
import { mergeFilters, mergeOrders, type QueryState } from './QueryState.js';
import { type Filter, type Order, SortDirection } from '../types.js';

protected with(patch: Partial<QueryState>): this {
  return new (this.constructor as any)(this.model, { ...this.state, ...patch });
}

filterBy(input: Filter<any>): this {
  const f = normalizeFilterShape(input);
  return this.with({ filter: mergeFilters(this.state.filter, f) });
}

orFilterBy(input: Filter<any>): this {
  const f = normalizeFilterShape(input);
  if (Object.keys(f).length === 0) return this;
  const next = this.state.filter ? ({ $or: [this.state.filter, f] } as Filter<any>) : f;
  return this.with({ filter: next });
}

unfiltered(): this { return this.with({ filter: undefined }); }

orderBy(order: Order<any>): this {
  const next = Array.isArray(order) ? order : [order];
  return this.with({ order: mergeOrders(this.state.order, next) });
}

reorder(order: Order<any>): this {
  return this.with({ order: Array.isArray(order) ? [...order] : [order] });
}

unordered(): this { return this.with({ order: [] }); }

reverse(): this {
  const pk = Object.keys(this.model.keys)[0] ?? 'id';
  const existing = this.state.order.length > 0 ? this.state.order : [{ key: pk } as any];
  const flipped = existing.map((c) => ({
    key: c.key,
    dir: (c.dir ?? SortDirection.Asc) === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc,
  }));
  return this.with({ order: flipped });
}

limitBy(n: number): this { return this.with({ limit: n }); }
unlimited(): this { return this.with({ limit: undefined }); }
skipBy(n: number): this { return this.with({ skip: n }); }
unskipped(): this { return this.with({ skip: undefined }); }

unscoped(): this {
  return this.with({
    filter: undefined,
    order: [],
    limit: undefined,
    skip: undefined,
    selectedFields: undefined,
    selectedIncludes: [],
    includeStrategy: 'preload',
    pendingJoins: [],
    havingPredicate: undefined,
    softDelete: false,
  });
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQueryChain.spec.ts
git commit -m "core(query): CollectionQuery chain methods (filter/order/limit/skip/scope clears)"
```

---

### Task 10: `joins` / `whereMissing` on `CollectionQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/collectionQueryChain.spec.ts`

- [ ] **Step 1: Add tests asserting state.pendingJoins grows correctly**

```ts
import { resolveAssociationTarget } from '../Model.js'; // or inline test fixtures
// …
it('joins(name) appends a select-mode JoinClause', () => {
  class Post extends ModelClass {
    static tableName = 'posts';
    static keys = { id: 1 } as any;
    static order = [] as any;
    static connector = {} as any;
    static associations = {
      user: { belongsTo: Todo, foreignKey: 'userId' } as any,
    };
  }
  const q = CollectionQuery.fromModel(Post as any).joins('user');
  expect(q.state.pendingJoins).toHaveLength(1);
  expect(q.state.pendingJoins[0].mode).toBe('select');
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Lift `joins(...)` and `whereMissing(...)` from `Model.ts` (lines 1040–1115) into `CollectionQuery` methods**

Copy the existing logic verbatim, but operate on `this.state.pendingJoins` instead of `this.pendingJoins`, and return `this.with(...)`. Keep the `PersistenceError` thrown when `associations` is undefined or the name is unknown.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQueryChain.spec.ts
git commit -m "core(query): joins/whereMissing on CollectionQuery"
```

---

### Task 11: `includes` / `withoutIncludes` / `fields` / `allFields` on `CollectionQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/collectionQueryChain.spec.ts`

- [ ] **Step 1: Tests for state.selectedIncludes / state.selectedFields**

(Mirror existing `Model.includes` test cases — names appended, `withoutIncludes` clears, `allFields` clears `selectedFields`.)

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Lift `includes(...)` (Model.ts ~989–1022) and `withoutIncludes(...)`, `fields(...)`, `allFields(...)` into `CollectionQuery`. The existing argument parsing (last-arg `IncludeOptions`) stays.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQueryChain.spec.ts
git commit -m "core(query): includes/withoutIncludes/fields/allFields on CollectionQuery"
```

---

### Task 12: `having` / `merge` / `none` / `withDiscarded` / `onlyDiscarded`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/collectionQueryChain.spec.ts`

- [ ] **Step 1: Tests** — assert each method returns a new query with the appropriate state slice changed.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Lift the method bodies from `Model.ts` (~801–916)**

For `none()`, the tracked state is "use NullConnector instead." Add a `nullScoped: boolean` slot to `QueryState` to flag it, set in `none()`, and consumed by `materialize()` (added in Task 19).

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQueryChain.spec.ts
git commit -m "core(query): having/merge/none/withDiscarded/onlyDiscarded on CollectionQuery"
```

---

### Task 13: Static methods on `Model` forward to `CollectionQuery`

**Files:**
- Modify: `packages/core/src/Model.ts`

- [ ] **Step 1: Add a regression test asserting `Todo.filterBy({…})` returns a `CollectionQuery`**

Append to `packages/core/src/__tests__/Model.spec.ts`:

```ts
import { CollectionQuery } from '../query/CollectionQuery.js';
// …
it('filterBy returns a CollectionQuery', () => {
  const q = Todo.filterBy({ active: true });
  expect(q).toBeInstanceOf(CollectionQuery);
});
```

- [ ] **Step 2: Run — fail (still returns subclass)**

- [ ] **Step 3: Replace each chainable static method body with `CollectionQuery.fromModel(this).<method>(...)`**

Edit `packages/core/src/Model.ts`. For every method in:

`filterBy, orFilterBy, unfiltered, orderBy, reorder, unordered, reverse, limitBy, unlimited, skipBy, unskipped, joins, whereMissing, includes, withoutIncludes, fields, allFields, unscoped, none, having, merge, withDiscarded, onlyDiscarded`

Replace the body with the forwarded call. Example:

```ts
static filterBy<M extends typeof ModelClass>(this: M, input: Filter<any>) {
  return CollectionQuery.fromModel(this as any).filterBy(input) as unknown as M;
}
```

The `as unknown as M` cast is temporary — Phase 4 introduces proper return-type generics. Existing call sites that immediately call another chain method or terminal continue to type-check because both static methods (on `Model`) and instance methods (on `CollectionQuery`) exist with the same names.

- [ ] **Step 4: Remove the now-unused per-method `class extends this { static … }` blocks**

Each chainable static method shrinks from ~5–15 lines to one line.

- [ ] **Step 5: Run the whole core test suite**

Run: `pnpm --filter @next-model/core test`
Expected: PASS. Any failures point to call sites that depended on subclass-static state — fix by reading the relevant slice from the `CollectionQuery.state` instead.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/__tests__/Model.spec.ts
git commit -m "core: chainable static methods forward to CollectionQuery"
```

---

### Task 14: Named scopes are filter literals (factory option)

**Files:**
- Modify: `packages/core/src/Model.ts` (factory function)
- Modify: `packages/core/src/__tests__/Model.spec.ts`

- [ ] **Step 1: Find the existing `scopes` handling in the factory**

Run: `grep -n "scopes" packages/core/src/Model.ts | head -30`

Locate the factory's `scopes: { … }` handling. Today scopes are functions; we're switching to filter literals.

- [ ] **Step 2: Write a failing test**

```ts
class User extends Model({
  tableName: 'users',
  init: (props: { email: string; lastSignInAt: Date | null }) => props,
  scopes: { active: { $notNull: 'lastSignInAt' } },
}) {}

it('filter-literal scopes are available on Model and CollectionQuery', () => {
  expect(User.active().state.filter).toEqual({ $notNull: 'lastSignInAt' });
  expect(User.filterBy({ id: 1 }).active().state.filter).toBeDefined();
});
```

- [ ] **Step 3: Run — fail (signature mismatch / missing chain method)**

- [ ] **Step 4: Update the factory**

Change the type signature for `scopes` from `Dict<(M) => M>` to `Dict<Filter<any>>`. For each scope name:
- Define a static method on the class: `static <name>() { return CollectionQuery.fromModel(this).filterBy(<filter>); }`
- Define a method on the model-specific `CollectionQuery` subclass: `<name>() { return this.filterBy(<filter>); }`

Wire scope methods onto the per-model `CollectionQuery` by either (a) extending `CollectionQuery` per Model and assigning scope methods on the prototype, or (b) using a `Proxy` once at construction time. Pick (a) — simpler and keeps `instanceof CollectionQuery` working.

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/__tests__/Model.spec.ts
git commit -m "core: named scopes are filter literals; chained on Model + CollectionQuery"
```

---

### Task 15: Enum predicates produce CollectionQuery

**Files:**
- Modify: `packages/core/src/Model.ts` (enum handling section)
- Modify: `packages/core/src/__tests__/enums.spec.ts`

- [ ] **Step 1: Failing test**

```ts
class Todo extends Model({
  tableName: 'todos',
  init: (p: { status: string }) => p,
  enums: { status: ['open', 'closed'] as const },
}) {}

it('enum predicate returns CollectionQuery', () => {
  const q = Todo.open();
  expect(q.state.filter).toEqual({ status: 'open' });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Find the existing `enums` handling**

Run: `grep -n "enums" packages/core/src/Model.ts`

The current code generates `static <value>()` returning a subclass. Replace with `static <value>() { return CollectionQuery.fromModel(this).filterBy({ [column]: value }); }`. Mirror onto the per-model `CollectionQuery` subclass.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/__tests__/enums.spec.ts
git commit -m "core: enum predicates produce CollectionQuery; chain on builder"
```

---

## Phase 4 — Single-record terminals

### Task 16: `first` / `last` on `CollectionQuery` produce `InstanceQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Create: `packages/core/src/__tests__/queryTransitions.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { InstanceQuery } from '../query/InstanceQuery.js';
// …
it('first() returns InstanceQuery with terminalKind first', () => {
  const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true }).first();
  expect(q).toBeInstanceOf(InstanceQuery);
  expect(q.terminalKind).toBe('first');
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement on `CollectionQuery`**

```ts
import { InstanceQuery, type TerminalKind } from './InstanceQuery.js';

first(): InstanceQuery {
  return new InstanceQuery(this.model, 'first', { ...this.state, limit: 1 });
}
last(): InstanceQuery {
  // last = first with reversed order
  const reversed = this.reverse();
  return new InstanceQuery(this.model, 'last', { ...reversed.state, limit: 1 });
}
```

- [ ] **Step 4: Update `InstanceQuery` constructor signature to take state instead of execute callback (mirror the CollectionQuery refactor in Task 8)**

```ts
export class InstanceQuery<Result = unknown> implements PromiseLike<Result> {
  constructor(
    public readonly model: ModelLike,
    public readonly terminalKind: TerminalKind,
    public readonly state: QueryState,
  ) {}
  // materialize stub returns undefined for now
}
```

- [ ] **Step 5: Run — pass**

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/query/InstanceQuery.ts packages/core/src/__tests__/queryTransitions.spec.ts
git commit -m "core(query): first/last transition to InstanceQuery"
```

---

### Task 17: `findBy` / `find` / `findOrFail` on `CollectionQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/queryTransitions.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
it('findBy returns InstanceQuery scoped by the filter', () => {
  const q = CollectionQuery.fromModel(Todo as any).findBy({ id: 1 });
  expect(q.terminalKind).toBe('findBy');
  expect(q.state.filter).toEqual({ id: 1 });
});

it('find narrows by primary key', () => {
  const q = CollectionQuery.fromModel(Todo as any).find(1);
  expect(q.terminalKind).toBe('find');
  expect(q.state.filter).toEqual({ id: 1 });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

```ts
findBy(filter: Filter<any>): InstanceQuery {
  const narrowed = this.filterBy(filter);
  return new InstanceQuery(this.model, 'findBy', { ...narrowed.state, limit: 1 });
}
find(id: string | number): InstanceQuery {
  const pk = Object.keys(this.model.keys)[0] ?? 'id';
  const narrowed = this.filterBy({ [pk]: id } as Filter<any>);
  return new InstanceQuery(this.model, 'find', { ...narrowed.state, limit: 1 });
}
findOrFail(filter: Filter<any>): InstanceQuery {
  const narrowed = this.filterBy(filter);
  return new InstanceQuery(this.model, 'findOrFail', { ...narrowed.state, limit: 1 });
}
```

Then forward from `Model.ts` static methods:

```ts
static findBy<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
  return CollectionQuery.fromModel(this as any).findBy(filter);
}
static find<M extends typeof ModelClass>(this: M, id: number | string) {
  return CollectionQuery.fromModel(this as any).find(id);
}
static findOrFail<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
  return CollectionQuery.fromModel(this as any).findOrFail(filter);
}
```

Remove the old `async findBy`, `async find`, `async findOrFail` bodies.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/Model.ts packages/core/src/__tests__/queryTransitions.spec.ts
git commit -m "core(query): findBy/find/findOrFail transition to InstanceQuery"
```

---

### Task 18: `findOrBuild` / `firstOrCreate` / `updateOrCreate` await internally

**Files:**
- Modify: `packages/core/src/Model.ts`

- [ ] **Step 1: Verify these helpers still type-check**

The existing implementations (Model.ts ~1656–1686) call `this.findBy(filter)` and `await` the result. Since `findBy` now returns an `InstanceQuery` (which is thenable), these should keep working. Run the existing test suite:

```bash
pnpm --filter @next-model/core test persistenceErgonomics.spec.ts
```

- [ ] **Step 2: Fix any type errors by adjusting the `await` sites**

If the `as Promise<…>` casts break, replace with `as InstanceType<M> | undefined`.

- [ ] **Step 3: Run — pass**

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/Model.ts
git commit -m "core: findOrBuild/firstOrCreate/updateOrCreate adapted to InstanceQuery returns"
```

---

## Phase 5 — Aggregates and column projection

### Task 19: `count` returns `ScalarQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/Model.ts`
- Create: `packages/core/src/__tests__/queryAggregates.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { ScalarQuery } from '../query/ScalarQuery.js';

it('count returns ScalarQuery awaitable to a number', async () => {
  const q = Todo.filterBy({ active: true }).count();
  expect(q).toBeInstanceOf(ScalarQuery);
  expect(typeof (await q)).toBe('number');
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement on `CollectionQuery`**

```ts
import { ScalarQuery } from './ScalarQuery.js';
// …
count(): ScalarQuery<number> {
  return new ScalarQuery(this.model, this.state, { kind: 'aggregate', op: 'count' });
}
```

(Update `ScalarQuery` constructor to accept `(model, state, projection)`.)

Forward from `Model.ts`:

```ts
static count<M extends typeof ModelClass>(this: M) {
  return CollectionQuery.fromModel(this as any).count();
}
```

Remove the old `async count` body.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/query/ScalarQuery.ts packages/core/src/Model.ts packages/core/src/__tests__/queryAggregates.spec.ts
git commit -m "core(query): count returns ScalarQuery"
```

---

### Task 20: `sum` / `average` / `minimum` / `maximum` return `ScalarQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/Model.ts`
- Modify: `packages/core/src/__tests__/queryAggregates.spec.ts`

- [ ] **Step 1: Tests** for each — `sum`, `average`, `minimum`, `maximum` — assert `ScalarQuery` returned and awaitable.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

```ts
sum(col: string): ScalarQuery<number> {
  return new ScalarQuery(this.model, this.state, { kind: 'aggregate', op: 'sum', column: col });
}
average(col: string): ScalarQuery<number> { /* op: 'avg' */ }
minimum(col: string): ScalarQuery<unknown> { /* op: 'min' */ }
maximum(col: string): ScalarQuery<unknown> { /* op: 'max' */ }
```

Forward from `Model.ts` similarly to `count`.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/query/ScalarQuery.ts packages/core/src/Model.ts packages/core/src/__tests__/queryAggregates.spec.ts
git commit -m "core(query): sum/average/minimum/maximum return ScalarQuery"
```

---

### Task 21: `pluck` returns `ColumnQuery` / `ScalarQuery`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/query/InstanceQuery.ts`
- Modify: `packages/core/src/Model.ts`
- Create: `packages/core/src/__tests__/queryPluck.spec.ts`

- [ ] **Step 1: Tests**

```ts
it('CollectionQuery.pluck returns ColumnQuery resolving to an array', async () => {
  const arr = await Todo.filterBy({ active: true }).pluck('email');
  expect(Array.isArray(arr)).toBe(true);
});

it('InstanceQuery.pluck returns ScalarQuery resolving to a single value', async () => {
  const v = await Todo.first().pluck('email');
  expect(v === undefined || typeof v === 'string').toBe(true);
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

On `CollectionQuery`:

```ts
import { ColumnQuery } from './ColumnQuery.js';
pluck(column: string): ColumnQuery<unknown[]> {
  return new ColumnQuery(this.model, column, this.state, { kind: 'column', column });
}
```

(Update `ColumnQuery` constructor to take `(model, column, state, projection)`.)

On `InstanceQuery`:

```ts
import { ScalarQuery } from './ScalarQuery.js';
pluck(column: string): ScalarQuery<unknown> {
  return new ScalarQuery(this.model, { ...this.state, limit: 1 }, { kind: 'column', column });
}
```

Forward `pluck` from `Model.ts` to `CollectionQuery.fromModel(this).pluck(col)`.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/query/InstanceQuery.ts packages/core/src/query/ColumnQuery.ts packages/core/src/query/ScalarQuery.ts packages/core/src/Model.ts packages/core/src/__tests__/queryPluck.spec.ts
git commit -m "core(query): pluck returns ColumnQuery on collections, ScalarQuery on instances"
```

---

## Phase 6 — Default terminal lowering

### Task 22: `lower.ts` — compile a builder into a `QueryScopedSpec`

**Files:**
- Create: `packages/core/src/query/lower.ts`
- Create: `packages/core/src/__tests__/lower.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { lower } from '../query/lower.js';
import { CollectionQuery } from '../query/CollectionQuery.js';

it('lowers a flat CollectionQuery to a no-parent-scope QueryScopedSpec', () => {
  const q = CollectionQuery.fromModel(Todo as any).filterBy({ active: true });
  const spec = lower(q, 'rows');
  expect(spec.parentScopes).toEqual([]);
  expect(spec.target.tableName).toBe('todos');
  expect(spec.filter).toEqual({ active: true });
});

it('lowers a parent chain into ParentScope entries (closest parent last)', () => {
  // Set up Todo + User association manually and build a chain:
  // CollectionQuery on Todo with parent = InstanceQuery on User (findBy email)
  // — see test fixture in source.
  const userInst = User.findBy({ email: 'a@b' });
  const todosForUser = CollectionQuery.fromModel(Todo as any).withParent(userInst, {
    childColumn: 'userId', parentColumn: 'id', direction: 'hasMany',
  });
  const spec = lower(todosForUser, 'rows');
  expect(spec.parentScopes).toHaveLength(1);
  expect(spec.parentScopes[0].link.direction).toBe('hasMany');
});
```

(Add `CollectionQuery.withParent(upstream, link)` method as a helper for these tests — used later by association accessors in Task 26+.)

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

```ts
// packages/core/src/query/lower.ts
import type { Projection, QueryScopedSpec } from '../types.js';
import type { CollectionQuery } from './CollectionQuery.js';
import type { InstanceQuery } from './InstanceQuery.js';
import type { QueryState } from './QueryState.js';

type AnyBuilder = CollectionQuery<any> | InstanceQuery<any>;

function flattenParents(state: QueryState): QueryScopedSpec['parentScopes'] {
  const scopes: QueryScopedSpec['parentScopes'] = [];
  let current = state.parent;
  while (current) {
    const upstream = current.upstream.state;
    scopes.unshift({
      parentTable: upstream.Model.tableName,
      parentKeys: upstream.Model.keys,
      parentFilter: upstream.filter,
      parentOrder: upstream.order.length > 0 ? upstream.order : undefined,
      parentLimit: upstream.limit,
      link: current.via,
    });
    current = upstream.parent;
  }
  return scopes;
}

export function lower(builder: AnyBuilder, projection: Projection): QueryScopedSpec {
  const state = builder.state;
  return {
    target: { tableName: state.Model.tableName, keys: state.Model.keys },
    filter: state.filter,
    order: state.order.length > 0 ? state.order : undefined,
    limit: state.limit,
    skip: state.skip,
    selectedFields: state.selectedFields,
    pendingJoins: state.pendingJoins,
    parentScopes: flattenParents(state),
    projection,
  };
}
```

Add `withParent` to `CollectionQuery`:

```ts
import type { AssociationLink } from './QueryState.js';
withParent(upstream: AnyBuilder, link: AssociationLink): this {
  return this.with({
    parent: { upstream: { state: upstream.state, terminalKind: (upstream as any).terminalKind }, via: link },
  });
}
```

(Same on `InstanceQuery`.)

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/lower.ts packages/core/src/query/CollectionQuery.ts packages/core/src/query/InstanceQuery.ts packages/core/src/__tests__/lower.spec.ts
git commit -m "core(query): lower compiles builder + parent chain to QueryScopedSpec"
```

---

### Task 23: `CollectionQuery.materialize` calls `connector.queryScoped`

**Files:**
- Modify: `packages/core/src/query/CollectionQuery.ts`
- Modify: `packages/core/src/__tests__/collectionQuery.spec.ts`

- [ ] **Step 1: Tests**

```ts
it('awaiting CollectionQuery materializes via connector.queryScoped', async () => {
  const todos = await Todo.filterBy({ active: true });
  expect(Array.isArray(todos)).toBe(true);
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

```ts
import { lower } from './lower.js';

protected async materialize(): Promise<Items> {
  const spec = lower(this, 'rows');
  const M = this.state.Model as any;
  const rows = await M.connector.queryScoped(spec);
  return this.hydrate(rows as Dict<any>[]) as unknown as Items;
}

protected hydrate(rows: Dict<any>[]): InstanceType<typeof ModelClass>[] {
  const M = this.state.Model as any;
  // Same key-extraction pattern used by the existing Model.all() materializer.
  return rows.map((row) => {
    const keys: Dict<any> = {};
    for (const k in M.keys) { keys[k] = row[k]; delete row[k]; }
    return new M(row, keys);
  });
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/CollectionQuery.ts packages/core/src/__tests__/collectionQuery.spec.ts
git commit -m "core(query): CollectionQuery.materialize via connector.queryScoped"
```

---

### Task 24: `InstanceQuery.materialize` (LIMIT 1, missing-record policy)

**Files:**
- Modify: `packages/core/src/query/InstanceQuery.ts`
- Modify: `packages/core/src/__tests__/instanceQuery.spec.ts`

- [ ] **Step 1: Tests** — assert `await Todo.findBy({id: nonExistent})` returns undefined; `await Todo.find(nonExistent)` throws `NotFoundError`.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement** mirroring Task 23 but call `lower(this, 'rows')`, take `rows[0]`, apply terminal-kind missing-record policy from Task 4.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/InstanceQuery.ts packages/core/src/__tests__/instanceQuery.spec.ts
git commit -m "core(query): InstanceQuery.materialize via queryScoped with LIMIT 1"
```

---

### Task 25: `ColumnQuery.materialize` and `ScalarQuery.materialize`

**Files:**
- Modify: `packages/core/src/query/ColumnQuery.ts`
- Modify: `packages/core/src/query/ScalarQuery.ts`
- Modify: `packages/core/src/__tests__/queryPluck.spec.ts`
- Modify: `packages/core/src/__tests__/queryAggregates.spec.ts`

- [ ] **Step 1: Tests** — each builder resolves to its respective concrete value when awaited (via the in-memory MemoryConnector populated in the test).

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement** — `materialize` calls `connector.queryScoped(lower(this, this.projection))` and returns the result directly. For `ScalarQuery` with `op: 'count'`, the result is a number; for `op: 'min' | 'max'`, the connector may return `undefined`.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/ColumnQuery.ts packages/core/src/query/ScalarQuery.ts packages/core/src/__tests__/
git commit -m "core(query): ColumnQuery and ScalarQuery materialize via queryScoped"
```

---

### Task 26: `all()` returns `CollectionQuery` (replacing `Promise<Records[]>`)

**Files:**
- Modify: `packages/core/src/Model.ts`
- Modify: existing tests that depended on `await Model.all()`

- [ ] **Step 1: Locate the existing `static async all<M…>` body**

Run: `grep -n "async all" packages/core/src/Model.ts`

- [ ] **Step 2: Replace it**

```ts
static all<M extends typeof ModelClass>(this: M) {
  return CollectionQuery.fromModel(this as any);
}
```

- [ ] **Step 3: Run the full core test suite**

Run: `pnpm --filter @next-model/core test`
Expected: PASS. `await Model.all()` continues to work because `CollectionQuery` is thenable.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/Model.ts
git commit -m "core: Model.all returns CollectionQuery (still thenable to records)"
```

---

## Phase 7 — Association traversal

### Task 27: `InstanceQuery` accessor properties from declared associations

**Files:**
- Modify: `packages/core/src/query/InstanceQuery.ts`
- Create: `packages/core/src/__tests__/instanceQueryAssociations.spec.ts`

- [ ] **Step 1: Failing tests** — set up `User` and `Todo` with `associations: { todos: { hasMany: …, foreignKey: 'userId' } }` (on User) and `{ user: { belongsTo: …, foreignKey: 'userId' } }` (on Todo), then assert:

```ts
it('User.findBy(...).todos returns CollectionQuery scoped by parent link', () => {
  const q = User.findBy({ email: 'a@b' }).todos;
  expect(q).toBeInstanceOf(CollectionQuery);
  expect(q.state.parent?.via.direction).toBe('hasMany');
});

it('Todo.first().user returns InstanceQuery for User', () => {
  const q = Todo.first().user;
  expect(q).toBeInstanceOf(InstanceQuery);
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Install accessor properties on `InstanceQuery` instances during construction**

In the `InstanceQuery` constructor, after the field assignments:

```ts
const associations = (this.model as any).associations as
  | Record<string, AssociationDefinition>
  | undefined;
if (associations) {
  for (const name in associations) {
    if (Object.getOwnPropertyDescriptor(this, name)) continue;
    Object.defineProperty(this, name, {
      get: () => createAssociationQuery(this, associations[name]),
      enumerable: false,
      configurable: true,
    });
  }
}
```

Implement `createAssociationQuery(upstream, spec)` (in a new helper file `packages/core/src/query/associationQuery.ts`):

```ts
import { resolveAssociationTarget } from '../Model.js';

export function createAssociationQuery(upstream: InstanceQuery, spec: AssociationDefinition) {
  const resolved = resolveAssociationTarget(spec);
  const target = resolved.target;
  const direction = 'belongsTo' in spec ? 'belongsTo' : 'hasMany' in spec ? 'hasMany' : 'hasOne';
  const link = {
    childColumn: resolved.childColumn,
    parentColumn: resolved.parentColumn,
    direction,
  } as const;
  if (direction === 'hasMany') {
    return CollectionQuery.fromModel(target).withParent(upstream, link);
  }
  // belongsTo / hasOne — return InstanceQuery with terminalKind 'first'
  const base = CollectionQuery.fromModel(target).withParent(upstream, link);
  return new InstanceQuery(target, 'first', { ...base.state, limit: 1 });
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/InstanceQuery.ts packages/core/src/query/associationQuery.ts packages/core/src/__tests__/instanceQueryAssociations.spec.ts
git commit -m "core(query): InstanceQuery accessor props from declared associations"
```

---

### Task 28: Polymorphic association traversal

**Files:**
- Modify: `packages/core/src/query/associationQuery.ts`
- Create: `packages/core/src/__tests__/instanceQueryPolymorphic.spec.ts`

- [ ] **Step 1: Failing test** — comment-on-post polymorphic example.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Extend `createAssociationQuery` to handle `polymorphic`**

When the spec carries `polymorphic`, append `{ [typeKey]: typeValue }` to the parent (or child) filter inside the `withParent` link. Mirror the logic in the existing instance helpers (`belongsTo`/`hasMany`/`hasOne` ~2000–2070 in `Model.ts`).

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/associationQuery.ts packages/core/src/__tests__/instanceQueryPolymorphic.spec.ts
git commit -m "core(query): polymorphic association traversal"
```

---

### Task 29: `hasManyThrough` traversal

**Files:**
- Modify: `packages/core/src/query/associationQuery.ts`
- Create: `packages/core/src/__tests__/instanceQueryThrough.spec.ts`

- [ ] **Step 1: Failing test** — `User.first().roles` where `roles` is `hasManyThrough(Role, UserRole)`.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

`hasManyThrough` lowers as a two-link chain: target → through (filter on `targetForeignKey`) → parent. Use `withParent` twice to build the nested chain, or extend `ParentScope` to optionally carry a "through" hop. Pick the recursive `withParent` form.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/associationQuery.ts packages/core/src/__tests__/instanceQueryThrough.spec.ts
git commit -m "core(query): hasManyThrough traversal as nested withParent chain"
```

---

## Phase 8 — Subquery filter values

### Task 30: Lowering subquery values to nested `ParentScope` entries

**Files:**
- Modify: `packages/core/src/query/lower.ts`
- Modify: `packages/core/src/query/QueryState.ts` (`mergeFilters` recognizes builder values)
- Create: `packages/core/src/__tests__/subqueryFilterValues.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
it('CollectionQuery as filter value lowers to a parentScope', async () => {
  const cutoff = new Date('2026-01-01');
  const result = await Todo.filterBy({
    userId: User.filterBy({ lastSignInAt: { $gt: cutoff } }),
  });
  // Validate via the recording connector: check the queryScoped call has parentScopes[0].
});

it('ScalarQuery embedded in $gt creates an aggregate parentScope', async () => {
  const result = await Order.filterBy({
    total: { $gt: OrderItem.filterBy({ id: 99 }).sum('amount') },
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement**

Walk the `filter` tree (recursively descending into `$and` / `$or` / `$not`); for any value that's an instance of `CollectionQuery` / `InstanceQuery` / `ColumnQuery` / `ScalarQuery`, replace it in-place with a placeholder operator and emit a `ParentScope` entry on the side. The lowered `QueryScopedSpec` carries both the cleaned filter and the parent scopes.

For each builder type the link / projection differs:
- `CollectionQuery` → projection `{ kind: 'pk' }` (or column when `pluck` already applied), op `$in`.
- `InstanceQuery` → same projection, op `$eq` with `parentLimit: 1`.
- `ColumnQuery` → projection `{ kind: 'column', column }`, op `$in`.
- `ScalarQuery` → projection `{ kind: 'aggregate', … }`, op `$eq` (or whatever operator wrapped it — `$gt`, `$lt`, …).

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/lower.ts packages/core/src/query/QueryState.ts packages/core/src/__tests__/subqueryFilterValues.spec.ts
git commit -m "core(query): lower subquery filter values to ParentScope entries"
```

---

### Task 31: `baseQueryScoped` handles aggregate parent scopes

**Files:**
- Modify: `packages/core/src/query/baseQueryScoped.ts`
- Modify: `packages/core/src/__tests__/baseQueryScoped.spec.ts`

- [ ] **Step 1: Test** — aggregate ParentScope (e.g., `sum`) resolves to the scalar value and is spliced into the outer filter as `$gt: <value>`.

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Extend `resolveParent`** — switch on `parent.projection.kind`. For `'pk'` / `'column'`: existing path. For `{ kind: 'aggregate' }`: call `connector.aggregate(...)` (or `connector.count(...)`) and return the scalar; the caller splices as `$eq` / `$gt` / etc. depending on the operator carrier.

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/query/baseQueryScoped.ts packages/core/src/__tests__/baseQueryScoped.spec.ts
git commit -m "core(query): baseQueryScoped resolves aggregate parent scopes"
```

---

## Phase 9 — Native SQL connector overrides

The pattern: each native-SQL connector adds a `queryScoped` method that emits one statement using nested `WHERE col IN (SELECT …)` (or `= (SELECT … LIMIT 1)`) for each parent scope, and the appropriate SELECT projection (rows / pk / column / aggregate). For connectors with `queryWithJoins`, the existing pending-join path stays — `queryScoped` calls `queryWithJoins` for the join-clause portion when `pendingJoins.length > 0`.

### Task 32: Knex connector — `queryScoped`

**Files:**
- Modify: `packages/knex-connector/src/KnexConnector.ts`
- Modify: `packages/knex-connector/src/__tests__/`

- [ ] **Step 1: Add a failing test asserting nested-subquery SQL is emitted**

Use the existing test scaffolding (recording the SQL Knex generates — the package has tests for `queryWithJoins`; mirror the assertion style).

```ts
it('emits one SQL statement with nested WHERE IN for parent-scope traversal', async () => {
  const sql = await captureSql(() =>
    Todo.findBy({ id: 1 }).attachments.filterBy({ fileType: 'png' }),
  );
  expect(sql).toMatch(/SELECT .* FROM .*attachments.* WHERE .*todoId IN \(/);
  expect(sql).toMatch(/SELECT .*id.* FROM .*todos.* LIMIT 1\)/);
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement `queryScoped`**

```ts
import type { QueryScopedSpec } from '@next-model/core';

async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
  const knex = this.knex;
  const builder = knex(spec.target.tableName);
  // Apply parent scopes as nested WHERE IN
  for (const parent of spec.parentScopes) {
    const sub = knex(parent.parentTable).select(parent.link.parentColumn);
    if (parent.parentFilter) applyFilter(sub, parent.parentFilter);
    if (parent.parentOrder) applyOrder(sub, parent.parentOrder);
    if (parent.parentLimit !== undefined) sub.limit(parent.parentLimit);
    builder.whereIn(parent.link.childColumn, sub);
  }
  if (spec.filter) applyFilter(builder, spec.filter);
  if (spec.order) applyOrder(builder, spec.order);
  if (spec.limit !== undefined) builder.limit(spec.limit);
  if (spec.skip !== undefined) builder.offset(spec.skip);
  // Apply pendingJoins via existing queryWithJoins helper if non-empty
  if (spec.pendingJoins.length > 0) {
    return this.queryWithJoins!({
      parent: { tableName: spec.target.tableName, filter: spec.filter, order: spec.order, limit: spec.limit, skip: spec.skip },
      joins: spec.pendingJoins,
    });
  }
  switch (true) {
    case spec.projection === 'rows':
      return builder.select('*');
    case typeof spec.projection === 'object' && spec.projection.kind === 'pk':
      return builder.pluck(Object.keys(spec.target.keys)[0] ?? 'id');
    case typeof spec.projection === 'object' && spec.projection.kind === 'column':
      return builder.pluck(spec.projection.column);
    case typeof spec.projection === 'object' && spec.projection.kind === 'aggregate': {
      const op = spec.projection.op;
      if (op === 'count') return Number(await builder.count('*', { as: 'c' }).first().then((r: any) => r.c));
      const fn = op === 'avg' ? 'avg' : op === 'sum' ? 'sum' : op === 'min' ? 'min' : 'max';
      return Number(await builder[fn](spec.projection.column!).first().then((r: any) => Object.values(r)[0]));
    }
  }
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/knex-connector
git commit -m "knex-connector: queryScoped emits nested subqueries in one statement"
```

---

### Task 33–37: Same pattern for the remaining native SQL connectors

For each connector, replicate Task 32's pattern using its native query-builder primitives. The only differences are the SQL dialect helpers — the structural shape is identical.

- **Task 33:** `packages/aurora-data-api-connector/src/DataApiConnector.ts`
- **Task 34:** `packages/postgres-connector/src/PostgresConnector.ts`
- **Task 35:** `packages/sqlite-connector/src/SqliteConnector.ts`
- **Task 36:** `packages/mysql-connector/src/MysqlConnector.ts`
- **Task 37:** `packages/mariadb-connector/src/MariaDbConnector.ts`

For each:

- [ ] **Step 1: Write failing test** — assert single-statement SQL output for a parent-scope traversal.
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement `queryScoped`** — use the connector's own query-builder API (`pg-pool`, `better-sqlite3`, `mysql2`, etc.) to render `WHERE col IN (SELECT … FROM … WHERE … ORDER BY … LIMIT 1)`. Aurora Data API: emit parameterised SQL with `$N` placeholders. The structural body is identical to Task 32.
- [ ] **Step 4: Run — pass.**
- [ ] **Step 5: Commit:** `git commit -m "<connector>: queryScoped emits nested subqueries in one statement"`.

---

## Phase 10 — Instance accessors → query builders

### Task 38: Auto-installed instance association accessors return query builders

**Files:**
- Modify: `packages/core/src/Model.ts` (lines 1870–1888 and `resolveAutoAssociation`)
- Modify: `packages/core/src/__tests__/Model.spec.ts`

- [ ] **Step 1: Failing test**

```ts
it('user.todos on a materialized instance returns CollectionQuery', async () => {
  const u = await User.first();
  expect(u!.todos).toBeInstanceOf(CollectionQuery);
});
```

- [ ] **Step 2: Run — fail (returns Promise)**

- [ ] **Step 3: Replace `resolveAutoAssociation`** — instead of calling `record.belongsTo(...)` etc., construct a `CollectionQuery` (for `hasMany`) or `InstanceQuery` (for `belongsTo` / `hasOne`) using `withParent` against an `InstanceQuery` synthesized from the record's primary key.

```ts
function resolveAutoAssociation(record: ModelClass, spec: AssociationDefinition) {
  const M = record.constructor as typeof ModelClass;
  const pk = Object.keys(M.keys)[0] ?? 'id';
  // Synthesize an upstream InstanceQuery that resolves to the record (used for parent-scope linkage)
  const upstreamState = {
    Model: M,
    filter: { [pk]: (record as any)[pk] } as Filter<any>,
    order: [], limit: 1, selectedIncludes: [], includeStrategy: 'preload' as const,
    pendingJoins: [], softDelete: M.softDelete,
  };
  const upstream = new InstanceQuery(M, 'find', upstreamState);
  return createAssociationQuery(upstream, spec);
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/__tests__/Model.spec.ts
git commit -m "core: instance association accessors return query builders, not Promises"
```

---

### Task 39: `attributes` becomes a getter

**Files:**
- Modify: `packages/core/src/Model.ts`
- Modify: every internal call site (search results below)

- [ ] **Step 1: Find every internal `.attributes()` call**

Run: `grep -n "\.attributes()" packages/core/src/Model.ts`

You'll find ~10 sites (constructor at 1828, store-accessor get/set at 1859/1863, applyIncludes at 312/323/334, toJSON at 1905, pick at 1909, omit at 1918).

- [ ] **Step 2: Failing test**

```ts
it('attributes is a getter (no parens)', async () => {
  const u = await User.first();
  expect(typeof (u as any).attributes).toBe('object');     // getter, not function
  expect(JSON.stringify(u!.attributes)).toBe(JSON.stringify(u!.toJSON()));
});

it('attributes excludes association accessors', async () => {
  const u = await User.first();
  const json = JSON.stringify(u!.attributes);
  expect(JSON.parse(json).todos).toBeUndefined();
});
```

- [ ] **Step 3: Run — fail**

- [ ] **Step 4: Convert `attributes()` method to `attributes` getter**

```ts
get attributes(): Dict<any> {
  return { ...this.persistentProps, ...this.changedProps, ...this.keys };
}
```

Update every internal caller from `this.attributes()` / `record.attributes()` to `this.attributes` / `record.attributes`. Same in any sibling package call sites.

Run: `grep -rn "\.attributes()" packages/`

Update all hits. Most are in `packages/core/src/Model.ts`; a few may be in `graphql-api` / `express-rest-api`.

- [ ] **Step 5: Run the full repo test suite**

Run: `pnpm test -r`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/
git commit -m "core: attributes is a getter; update every internal call site"
```

---

### Task 40: Remove obsolete subclass-static state from `Model`

**Files:**
- Modify: `packages/core/src/Model.ts`

- [ ] **Step 1: Identify state slots that are now redundant**

`selectedFilters` (no longer set anywhere), `pendingJoins` (only seeded on the base class for `unscoped()` to reset to `[]`; the actual chain state lives on `CollectionQuery.state.pendingJoins`), `selectedIncludes`, etc.

- [ ] **Step 2: Decide what to keep**

Keep: anything that represents the *defaults* for `CollectionQuery.fromModel(M)` to read (the factory's default scope). Specifically: `filter`, `order`, `limit`, `skip`, `selectedFields` (when factory-set), `softDelete`, `includeStrategy`, `associations`, `tableName`, `keys`, `connector`, `init`, `validators`, `callbacks`, `enums`, `inheritColumn` etc. Remove: `pendingJoins`, `selectedIncludes` defaults (on the base class), `havingPredicate` (on the base class).

- [ ] **Step 3: Update `CollectionQuery.fromModel` to seed empty arrays/undefined for the removed slots**

- [ ] **Step 4: Run the full core test suite**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/query/CollectionQuery.ts
git commit -m "core: drop obsolete subclass-static slots after CollectionQuery refactor"
```

---

## Phase 11 — Bare class invariant + cleanup

### Task 41: Document and test the bare-class non-thenable invariant

**Files:**
- Modify: `packages/core/src/__tests__/Model.spec.ts`

- [ ] **Step 1: Add a documented test**

```ts
it('await on the bare Model class does not return records (use .all())', async () => {
  const result = await Todo;
  // resolves to the class object itself — runtime no-op, documented as misuse
  expect(result).toBe(Todo);
});
```

- [ ] **Step 2: Run — pass (no implementation needed; invariant is documented behavior)**

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/__tests__/Model.spec.ts
git commit -m "core: document bare-class non-thenable invariant"
```

---

### Task 42: Cleanup — remove dead code and types

**Files:**
- Modify: `packages/core/src/Model.ts`
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Search for unused `ScopeFn`, `ScopeMap`, `ScopesToMethods` types**

If still referenced by callers, leave them; otherwise delete.

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm --filter @next-model/core typecheck && pnpm --filter @next-model/core test`

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/Model.ts packages/core/src/types.ts
git commit -m "core: drop unused scope-callback types after filter-literal scope migration"
```

---

## Phase 12 — Conformance test additions

For each new test case below, append to `packages/core/src/__tests__/conformance.ts` (which the connector packages already import and run against their own `Connector` instances).

### Task 43: One-level parent-scope traversal conformance

**Files:**
- Modify: `packages/core/src/__tests__/conformance.ts`

- [ ] **Step 1: Add the test case**

```ts
it('parent-scope traversal: User.findBy({email}).todos returns the user\'s todos', async () => {
  const user = await User.create({ email: 'a@b' });
  await Todo.create({ userId: user.id, title: 't1' });
  await Todo.create({ userId: user.id, title: 't2' });
  const todos = await User.findBy({ email: 'a@b' }).todos;
  expect(todos).toHaveLength(2);
});
```

- [ ] **Step 2: Run against MemoryConnector** (default)
- [ ] **Step 3: Run against every other connector** via the existing per-package conformance import.
- [ ] **Step 4: Commit**

```bash
git add packages/core/src/__tests__/conformance.ts
git commit -m "test(conformance): one-level parent-scope traversal"
```

---

### Task 44: Multi-level traversal conformance

- [ ] **Step 1: Test `Order.first().customer.address.country`** (chain of belongsTos and hasOnes; introduce required fixtures in conformance setup).
- [ ] **Step 2–4: Same flow.**

```bash
git commit -m "test(conformance): multi-level association traversal"
```

---

### Task 45: Subquery filter value conformance

- [ ] **Step 1: Test `Todo.filterBy({ userId: User.filterBy({...}) })`**
- [ ] **Step 2–4: Same flow.**

```bash
git commit -m "test(conformance): subquery as filter value with implicit pk projection"
```

---

### Task 46: Aggregate subquery conformance

- [ ] **Step 1: Test `Order.filterBy({ total: { $gt: OrderItem.filterBy({...}).sum('amount') } })`**
- [ ] **Step 2–4: Same flow.**

```bash
git commit -m "test(conformance): aggregate subquery as scalar filter value"
```

---

### Task 47: `pluck`-as-filter-value conformance

- [ ] **Step 1: Test `Todo.filterBy({ ownerEmail: User.filterBy({...}).pluck('email') })`**
- [ ] **Step 2–4: Same flow.**

```bash
git commit -m "test(conformance): pluck-as-filter-value with column projection"
```

---

### Task 48: `attributes` getter conformance

- [ ] **Step 1: Test that `(await User.first()).attributes` round-trips through `JSON.stringify` cleanly.**
- [ ] **Step 2–4: Same flow.**

```bash
git commit -m "test(conformance): attributes getter is a JSON-safe POJO"
```

---

## Phase 13 — Documentation

### Task 49: Update core README

**Files:**
- Modify: `packages/core/README.md`

- [ ] **Step 1: Rewrite the Querying / Fetching / Aggregates / Associations sections**

Replace eager-execution examples (`const todos = await Todo.all();`) with builder-chain ones. Add the new examples:

- `await User.findBy({email}).todos.open` — single SQL parent-scope traversal.
- `Todo.filterBy({ userId: User.filterBy({...}) })` — subquery filter value.
- `Order.filterBy({ total: { $gt: OrderItem.filterBy({...}).sum('amount') } })` — aggregate subquery.
- `Todo.first().user` — instance traversal to belongsTo.
- Filter-literal scopes vs static-method scopes.
- The bare-class non-thenable invariant.

- [ ] **Step 2: Commit**

```bash
git add packages/core/README.md
git commit -m "docs(core): builder-chain examples; subquery filter values; instance traversal"
```

---

### Task 50: Append HISTORY.md vNext bullet

**Files:**
- Modify: `packages/core/HISTORY.md`

- [ ] **Step 1: Add one bullet under `## vNext`**

> - Promise-like chainable query builders. `Model.filterBy(...)`, `Model.findBy(...)`, association accessors, and aggregate / pluck terminals now return deferred `CollectionQuery` / `InstanceQuery` / `ColumnQuery` / `ScalarQuery` builders that compose end-to-end. Awaiting executes one query — `await User.findBy({email}).todos.open` issues a single SQL statement on subquery-capable connectors. Subqueries (collection / instance / pluck / aggregate) are also valid `filterBy(...)` values: `Todo.filterBy({ userId: User.filterBy({lastSignInAt: {$gt: cutoff}}) })`. Associations declared in the factory's `associations: {…}` literal expose paren-less accessors on instance builders and on materialized instances; explicit instance methods (`user() { return this.belongsTo(User); }`) still work for one-off shapes. Named scopes are now declarative filter literals (`scopes: { active: { $notNull: 'lastSignInAt' } }`); use static methods on the user's class for complex multi-clause logic. New `Connector.queryScoped(spec)` entry point with a `baseQueryScoped` Model-side fallback; native-SQL connectors (Knex / Aurora / pg / sqlite / mysql / mariadb) override to emit one statement; KV/document connectors inherit the fallback transparently. `attributes` is now an instance getter (was a method).

- [ ] **Step 2: Commit**

```bash
git add packages/core/HISTORY.md
git commit -m "history(vNext): promise-like chainable query builders"
```

---

## Self-Review (run before handing off)

1. **Spec coverage.** Each spec section maps to tasks:
   - Architecture (4 builder types) → Tasks 3, 4, 5
   - Default scope seeding → Task 8
   - Chain methods on CollectionQuery → Tasks 9–12, 14–15
   - Single-record terminals → Tasks 16–18
   - Aggregates + pluck → Tasks 19–21
   - Lowering / connector contract → Tasks 1, 6, 7, 22–25, 32–37
   - Association traversal → Tasks 27–29, 38
   - Subquery filter values → Tasks 30, 31
   - `attributes` getter → Task 39
   - Bare-class invariant → Task 41
   - Conformance → Tasks 43–48
   - Docs → Tasks 49–50

2. **Placeholder scan.** Tasks 33–37 share Task 32's pattern — each step listed but the per-connector code differs only in dialect. Per the granularity note at the top of the plan, that's intentional, not a placeholder.

3. **Type consistency.** `QueryState` (Task 2), `QueryScopedSpec` (Task 1), `ParentScope` (Task 1), `Projection` (Task 1) — referenced consistently across tasks. Builder constructors take `(model, state)` for `CollectionQuery`/`InstanceQuery` and `(model, ...projection-args, state, projection)` for `ColumnQuery`/`ScalarQuery` — verified across Tasks 19, 21, 23, 25.

4. **Migration safety.** Phase 3 (Tasks 8–15) preserves the *static* method names on `Model`; existing tests using `await Model.<method>(...)` continue to compile because the returned builders are thenable. The only places that break are tests that explicitly assert `instanceof Promise` — caught in Task 13's "run the whole core test suite."
