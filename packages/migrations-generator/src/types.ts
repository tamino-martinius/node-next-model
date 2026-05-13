export interface ColumnStub {
  name: string;
  /**
   * Matches the schema DSL's column kinds. Anything not in this list is
   * emitted as a `t.string(...)` fallback.
   */
  type?:
    | 'integer'
    | 'bigint'
    | 'float'
    | 'string'
    | 'text'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'json';
  primary?: boolean;
  autoIncrement?: boolean;
  nullable?: boolean;
  default?: string | number | boolean | null;
}

export interface GenerateOptions {
  /** Human-readable name (will be slugified). */
  name: string;
  /** Timestamp used for the version + filename. Defaults to `new Date()`. */
  now?: Date;
  /** Explicit version string — overrides the timestamp-derived one. */
  version?: string;
  /**
   * When provided, produces a create-table migration body instead of an empty
   * stub. Columns default to an `id` (integer, auto-increment, primary) and
   * created/updated timestamps when the caller doesn't supply their own.
   */
  createTable?: {
    tableName: string;
    columns?: ColumnStub[];
    /** Append default `timestamps` (`createdAt` + `updatedAt`). Defaults to true. */
    timestamps?: boolean;
  };
  /** Comma-separated parent versions for the dependency graph. */
  parents?: string[];
  /**
   * Module spec for the Connector interface import — lets the generated file
   * match whatever alias the consumer uses. Defaults to `'@next-model/core'`.
   */
  coreSpec?: string;
}

export interface GeneratedMigration {
  version: string;
  name: string;
  fileName: string;
  contents: string;
}
