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
