import type { AssociationDefinition, SimpleAssociationDefinition, ModelClass } from '../Model.js';
import { resolveAssociationTarget } from '../Model.js';
import type { Dict } from '../types.js';

/**
 * Attach JOIN-fast-path includes onto a hydrated record. The connector's
 * `queryWithJoins` populates `__includes[name]` with the raw child rows; this
 * walks the include declarations and constructs Model instances for each
 * payload bucket, assigning to the parent record under the association name.
 */
export function attachIncludesPayload(
  record: any,
  includes: Array<{ name: string; spec: AssociationDefinition; cardinality: 'many' | 'one' }>,
  payload: Dict<Dict<any>[]>,
): void {
  for (const { name, spec, cardinality } of includes) {
    if ('hasManyThrough' in spec) continue;
    const rows = payload[name] ?? [];
    const target = resolveAssociationTarget(spec as SimpleAssociationDefinition).target;
    const childPkNames = Object.keys(target.keys);
    const instances = rows.map((row) => {
      const keys: Dict<any> = {};
      const data: Dict<any> = { ...row };
      for (const key of childPkNames) {
        keys[key] = data[key];
        delete data[key];
      }
      return new (target as any)(data, keys);
    });
    if (cardinality === 'many') {
      (record as Dict<unknown>)[name] = instances;
    } else {
      (record as Dict<unknown>)[name] = instances[0];
    }
  }
}

/**
 * Preload-strategy includes: issue one batched query per association after
 * the parent fetch and assign each payload onto the matching parent record.
 * Works on every connector — falls back here when `strategy: 'preload'` is
 * chosen, or when `strategy: 'auto'` runs against a connector without
 * `queryWithJoins`.
 */
export async function applyIncludes(
  records: any[],
  parent: typeof ModelClass,
  names: string[],
): Promise<void> {
  if (records.length === 0 || names.length === 0) return;
  const associations = parent.associations ?? {};
  for (const name of names) {
    const spec = associations[name];
    if (!spec) continue;
    if ('hasManyThrough' in spec) continue; // not supported in preload path yet
    const target = resolveAssociationTarget(spec).target;
    if ('belongsTo' in spec) {
      const preloaded = await target.preloadBelongsTo(records, {
        foreignKey: spec.foreignKey,
        primaryKey: spec.primaryKey,
      });
      for (const record of records) {
        const attrs = record.attributes as Dict<any>;
        const fk = attrs[spec.foreignKey];
        (record as Dict<unknown>)[name] = fk == null ? undefined : preloaded.get(fk);
      }
    } else if ('hasMany' in spec) {
      const selfPk = spec.primaryKey ?? 'id';
      const preloaded = await target.preloadHasMany(records, {
        foreignKey: spec.foreignKey,
        primaryKey: selfPk,
      });
      for (const record of records) {
        const attrs = record.attributes as Dict<any>;
        const id = attrs[selfPk];
        (record as Dict<unknown>)[name] = preloaded.get(id) ?? [];
      }
    } else {
      const selfPk = spec.primaryKey ?? 'id';
      const preloaded = await target.preloadHasMany(records, {
        foreignKey: spec.foreignKey,
        primaryKey: selfPk,
      });
      for (const record of records) {
        const attrs = record.attributes as Dict<any>;
        const id = attrs[selfPk];
        (record as Dict<unknown>)[name] = preloaded.get(id)?.[0];
      }
    }
  }
}
