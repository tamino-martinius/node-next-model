import type { Dict, Validator } from './types.js';

/**
 * Per-instance error collection populated by the built-in validator
 * factories (`validatePresence`, `validateFormat`, etc.) and retrievable
 * via the `errors` getter on every Model instance.
 */
export class Errors {
  private map: Dict<string[]> = {};

  add(key: string, message: string): void {
    if (!this.map[key]) this.map[key] = [];
    this.map[key].push(message);
  }

  on(key: string): string[] {
    return this.map[key] ? [...this.map[key]] : [];
  }

  any(): boolean {
    for (const key in this.map) {
      if (this.map[key].length > 0) return true;
    }
    return false;
  }

  count(): number {
    let total = 0;
    for (const key in this.map) total += this.map[key].length;
    return total;
  }

  clear(): void {
    this.map = {};
  }

  /**
   * Format every error as `<key> <message>`.
   */
  full(): string[] {
    const result: string[] = [];
    for (const key in this.map) {
      for (const msg of this.map[key]) result.push(`${key} ${msg}`);
    }
    return result;
  }

  toJSON(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const key in this.map) out[key] = [...this.map[key]];
    return out;
  }
}

type RecordLike = {
  attributes: () => Dict<any>;
  errors: Errors;
  isPersistent: () => boolean;
  keys?: Dict<any>;
  constructor: any;
};

export interface BaseValidatorOptions {
  message?: string;
  allowNull?: boolean;
  allowBlank?: boolean;
  if?: (record: any) => boolean;
  unless?: (record: any) => boolean;
}

function toArray(keys: string | readonly string[]): readonly string[] {
  return typeof keys === 'string' ? [keys] : keys;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function skip(record: any, value: unknown, opts: BaseValidatorOptions): boolean {
  if (opts.if && !opts.if(record)) return true;
  if (opts.unless && opts.unless(record)) return true;
  if (opts.allowNull && (value === null || value === undefined)) return true;
  if (opts.allowBlank && isBlank(value)) return true;
  return false;
}

export function validatePresence(
  keys: string | readonly string[],
  opts: BaseValidatorOptions = {},
): Validator<any> {
  const list = toArray(keys);
  return (record: RecordLike) => {
    if (opts.if && !opts.if(record)) return true;
    if (opts.unless && opts.unless(record)) return true;
    const attrs = record.attributes();
    let valid = true;
    for (const key of list) {
      if (isBlank(attrs[key])) {
        record.errors.add(key, opts.message ?? 'cannot be blank');
        valid = false;
      }
    }
    return valid;
  };
}

export interface FormatOptions extends BaseValidatorOptions {
  with: RegExp;
}

export function validateFormat(key: string, opts: FormatOptions): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    if (!opts.with.test(String(value ?? ''))) {
      record.errors.add(key, opts.message ?? 'is invalid');
      return false;
    }
    return true;
  };
}

export interface LengthOptions extends BaseValidatorOptions {
  min?: number;
  max?: number;
  is?: number;
}

export function validateLength(key: string, opts: LengthOptions): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    const length = String(value ?? '').length;
    let valid = true;
    if (opts.is !== undefined && length !== opts.is) {
      record.errors.add(key, opts.message ?? `is the wrong length (should be ${opts.is})`);
      valid = false;
    }
    if (opts.min !== undefined && length < opts.min) {
      record.errors.add(key, opts.message ?? `is too short (minimum ${opts.min})`);
      valid = false;
    }
    if (opts.max !== undefined && length > opts.max) {
      record.errors.add(key, opts.message ?? `is too long (maximum ${opts.max})`);
      valid = false;
    }
    return valid;
  };
}

export function validateInclusion<T>(
  key: string,
  values: readonly T[],
  opts: BaseValidatorOptions = {},
): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    if (!values.includes(value)) {
      record.errors.add(key, opts.message ?? 'is not included in the list');
      return false;
    }
    return true;
  };
}

export function validateExclusion<T>(
  key: string,
  values: readonly T[],
  opts: BaseValidatorOptions = {},
): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    if (values.includes(value)) {
      record.errors.add(key, opts.message ?? 'is reserved');
      return false;
    }
    return true;
  };
}

