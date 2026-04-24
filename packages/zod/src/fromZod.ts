import type { ColumnKind, ColumnOptions, TableBuilder } from '@next-model/core';
import { ValidationError } from '@next-model/core';
import type { ZodTypeAny, z } from 'zod';

export interface ZodModelBridge<Schema extends ZodTypeAny> {
  /**
   * Coerces raw props via the zod schema. Throws `ValidationError` on parse
   * failure with a newline-separated error summary — suitable for a Model's
   * `init` option.
   */
  init: (props: unknown) => z.infer<Schema>;
  /**
   * Array-shaped for `validators: [...]`. Returns `true` on success and
   * `false` otherwise, so `instance.isValid()` / `save()` work unchanged.
   */
  validators: [(instance: unknown) => boolean];
  /**
   * Applies one schema-DSL column per zod object field to the given
   * `TableBuilder`. Nested objects become `json`, dates become `datetime`,
   * numbers use `integer` when `.int()` was called and `float` otherwise.
   */
  applyColumns: (builder: TableBuilder) => TableBuilder;
  /**
   * Equivalent standalone form of `applyColumns` — useful for inspecting the
   * derived columns without touching a builder.
   */
  describeColumns: () => Array<{ name: string; kind: ColumnKind; options: ColumnOptions }>;
}

type ZodObjectShape = { shape: Record<string, ZodTypeAny> };

function unwrap(type: ZodTypeAny): { inner: ZodTypeAny; optional: boolean; defaultValue: unknown } {
  let cur: any = type;
  let optional = false;
  let defaultValue: unknown;
  // Descend through Optional / Nullable / Default wrappers until we hit the
  // terminal zod type. We check the constructor name rather than instanceof
  // so the package stays compatible with both zod 3 and zod 4.
  while (cur) {
    const name = cur.constructor?.name;
    if (name === 'ZodOptional' || name === 'ZodNullable') {
      optional = true;
      cur = cur._def?.innerType ?? cur._def?.schema;
      continue;
    }
    if (name === 'ZodDefault') {
      const raw = cur._def?.defaultValue;
      defaultValue = typeof raw === 'function' ? raw() : raw;
      optional = true;
      cur = cur._def?.innerType ?? cur._def?.schema;
      continue;
    }
    break;
  }
  return { inner: cur, optional, defaultValue };
}

function classifyKind(type: ZodTypeAny): ColumnKind {
  const name = (type as any).constructor?.name;
  switch (name) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber': {
      const checks = ((type as any)._def?.checks ?? []) as Array<{ kind: string }>;
      return checks.some((c) => c.kind === 'int') ? 'integer' : 'float';
    }
    case 'ZodBigInt':
      return 'bigint';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodDate':
      return 'datetime';
    case 'ZodObject':
    case 'ZodArray':
    case 'ZodRecord':
    case 'ZodMap':
      return 'json';
    case 'ZodEnum':
    case 'ZodLiteral':
    case 'ZodNativeEnum':
      return 'string';
    default:
      // ZodUnion / ZodDiscriminatedUnion / ZodAny / ZodUnknown — we don't
      // know enough to pick, so treat as text (free-form).
      return 'text';
  }
}

function formatIssue(path: (string | number)[], message: string): string {
  return path.length === 0 ? message : `${path.join('.')}: ${message}`;
}

export function fromZod<Schema extends ZodTypeAny & ZodObjectShape>(
  schema: Schema,
): ZodModelBridge<Schema> {
  const shape = schema.shape;

  const columns: Array<{ name: string; kind: ColumnKind; options: ColumnOptions }> = [];
  for (const [name, fieldSchema] of Object.entries(shape)) {
    const { inner, optional, defaultValue } = unwrap(fieldSchema);
    if (!inner) continue;
    const kind = classifyKind(inner);
    const options: ColumnOptions = {};
    if (optional) options.null = true;
    else options.null = false;
    if (defaultValue !== undefined) options.default = defaultValue as ColumnOptions['default'];
    columns.push({ name, kind, options });
  }

  const parse = (value: unknown): z.infer<Schema> => {
    const result = (schema as any).safeParse(value);
    if (result.success) return result.data as z.infer<Schema>;
    const issues = (result.error?.issues ?? []) as Array<{
      path: Array<string | number>;
      message: string;
    }>;
    const summary =
      issues.map((i) => formatIssue(i.path, i.message)).join('\n') || 'validation failed';
    throw new ValidationError(summary);
  };

  const init = (props: unknown): z.infer<Schema> => parse(props);

  const validator = (instance: unknown): boolean => {
    const attrs =
      typeof (instance as { attributes?: () => unknown })?.attributes === 'function'
        ? (instance as { attributes: () => unknown }).attributes()
        : instance;
    const result = (schema as any).safeParse(attrs);
    return result.success === true;
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
