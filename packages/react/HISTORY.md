# @next-model/react

## vNext

### Added
- Initial release: `<NextModelProvider>`, `useModel`, `useInvalidateKeys`.
- Reactive instance shells; identity-mapped Store; refcounted watch lifecycle.
- Async terminals `{ data, isLoading, error }` and watch variants `{ ..., isRefetching }`.
- Sync `build()` terminal with stable shell + `reset(props?)`.
- Watch terminals: `.watch()`, `.findWatch(pk)`, `.findByWatch(filter)`, `.firstWatch()`, `.lastWatch()` (flattened from `.<terminal>().watch()` for hook-rule safety).
