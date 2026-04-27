import type {
  ColumnDefault,
  ColumnDefinition,
  ColumnKind,
  IndexDefinition,
  TableDefinition,
} from './schema.js';
import { type Dict, KeyType } from './types.js';
import { camelize } from './util.js';

/**
 * Single-column declaration for a typed schema. Mirrors the option shape used
 * by the schema-DSL `t.column(...)` helpers but is consumed at compile time so
 * the column's `type` and `null` flag drive TypeScript prop inference.
 */
export interface TypedColumn<K extends ColumnKind = ColumnKind> {
  type: K;
  null?: boolean;
  default?: ColumnDefault;
  limit?: number;
  primary?: boolean;
  unique?: boolean;
  precision?: number;
  scale?: number;
  autoIncrement?: boolean;
}

/** Maps a `ColumnKind` to its TypeScript prop type. */
export type ColumnTSType<K extends ColumnKind> = K extends 'string' | 'text'
  ? string
  : K extends 'integer' | 'bigint' | 'float' | 'decimal'
    ? number
    : K extends 'boolean'
      ? boolean
      : K extends 'date' | 'datetime' | 'timestamp'
        ? Date
        : K extends 'json'
          ? unknown
          : never;

/** Apply nullability: `null: true` widens to `T | null`, otherwise leaves `T`. */
export type ApplyNull<T, Null> = Null extends true ? T | null : T;

/** Derive a column-name → TS-type record from a `TypedColumns` map. */
export type SchemaProps<C extends Record<string, TypedColumn>> = {
  [K in keyof C]: ApplyNull<ColumnTSType<C[K]['type']>, C[K]['null']>;
};

/** Names of columns whose `primary: true`. */
export type SchemaPrimaryKeys<C extends Record<string, TypedColumn>> = {
  [K in keyof C]: C[K]['primary'] extends true ? K : never;
}[keyof C];

/**
 * Derive the `keys` map: `{ [pk]: KeyType.uuid | KeyType.number }` from the
 * primary columns and their declared type. String / text columns map to
 * `KeyType.uuid`; everything numeric maps to `KeyType.number`.
 *
 * Falls back to `{ id: KeyType.number }` when no primary column is declared
 * — matches the legacy default in the Model factory.
 */
export type SchemaKeys<C extends Record<string, TypedColumn>> = [SchemaPrimaryKeys<C>] extends [
  never,
]
  ? { id: KeyType.number }
  : {
      [K in SchemaPrimaryKeys<C> & string]: C[K]['type'] extends 'string' | 'text'
        ? KeyType.uuid
        : KeyType.number;
    };

/**
 * The runtime representation of a typed schema. Carries both the original
 * column map (used for type inference at the call site) and a fully-baked
 * `TableDefinition` so the same schema can drive `@next-model/migrations`
 * table emission.
 */
export interface TypedSchema<C extends Record<string, TypedColumn> = Record<string, TypedColumn>> {
  readonly tableName: string;
  readonly columns: C;
  /** Runtime `TableDefinition` for migration emission. */
  readonly tableDefinition: TableDefinition;
}

function buildColumnDefinitionFromTyped(name: string, col: TypedColumn): ColumnDefinition {
  return {
    name,
    type: col.type,
    nullable: col.null ?? false,
    default: col.default,
    limit: col.limit,
    primary: col.primary ?? false,
    unique: col.unique ?? false,
    precision: col.precision,
    scale: col.scale,
    autoIncrement: col.autoIncrement ?? false,
  };
}

/**
 * Define a typed schema for a Model. Pass with `Model({ schema })` to get
 * automatic prop inference and a default identity `init` — `tableName` and
 * `keys` are derived from the schema.
 *
 * Also produces a runtime `TableDefinition` so the schema can be consumed
 * by `@next-model/migrations` as the source of truth for table emission.
 */
export function defineSchema<const C extends Record<string, TypedColumn>>(spec: {
  tableName: string;
  columns: C;
  indexes?: IndexDefinition[];
}): TypedSchema<C> {
  const columnDefs: ColumnDefinition[] = Object.entries(spec.columns).map(([name, col]) =>
    buildColumnDefinitionFromTyped(name, col as TypedColumn),
  );
  const primary = columnDefs.find((c) => c.primary);
  const tableDefinition: TableDefinition = {
    name: spec.tableName,
    columns: columnDefs,
    indexes: spec.indexes ?? [],
    primaryKey: primary?.name,
  };
  return {
    tableName: spec.tableName,
    columns: spec.columns,
    tableDefinition,
  };
}

/**
 * Runtime helper used by the Model factory's schema-driven overload to derive
 * the `keys` dict from a `TypedSchema`. Mirrors `SchemaKeys<C>` at the type
 * level: string / text primary columns map to `KeyType.uuid`, all other
 * numeric primary kinds map to `KeyType.number`. Falls back to the legacy
 * default when no primary column is declared.
 */
