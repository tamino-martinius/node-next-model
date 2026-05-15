export * from './errors.js';
export * from './FilterEngine.js';
export * from './MemoryConnector.js';
export * from './Model.js';
export { baseQueryScoped } from './query/baseQueryScoped.js';
// Re-export the chainable query classes so downstream packages that extend a
// Model class can serialise the inferred return type of `Model({...})` into
// `.d.ts`. Without these, `tsc --emitDeclarationOnly` errors with TS2883
// ("inferred type cannot be named without a reference to `CollectionQuery`
// from '../node_modules/@next-model/core/dist/query/...'"). Re-exporting the
// classes via the package root means TS resolves them by name and the
// declaration emit succeeds.
export { CollectionQuery } from './query/CollectionQuery.js';
export { ColumnQuery } from './query/ColumnQuery.js';
export { InstanceQuery } from './query/InstanceQuery.js';
export type { ParentRef, QueryState, TerminalKind } from './query/QueryState.js';
export { ScalarQuery } from './query/ScalarQuery.js';
export * from './schema.js';
export * from './typedSchema.js';
export * from './types.js';
export * from './util.js';
export * from './validators.js';
