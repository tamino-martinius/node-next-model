import { PersistenceError } from '../errors.js';
import type { Dict } from '../types.js';

/**
 * Encode a single-column cursor — `paginateCursor` falls back to this when
 * the chain orders by primary key only, so the token is just `{[pk]: value}`.
 */
export function encodeCursor(value: unknown, key: string): string {
  return Buffer.from(JSON.stringify({ [key]: value }), 'utf8').toString('base64url');
}

/**
 * Encode a composite (orderBy + primary key) cursor — `paginateCursor` uses
 * this when the chain orders by a non-pk column, so duplicate sort values
 * paginate deterministically via the pk tiebreaker.
 */
export function encodeCompositeCursor(fields: Dict<unknown>): string {
  return Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
}

/**
 * Decode either flavour of cursor — both forms are JSON-encoded objects, so
 * one decoder fits both. Throws `PersistenceError` on malformed input.
 */
export function decodeCompositeCursor(token: string): Dict<unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object') return parsed as Dict<unknown>;
    throw new PersistenceError(`Invalid pagination cursor: ${token}`);
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError(`Invalid pagination cursor: ${token}`);
  }
}