export function deriveKeysFromSchema(schema: TypedSchema): Dict<KeyType> {
  const out: Dict<KeyType> = {};
  for (const col of schema.tableDefinition.columns) {
    if (col.primary) {
      out[col.name] = col.type === 'string' || col.type === 'text' ? KeyType.uuid : KeyType.number;
    }
  }
  if (Object.keys(out).length === 0) out.id = KeyType.number;
  return out;
}

/** Options for `generateSchemaSource`. */
export interface GenerateSchemaSourceOptions {
  /**
   * Module specifier the emitted source imports `defineSchema` from. Defaults
   * to `'@next-model/core'` so generated files work out of the box.
   */
  importPath?: string;
  /**
   * Header comment placed at the top of the emitted file. Defaults to a
   * "do not edit by hand" notice. Pass an empty string to suppress.
   */
  header?: string;
}

/**
 * Render a single column literal in TS source form. Drops default-valued
 * options (`null: false`, `primary: false`, `unique: false`,
 * `autoIncrement: false`) to keep emission compact and round-trip identical
 * to a hand-written `defineSchema` call.
 */
function renderColumnLiteral(col: ColumnDefinition, indent: string): string {
  const parts: string[] = [`type: ${JSON.stringify(col.type)}`];
  if (col.nullable) parts.push('null: true');
  if (col.primary) parts.push('primary: true');
  if (col.unique) parts.push('unique: true');
  if (col.autoIncrement) parts.push('autoIncrement: true');
  if (col.limit !== undefined) parts.push(`limit: ${col.limit}`);
  if (col.precision !== undefined) parts.push(`precision: ${col.precision}`);
  if (col.scale !== undefined) parts.push(`scale: ${col.scale}`);
  if (col.default !== undefined) {
    parts.push(`default: ${renderDefaultLiteral(col.default)}`);
  }
  return `${indent}${quoteKey(col.name)}: { ${parts.join(', ')} },`;
}

function renderDefaultLiteral(value: ColumnDefault): string {
  if (value === null) return 'null';
  if (value === 'currentTimestamp') return `'currentTimestamp'`;
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Fallthrough should be unreachable given ColumnDefault, but JSON-encode as a guard.
  return JSON.stringify(value);
}

function renderIndexLiteral(idx: IndexDefinition, indent: string): string {
  const parts: string[] = [`columns: ${JSON.stringify(idx.columns)}`];
  // `unique` is a required field on IndexDefinition, so always emit it for
  // a clean round-trip even when the value is the default `false`.
  parts.push(`unique: ${idx.unique ? 'true' : 'false'}`);
  if (idx.name !== undefined) parts.push(`name: ${JSON.stringify(idx.name)}`);
  return `${indent}{ ${parts.join(', ')} },`;
}

const VALID_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function quoteKey(name: string): string {
  return VALID_IDENT.test(name) ? name : JSON.stringify(name);
}

const DEFAULT_HEADER = '// Generated by @next-model/migrations — do not edit by hand.';

/**
 * Emit TypeScript source for a set of `TableDefinition`s as `defineSchema`
 * declarations. The output is a parseable .ts module that re-exports each
 * schema as a named const.
 *
 * @example
 * generateSchemaSource([usersTable, postsTable])
 * // → `import { defineSchema } from '@next-model/core';
 * //
 * //    export const usersSchema = defineSchema({ ... });
 * //    export const postsSchema = defineSchema({ ... });`
 */
export function generateSchemaSource(
  tables: TableDefinition[],
  options: GenerateSchemaSourceOptions = {},
): string {
  const importPath = options.importPath ?? '@next-model/core';
  const header = options.header ?? DEFAULT_HEADER;

  const blocks: string[] = [];
  for (const table of tables) {
    const constName = `${camelize(table.name)}Schema`;
    const colLines = table.columns.map((c) => renderColumnLiteral(c, '    '));
    const lines: string[] = [];
    lines.push(`export const ${constName} = defineSchema({`);
    lines.push(`  tableName: ${JSON.stringify(table.name)},`);
    lines.push(`  columns: {`);
    for (const colLine of colLines) lines.push(colLine);
    lines.push(`  },`);
    if (table.indexes.length > 0) {
      lines.push(`  indexes: [`);
      for (const idx of table.indexes) lines.push(renderIndexLiteral(idx, '    '));
      lines.push(`  ],`);
    }
    lines.push(`});`);
    blocks.push(lines.join('\n'));
  }

  const parts: string[] = [];
  if (header) parts.push(header);
  // Single-quoted import path matches the rest of the codebase's style and
  // is what consumers tend to lint for.
  parts.push(`import { defineSchema } from '${importPath.replace(/'/g, "\\'")}';`);
  if (blocks.length > 0) parts.push(blocks.join('\n\n'));
  return `${parts.join('\n\n')}\n`;
}
