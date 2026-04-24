import type { ColumnKind, ColumnOptions, TableBuilder } from '@next-model/core';
import { ValidationError } from '@next-model/core';
import type { Static, TObject, TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export interface TypeBoxModelBridge<Schema extends TObject> {
  /**
   * Coerces raw props via TypeBox. Missing values with `default` get filled
   * in; the result is then checked with `Value.Check`. Throws `ValidationError`
   * with a newline-separated issue summary on failure — suitable for Model.init.
   */
  init: (props: unknown) => Static<Schema>;
  /** Boolean-valued validator — `true` when the record passes `Value.Check`. */
  validators: [(instance: unknown) => boolean];
  applyColumns: (builder: TableBuilder) => TableBuilder;
  describeColumns: () => Array<{ name: string; kind: ColumnKind; options: ColumnOptions }>;
}

type TypeBoxSchema = TSchema & {
  type?: string | string[];
  anyOf?: TypeBoxSchema[];
  oneOf?: TypeBoxSchema[];
  allOf?: TypeBoxSchema[];
  properties?: Record<string, TypeBoxSchema>;
  required?: string[];
  default?: unknown;
  format?: string;
  enum?: unknown[];
  $kind?: string;
};

function pickType(schema: TypeBoxSchema): string | undefined {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) {
    return schema.type.find((t) => t !== 'null');
  }
  // Unwrap Union([X, Null])
  if (Array.isArray(schema.anyOf)) {
    const nonNull = schema.anyOf.find((s) => s.type && s.type !== 'null');
    if (nonNull) return pickType(nonNull);
  }
  return undefined;
}

function isNullable(schema: TypeBoxSchema): boolean {
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((s) => s.type === 'null');
  }
  return false;
}

function classifyKind(schema: TypeBoxSchema): ColumnKind {
  const t = pickType(schema);
  switch (t) {
    case 'string': {
      if (schema.format === 'date' || schema.format === 'date-time') return 'datetime';
      return 'string';
    }
    case 'integer':
      return 'integer';
    case 'number':
      return 'float';
    case 'boolean':
      return 'boolean';
    case 'object':
    case 'array':
      return 'json';
    default:
      if (Array.isArray(schema.enum)) return 'string';
      return 'text';
  }
}

export function fromTypeBox<Schema extends TObject>(schema: Schema): TypeBoxModelBridge<Schema> {
  const asObject = schema as unknown as TypeBoxSchema;
  const requiredSet = new Set(asObject.required ?? []);
  const columns: Array<{ name: string; kind: ColumnKind; options: ColumnOptions }> = [];
  for (const [name, field] of Object.entries(asObject.properties ?? {})) {
    const kind = classifyKind(field);
    const options: ColumnOptions = {};
    const nullable = isNullable(field) || !requiredSet.has(name) || field.default !== undefined;
    options.null = nullable;
    if (field.default !== undefined) options.default = field.default as ColumnOptions['default'];
    columns.push({ name, kind, options });
  }

  const init = (props: unknown): Static<Schema> => {
    const withDefaults = Value.Default(schema, props);
    if (!Value.Check(schema, withDefaults)) {
      const errors = [...Value.Errors(schema, withDefaults)].map(
        (err) => `${err.path.replace(/^\//, '').replace(/\//g, '.') || '(root)'}: ${err.message}`,
      );
      throw new ValidationError(errors.join('\n') || 'validation failed');
    }
    return withDefaults as Static<Schema>;
  };

  const validator = (instance: unknown): boolean => {
    const attrs =
      typeof (instance as { attributes?: () => unknown })?.attributes === 'function'
        ? (instance as { attributes: () => unknown }).attributes()
        : instance;
    return Value.Check(schema, attrs);
  };

  return {
    init,
    validators: [validator],
    applyColumns(builder) {
      for (const col of columns) builder.column(col.name, col.kind, col.options);
      return builder;
    },
    describeColumns() {
      return columns.slice();
    },
  };
}
