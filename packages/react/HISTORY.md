# @next-model/react

## vNext

### Added

- **`.run()` terminal on `PendingResult<T>`.** Imperative counterpart to `.fetch()` / `.watch()` — returns a `Promise<T>` whose instances are store-tagged reactive shells. Safe to call from event handlers, mutation callbacks, or any non-render async code:

  ```ts
  const Task = useModel(TaskModel);
  const row = await Task.find(id).run();          // tagged shell
  await row.update({ title: 'new' });              // auto-publishes; watches refire
  ```

  Previously the only way to get a tagged instance was through a live `.watch(...)` — `Model.find(id)` outside a watch returned an untagged raw instance, silently losing reactivity on subsequent `.update()` / `.delete()` calls. `.run()` closes that gap and makes "look up by id then mutate" a first-class pattern.

- **Auto-refetch collection watches on filter-column mutations.** Mutations now broadcast `col:<table>:<column>` for each column whose persistent value actually changes. Collection watches walk their `filterBy` / `whereMissing` chain at mount, extract every column name the predicates reference, and subscribe to the matching column keys — refetching when any fires.

  This means `update({ archivedAt: new Date() })` against a watch with `filterBy({ $null: 'archivedAt' })` now correctly drops the row from the visible list (and the reverse — clearing `archivedAt` brings a previously-hidden row INTO the watch). No manual `useInvalidateKeys` call required for filter-flipping mutations.

  Supported predicate shapes: plain `{ col: value }`, `$null` / `$notNull` keyed by column name, `$in` / `$notIn` / `$between` keyed by column, recursive `$and` / `$or` arrays, and `$not`. Unknown `$`-operators are ignored.

  Mutated columns are computed *before* the call runs:
  - `update(patch)` — diff `patch` against `persistentProps` so only actually-changed columns broadcast.
  - `save()` — read `changedProps` keys.
  - `increment(col)` / `decrement(col)` — the arg names the column.

### Changed

- `useAsyncTerminal` and `useWatch` now share `adopt` / `decorate` from a new internal `adoptInstance` module — both paths reconcile against the store's identity map (previously `useAsyncTerminal`'s adopt was simpler and didn't soft-register, which meant instances from `.fetch()` could diverge from the canonical shell in the store).

## v1.1.6

## v1.1.5

## v1.1.4

## v1.1.2

### Added

- `orderBy` accepts the conventional `{ [col]: 'asc' | 'desc' }` shape alongside the strict `{ key, dir }` shape, inherited from `@next-model/core`'s chainable query builder. `useModel(M).orderBy({ createdAt: 'desc' })` works identically to `useModel(M).orderBy({ key: 'createdAt', dir: SortDirection.Desc })`.
- `useModel(M).findOrNull(id)` — null-on-miss counterpart to `find(id)`, inherited from `@next-model/core`.

## v1.1.1

### Added

- Sourcemap files (`dist/**/*.map`) are now included in the published tarball so downstream Vite / webpack / Rollup builds resolve stack frames inside `@next-model/react` to the original TypeScript source — no `ENOENT` warnings for `dist/index.js.map`. No runtime change.

## v1.1.0

## v1.0.0

### Added
- Initial release: `<NextModelProvider>`, `useModel`, `useInvalidateKeys`.
- Reactive instance shells; identity-mapped Store; refcounted watch lifecycle.
- Async terminals `{ data, isLoading, error }` and watch variants `{ ..., isRefetching }`.
- Sync `build()` terminal with stable shell + `reset(props?)`.

### Changed
- Terminal methods (`all`, `find`, `findBy`, `first`, `last`, `findOrFail`, `count`, `sum`, `min`, `max`, `avg`, `pluck`, `exists`) are now chain steps that return `PendingResult<T>` instead of invoking hooks directly. Use `.fetch()` for one-shot fetches and `.watch(options?)` for live subscriptions.
- `useModel(M).fetch()` / `.watch()` (no preceding terminal) default to `'all'`.
- Dropped `.findWatch(id)` / `.findByWatch(filter)` / `.firstWatch()` / `.lastWatch()` flat methods — replaced by `.find(id).watch()` etc.
- Hook return types now flow `InstanceType<M>` and create-props from the Model — no more `as unknown as { ... }` casts in user code.
