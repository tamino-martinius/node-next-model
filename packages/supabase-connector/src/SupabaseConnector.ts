import type { Connector, DatabaseSchema } from '@next-model/core';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClientLike, SupabaseConfig, SupabaseCredentials } from './types.js';

export { MockSupabaseClient } from './MockSupabaseClient.js';
export type { SupabaseConfig } from './types.js';

function isClientLike(value: unknown): value is SupabaseClientLike {
  return typeof (value as { from?: unknown })?.from === 'function';
}

export class SupabaseConnector<S extends DatabaseSchema<any> | undefined = undefined>
  implements Connector<S>
{
  readonly schema?: S;
  protected readonly client: SupabaseClientLike;

  constructor(config: SupabaseConfig, extras?: { schema?: S }) {
    if (isClientLike(config)) {
      this.client = config;
    } else if ('client' in config && isClientLike(config.client)) {
      this.client = config.client;
    } else {
      const { url, key, options } = config as SupabaseCredentials;
      this.client = createClient(url, key, options) as unknown as SupabaseClientLike;
    }
    this.schema = extras?.schema;
  }

  /** Resolve the primary-key column for `tableName` from the attached schema. */
  protected pk(tableName: string): string {
    return this.schema?.tableDefinitions?.[tableName]?.primaryKey ?? 'id';
  }
}
