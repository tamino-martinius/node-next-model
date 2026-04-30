import type { CollectionQuery } from './query/CollectionQuery.js';
import type { InstanceQuery } from './query/InstanceQuery.js';
import type {
  ColumnDefault,
  ColumnDefinition,
  ColumnKind,
  IndexDefinition,
  TableDefinition,
} from './schema.js';
import { type Dict, KeyType } from './types.js';

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

/**
 * Schema-level association declaration. Cycle-free because the target table is
 * a string, not a class reference. Four forms:
 *
 *  - `belongsTo: 'parents'` — child holds the foreign key (`parentId`).
 *  - `hasMany: 'children'` — parent owns 0..n children whose FK references it.
 *  - `hasOne: 'child'`     — parent owns exactly one child whose FK references it.
 *  - `hasManyThrough: 'targets', through: 'join'` — many-to-many via a join table.
 *
 * `polymorphic` mirrors the legacy Model-level shape for `Comment`-like models.
 *
 * `foreignKey` is required on the three short-association variants. Unlike the
 * runtime `AssociationOptions` (which can derive `userId` from a Model class +
 * association name), the schema layer has no Model class to introspect, so
 * the column must be explicit.
 */
export type TypedAssociation =
  | {
      belongsTo: string;
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasMany: string;
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasOne: string;
      foreignKey: string;
      primaryKey?: string;
      polymorphic?: string;
      typeKey?: string;
      typeValue?: string;
    }
  | {
      hasManyThrough: string;
      through: string;
      throughForeignKey?: string;
      targetForeignKey?: string;
      selfPrimaryKey?: string;
      targetPrimaryKey?: string;
    };

export type TypedAssociations = Record<string, TypedAssociation>;

/** A single table entry inside a `DatabaseSchema`. */
export interface TypedTable<
  C extends Record<string, TypedColumn> = Record<string, TypedColumn>,
  A extends TypedAssociations = TypedAssociations,
