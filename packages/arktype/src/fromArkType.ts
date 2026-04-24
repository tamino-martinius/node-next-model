import type { ColumnKind, ColumnOptions, TableBuilder } from '@next-model/core';
import { ValidationError } from '@next-model/core';
import type { Type } from 'arktype';

export interface ArkTypeModelBridge<T extends Type<any>> {
  /** Coerces raw props through the arktype. Throws `ValidationError` on failure. */
  init: (props: unknown) => ReturnType<T> extends infer Out ? Out : unknown;
  validators: [(instance: unknown) => boolean];
  applyColumns: (builder: TableBuilder) => TableBuilder;
  describeColumns: () => Array<{ name: string; kind: ColumnKind; options: ColumnOptions }>;
}

type ArkJson = string | ArkJsonObject | ArkJsonObject[];

interface ArkJsonObject {
  domain?: string;
  proto?: string;
  sequence?: unknown;
  divisor?: number;
  unit?: unknown;
  required?: Array<{ key: string; value: ArkJson }>;
  optional?: Array<{ key: string; value: ArkJson }>;
  format?: string;
}

/**
 * arktype's `.json` emits a tagged tree rather than a JSON-Schema-shaped
 * object. We fold the tag back into one of our schema-DSL column kinds.
 */
function classifyKind(node: ArkJson): ColumnKind {
  if (typeof node === 'string') {
    if (node === 'string') return 'string';
    if (node === 'number') return 'float';
    if (node === 'boolean') return 'boolean';
    return 'text';
  }
  if (Array.isArray(node)) {
    // Unions of literal units (e.g. `[{unit:false},{unit:true}]`) — arktype
    // represents booleans this way. Everything else is a free-form union.
    const units = node.filter(
      (b): b is ArkJsonObject => typeof b === 'object' && b !== null && 'unit' in b,
    );
    if (units.length === node.length) {
      const types = new Set(units.map((u) => typeof u.unit));
      if (types.size === 1 && types.has('boolean')) return 'boolean';
      if (types.size === 1 && types.has('string')) return 'string';
      if (types.size === 1 && types.has('number')) {
        return units.every((u) => Number.isInteger(u.unit as number)) ? 'integer' : 'float';
      }
    }
    return 'text';
  }
  if (node.proto === 'Array' || node.sequence !== undefined) return 'json';
  if (node.domain === 'object') return 'json';
  if (node.domain === 'number') {
    return node.divisor === 1 ? 'integer' : 'float';
  }
  if (node.domain === 'string') {
    if (node.format === 'date' || node.format === 'date-time') return 'datetime';
    return 'string';
  }
  if (node.domain === 'boolean') return 'boolean';
  if ('unit' in node) {
    const u = node.unit;
    if (typeof u === 'boolean') return 'boolean';
    if (typeof u === 'number') return Number.isInteger(u) ? 'integer' : 'float';
    return 'string';
  }
  return 'text';
}

function isNullable(node: ArkJson): boolean {
  if (Array.isArray(node)) {
    return node.some(
      (b) =>
        b && typeof b === 'object' && !Array.isArray(b) && (b.domain === 'null' || b.unit === null),
    );
  }
  return false;
}

interface Introspection {
  required: Record<string, ArkJson>;
  optional: Record<string, ArkJson>;
}

function introspect(ark: Type<any>): Introspection {
  const json = (ark as unknown as { json?: ArkJsonObject }).json;
  const required: Record<string, ArkJson> = {};
  const optional: Record<string, ArkJson> = {};
  for (const { key, value } of json?.required ?? []) required[key] = value;
  for (const { key, value } of json?.optional ?? []) optional[key] = value;
  return { required, optional };
}

export function fromArkType<T extends Type<any>>(ark: T): ArkTypeModelBridge<T> {
  const { required, optional } = introspect(ark);
  const columns: Array<{ name: string; kind: ColumnKind; options: ColumnOptions }> = [];
  for (const [name, value] of Object.entries(required)) {
    const options: ColumnOptions = { null: isNullable(value) };
    columns.push({ name, kind: classifyKind(value), options });
  }
  for (const [name, value] of Object.entries(optional)) {
    const options: ColumnOptions = { null: true };
    columns.push({ name, kind: classifyKind(value), options });
  }

  // biome-ignore lint/suspicious/noExplicitAny: arktype Types are callable
  const run = ark as unknown as (value: unknown) => any;
  const extractSummary = (result: unknown): string | undefined => {
    if (!result || typeof result !== 'object') return undefined;
    const obj = result as { summary?: unknown };
    return typeof obj.summary === 'string' ? obj.summary : undefined;
  };

  const init = (props: unknown) => {
    const result = run(props);
    const summary = extractSummary(result);
    if (summary !== undefined) throw new ValidationError(summary);
    return result;
  };

  const validator = (instance: unknown): boolean => {
    const attrs =
      typeof (instance as { attributes?: () => unknown })?.attributes === 'function'
        ? (instance as { attributes: () => unknown }).attributes()
        : instance;
    return extractSummary(run(attrs)) === undefined;
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
