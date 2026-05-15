# @next-model/react

## vNext

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