> {
  columns: C;
  indexes?: IndexDefinition[];
  associations?: A;
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

/**
 * Derive a column-name → TS-type record for a specific table inside a
 * multi-table `DatabaseSchema`. Pass the schema and the table key.
 */
export type SchemaProps<S extends DatabaseSchema<any>, K extends keyof S['tables'] & string> = {
  -readonly [P in keyof S['tables'][K]['columns']]: ApplyNull<
    ColumnTSType<S['tables'][K]['columns'][P]['type']>,
    S['tables'][K]['columns'][P]['null']
  >;
};

/**
 * Whether a column can be omitted from `create()` / `build()` input. True when:
 *  - The column is auto-incremented (DB assigns the value)
 *  - The column has a static `default`
 *  - The column is nullable
 */
type IsOptionalCreateColumn<C> = C extends { autoIncrement: true }
  ? true
  : C extends { default: any }
    ? true
    : C extends { null: true }
      ? true
      : false;

/**
 * Derive the `create()` / `build()` input shape for a table. Required for
 * non-default, non-nullable, non-autoIncrement columns; optional for the rest.
 * The runtime-derived default init applies column defaults, the connector
 * assigns auto-increment primary keys, and nullable columns can be omitted.
 */
export type SchemaCreateProps<
  S extends DatabaseSchema<any>,
  K extends keyof S['tables'] & string,
> = {
  -readonly [P in keyof S['tables'][K]['columns'] as IsOptionalCreateColumn<
    S['tables'][K]['columns'][P]
  > extends true
    ? never
    : P]: ApplyNull<
    ColumnTSType<S['tables'][K]['columns'][P]['type']>,
    S['tables'][K]['columns'][P]['null']
  >;
} & {
  -readonly [P in keyof S['tables'][K]['columns'] as IsOptionalCreateColumn<
    S['tables'][K]['columns'][P]
  > extends true
    ? P
    : never]?: ApplyNull<
    ColumnTSType<S['tables'][K]['columns'][P]['type']>,
    S['tables'][K]['columns'][P]['null']
  >;
};

/** Names of columns whose `primary: true` for a given table. */
export type SchemaPrimaryKeys<C extends Record<string, TypedColumn>> = {
  [K in keyof C]: C[K]['primary'] extends true ? K : never;
}[keyof C];

/**
 * Derive the `keys` map for a table inside a `DatabaseSchema`. String / text
 * primaries map to `KeyType.uuid`; all other numeric primaries map to
 * `KeyType.number`. Falls back to `{ id: KeyType.number }` when no primary
 * column is declared — matches the legacy default in the Model factory.
 */
export type SchemaKeys<S extends DatabaseSchema<any>, K extends keyof S['tables'] & string> = [
  SchemaPrimaryKeys<S['tables'][K]['columns']>,
] extends [never]
  ? { id: KeyType.number }
  : {
      [P in SchemaPrimaryKeys<S['tables'][K]['columns']> &
        string]: S['tables'][K]['columns'][P]['type'] extends 'string' | 'text'
        ? KeyType.uuid
        : KeyType.number;
    };

/**
 * Open registry mapping schema table names → user-defined Model classes.
 * Augment via declaration merging from your application code so that
 * association accessors return class-instance types (with custom methods)
 * rather than the bare row shape:
 *
 * ```ts
 * declare module '@next-model/core' {
 *   interface ModelRegistry {
 *     users: import('./user').User;
 *     tasks: import('./task').Task;
 *   }
 * }
 * ```
 *
 * The augmentation is type-only — `import('./x').X` is erased at runtime, so
 * adding entries here cannot introduce a circular runtime import. Tables not
 * present in the registry fall back to `SchemaProps<S, tableName>` (the row
 * shape derived from the schema's column map), which is still useful but
 * lacks any methods declared on the class body.
 */
// biome-ignore lint/suspicious/noEmptyInterface: declaration merging requires interface; type alias cannot be augmented
export interface ModelRegistry {}

/**
 * Resolve a schema table name to a target type for accessor return values.
 * Looks up `Reg[T]` first (the user's class instance via `ModelRegistry`
 * augmentation); falls back to `SchemaProps<S, T>` when the table isn't in
 * the registry.
 */
export type ResolveAssociationTarget<
  S extends DatabaseSchema<any>,
  T extends string,
  Reg = ModelRegistry,
> = T extends keyof Reg ? Reg[T] : T extends keyof S['tables'] & string ? SchemaProps<S, T> : never;

/**
 * Map a single association entry to its accessor query type. `hasMany` and
 * `hasManyThrough` produce a `CollectionQuery<Target[]>`. `hasOne` and
 * `belongsTo` produce an `InstanceQuery<Target | undefined>`. `Target` is
 * `ModelRegistry[targetTable]` when the user has augmented the registry with
 * their Model class; otherwise it's `SchemaProps<S, targetTable>`.
 */
export type SchemaAssociationProp<
  S extends DatabaseSchema<any>,
  K extends keyof S['tables'] & string,
  Name extends keyof NonNullable<S['tables'][K]['associations']> & string,
  Reg = ModelRegistry,
> = NonNullable<S['tables'][K]['associations']>[Name] extends { hasMany: infer T extends string }
  ? CollectionQuery<ResolveAssociationTarget<S, T, Reg>[]>
  : NonNullable<S['tables'][K]['associations']>[Name] extends {
        hasManyThrough: infer T extends string;
      }
    ? CollectionQuery<ResolveAssociationTarget<S, T, Reg>[]>
    : NonNullable<S['tables'][K]['associations']>[Name] extends {
          belongsTo: infer T extends string;
        }
      ? InstanceQuery<ResolveAssociationTarget<S, T, Reg> | undefined>
      : NonNullable<S['tables'][K]['associations']>[Name] extends { hasOne: infer T extends string }
        ? InstanceQuery<ResolveAssociationTarget<S, T, Reg> | undefined>
        : never;

/**
 * Map every association declared on `S['tables'][K]` to its accessor type.
 * Used by the `Model({ connector, tableName })` and `Model({ schema, tableName })`
 * overloads' return types to attach typed accessor properties to the instance
 * type.
 */
export type SchemaAssociations<
  S extends DatabaseSchema<any>,
  K extends keyof S['tables'] & string,
  Reg = ModelRegistry,
> =
  S['tables'][K]['associations'] extends Record<string, TypedAssociation>
    ? {
        [N in keyof S['tables'][K]['associations'] & string]: SchemaAssociationProp<S, K, N, Reg>;
      }
    : {};

/**
 * The runtime representation of a multi-table typed schema. Carries the raw
 * per-table column maps (used for type inference at the call site) plus a
 * record of fully-baked `TableDefinition`s keyed by table name so the schema
 * can drive `@next-model/migrations` table emission and tooling.
 */
export interface DatabaseSchema<T extends Record<string, TypedTable> = Record<string, TypedTable>> {
  readonly tables: T;
  /** Per-table runtime `TableDefinition`s for migration / tooling. */
  readonly tableDefinitions: { [K in keyof T & string]: TableDefinition };
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

function buildTableDefinition(name: string, table: TypedTable): TableDefinition {
  const columnDefs: ColumnDefinition[] = Object.entries(table.columns).map(([colName, col]) =>
    buildColumnDefinitionFromTyped(colName, col as TypedColumn),
  );
  const primary = columnDefs.find((c) => c.primary);
  return {
    name,
    columns: columnDefs,
    indexes: table.indexes ?? [],
    primaryKey: primary?.name,
    associations: table.associations,
  };
}

/**
 * Define a typed multi-table database schema. Pass a record keyed by table
 * name; each entry holds the column map (and optional indexes). TypeScript
 * derives a precise per-table prop shape from the column types so callers can
 * say `Model({ connector, tableName: 'users' })` and get inferred props.
 *
 * Also produces a runtime `tableDefinitions` map so the schema can be consumed
 * by `@next-model/migrations` and other tooling as the source of truth for
 * table emission.
 */
export function defineSchema<const T extends Record<string, TypedTable>>(
  tables: T,
): DatabaseSchema<T> {
  const tableDefinitions = {} as { [K in keyof T & string]: TableDefinition };
  for (const name of Object.keys(tables) as Array<keyof T & string>) {
    tableDefinitions[name] = buildTableDefinition(name, tables[name]);
  }
  return {
    tables,
    tableDefinitions,
  };
}

/**
 * Runtime helper used by the Model factory's schema-driven overload to derive
 * the `keys` dict from a per-table `TableDefinition`. Mirrors `SchemaKeys` at
 * the type level: string / text primary columns map to `KeyType.uuid`; all
 * other numeric primary kinds map to `KeyType.number`. Falls back to the
 * legacy default when no primary column is declared.
 */
export function deriveKeysFromTableDefinition(table: TableDefinition): Dict<KeyType> {
  const out: Dict<KeyType> = {};
  for (const col of table.columns) {
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
  /**
   * Name of the exported const that holds the `defineSchema(...)` value.
   * Defaults to `'schema'` (i.e. `export const schema = defineSchema({...})`).
   */
  exportName?: string;
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

function renderAssociationLiteral(
  name: string,
  spec: Record<string, unknown>,
  indent: string,
): string {
  // Order keys deterministically: discriminator first (belongsTo / hasMany /
  // hasOne / hasManyThrough), then the rest. This produces stable output that
  // matches the source-author's likely ordering.
  const discriminators = ['belongsTo', 'hasMany', 'hasOne', 'hasManyThrough'];
  const parts: string[] = [];
  for (const key of discriminators) {
    if (key in spec) {
      parts.push(`${key}: ${renderAssociationValue(spec[key])}`);
    }
  }
  for (const [key, value] of Object.entries(spec)) {
    if (discriminators.includes(key)) continue;
    if (value === undefined) continue;
    parts.push(`${quoteKey(key)}: ${renderAssociationValue(value)}`);
  }
  return `${indent}${quoteKey(name)}: { ${parts.join(', ')} },`;
}

function renderAssociationValue(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  // Associations only carry strings + a few enum-typed strings in practice;
  // fall back to JSON.stringify for any unanticipated value.
  return JSON.stringify(value);
}

const VALID_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function quoteKey(name: string): string {
  return VALID_IDENT.test(name) ? name : JSON.stringify(name);
}

const DEFAULT_HEADER = '// Generated by @next-model/migrations — do not edit by hand.';

/**
 * Emit TypeScript source for a set of `TableDefinition`s as a single
 * multi-table `defineSchema(...)` call, exported under `options.exportName`
 * (default `schema`). The output is a parseable .ts module.
 *
 * @example
 * generateSchemaSource([usersTable, postsTable])
 * // → `import { defineSchema } from '@next-model/core';
 * //
 * //    export const schema = defineSchema({
 * //      users: { ... },
 * //      posts: { ... },
 * //    });`
 */
export function generateSchemaSource(
  tables: TableDefinition[],
  options: GenerateSchemaSourceOptions = {},
): string {
  const importPath = options.importPath ?? '@next-model/core';
  const header = options.header ?? DEFAULT_HEADER;
  const exportName = options.exportName ?? 'schema';

  const tableBlocks: string[] = [];
  for (const table of tables) {
    const colLines = table.columns.map((c) => renderColumnLiteral(c, '      '));
    const lines: string[] = [];
    lines.push(`  ${quoteKey(table.name)}: {`);
    lines.push(`    columns: {`);
    for (const colLine of colLines) lines.push(colLine);
    lines.push(`    },`);
    if (table.indexes.length > 0) {
      lines.push(`    indexes: [`);
      for (const idx of table.indexes) lines.push(renderIndexLiteral(idx, '      '));
      lines.push(`    ],`);
    }
    const associations = table.associations as Record<string, Record<string, unknown>> | undefined;
    if (associations && Object.keys(associations).length > 0) {
      lines.push(`    associations: {`);
      for (const [assocName, spec] of Object.entries(associations)) {
        lines.push(renderAssociationLiteral(assocName, spec, '      '));
      }
      lines.push(`    },`);
    }
    lines.push(`  },`);
    tableBlocks.push(lines.join('\n'));
  }

  const parts: string[] = [];
  if (header) parts.push(header);
  // Single-quoted import path matches the rest of the codebase's style and
  // is what consumers tend to lint for.
  parts.push(`import { defineSchema } from '${importPath.replace(/'/g, "\\'")}';`);

  if (tableBlocks.length === 0) {
    parts.push(`export const ${exportName} = defineSchema({});`);
  } else {
    parts.push(`export const ${exportName} = defineSchema({\n${tableBlocks.join('\n')}\n});`);
  }
  return `${parts.join('\n\n')}\n`;
}
