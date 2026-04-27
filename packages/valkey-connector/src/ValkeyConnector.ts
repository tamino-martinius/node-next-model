import { baseQueryScoped, type QueryScopedSpec } from '@next-model/core';
import { type RedisConfig, RedisConnector } from '@next-model/redis-connector';

/** Alias of `RedisConfig`. Valkey is wire-compatible with Redis. */
export type ValkeyConfig = RedisConfig;

/**
 * Valkey connector. Wire-compatible with Redis, so it inherits
 * `RedisConnector` verbatim — same node-redis client, same storage layout
 * (HASH per row + ZSET of ids per table), same filter / aggregate /
 * transaction semantics.
 *
 * The package exists as its own publishable name so apps targeting Valkey
 * can pin `@next-model/valkey-connector` and pick up Valkey-specific
 * overrides as they emerge (Valkey ≥ 8.x adds JSON, vector, and clustering
 * features that aren't part of the base Redis protocol).
 */
export class ValkeyConnector extends RedisConnector {
  constructor(config: ValkeyConfig = {}) {
    super({ ...config, prefix: config.prefix ?? 'nm:' });
  }

  async queryScoped(spec: QueryScopedSpec): Promise<unknown> {
    return baseQueryScoped(this, spec);
  }
}