export interface NumericalityOptions extends BaseValidatorOptions {
  integer?: boolean;
  min?: number;
  max?: number;
  greaterThan?: number;
  lessThan?: number;
  greaterThanOrEqualTo?: number;
  lessThanOrEqualTo?: number;
  equalTo?: number;
}

export function validateNumericality(key: string, opts: NumericalityOptions = {}): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      record.errors.add(key, opts.message ?? 'is not a number');
      return false;
    }
    let valid = true;
    if (opts.integer && !Number.isInteger(num)) {
      record.errors.add(key, opts.message ?? 'must be an integer');
      valid = false;
    }
    if (opts.min !== undefined && num < opts.min) {
      record.errors.add(key, opts.message ?? `must be greater than or equal to ${opts.min}`);
      valid = false;
    }
    if (opts.max !== undefined && num > opts.max) {
      record.errors.add(key, opts.message ?? `must be less than or equal to ${opts.max}`);
      valid = false;
    }
    if (opts.greaterThan !== undefined && num <= opts.greaterThan) {
      record.errors.add(key, opts.message ?? `must be greater than ${opts.greaterThan}`);
      valid = false;
    }
    if (opts.lessThan !== undefined && num >= opts.lessThan) {
      record.errors.add(key, opts.message ?? `must be less than ${opts.lessThan}`);
      valid = false;
    }
    if (opts.greaterThanOrEqualTo !== undefined && num < opts.greaterThanOrEqualTo) {
      record.errors.add(
        key,
        opts.message ?? `must be greater than or equal to ${opts.greaterThanOrEqualTo}`,
      );
      valid = false;
    }
    if (opts.lessThanOrEqualTo !== undefined && num > opts.lessThanOrEqualTo) {
      record.errors.add(
        key,
        opts.message ?? `must be less than or equal to ${opts.lessThanOrEqualTo}`,
      );
      valid = false;
    }
    if (opts.equalTo !== undefined && num !== opts.equalTo) {
      record.errors.add(key, opts.message ?? `must be equal to ${opts.equalTo}`);
      valid = false;
    }
    return valid;
  };
}

export interface UniquenessOptions extends BaseValidatorOptions {
  /** Additional columns that must match the candidate row for uniqueness to be scoped to. */
  scope?: readonly string[];
  /** When false, lowercases string values before comparison. Default: true. */
  caseSensitive?: boolean;
}

export function validateUniqueness(key: string, opts: UniquenessOptions = {}): Validator<any> {
  return async (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    const Model = record.constructor as {
      unscoped: () => any;
      keys: Dict<unknown>;
    };
    let scope = Model.unscoped();
    const scopeColumns = opts.scope ?? [];
    for (const col of scopeColumns) {
      scope = scope.filterBy({ [col]: attrs[col] });
    }
    if (opts.caseSensitive === false && typeof value === 'string') {
      scope = scope.filterBy({ $like: { [key]: value } });
    } else {
      scope = scope.filterBy({ [key]: value });
    }
    const rows = await scope.all();
    const pkName = Object.keys(Model.keys)[0] ?? 'id';
    const selfId = record.keys ? record.keys[pkName] : undefined;
    const collisions = rows.filter((row: any) => {
      if (!record.isPersistent()) return true;
      return row.attributes()[pkName] !== selfId;
    });
    if (opts.caseSensitive === false && typeof value === 'string') {
      const needle = value.toLowerCase();
      const filtered = collisions.filter(
        (row: any) => String(row.attributes()[key] ?? '').toLowerCase() === needle,
      );
      if (filtered.length > 0) {
        record.errors.add(key, opts.message ?? 'has already been taken');
        return false;
      }
      return true;
    }
    if (collisions.length > 0) {
      record.errors.add(key, opts.message ?? 'has already been taken');
      return false;
    }
    return true;
  };
}

export function validateConfirmation(key: string, opts: BaseValidatorOptions = {}): Validator<any> {
  return (record: RecordLike) => {
    const attrs = record.attributes();
    const value = attrs[key];
    if (skip(record, value, opts)) return true;
    const confirmation = (record as any)[`${key}Confirmation`];
    if (value !== confirmation) {
      record.errors.add(`${key}Confirmation`, opts.message ?? 'does not match confirmation');
      return false;
    }
    return true;
  };
}
