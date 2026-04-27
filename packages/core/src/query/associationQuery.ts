import { type AssociationDefinition, resolveAssociationTarget } from '../Model.js';
import type { AssociationLink } from '../types.js';
import { CollectionQuery } from './CollectionQuery.js';
import { mergeFilters } from './QueryState.js';
import { InstanceQuery } from './InstanceQuery.js';

function polymorphicTypeKey(polymorphic: string, typeKey?: string): string {
  return typeKey ?? `${polymorphic}Type`;
}

export function createAssociationQuery(
  upstream: InstanceQuery,
  spec: AssociationDefinition,
): CollectionQuery | InstanceQuery {
  const resolved = resolveAssociationTarget(spec);
  const target = resolved.target;
  const direction: AssociationLink['direction'] =
    'belongsTo' in spec ? 'belongsTo' : 'hasMany' in spec ? 'hasMany' : 'hasOne';
  const link: AssociationLink = {
    childColumn: resolved.childColumn,
    parentColumn: resolved.parentColumn,
    direction,
  };

  const polymorphic = spec.polymorphic;
  // For belongsTo: typeValue defaults to target.tableName (the parent model's table).
  // For hasMany/hasOne: typeValue defaults to upstream.model.tableName (the self model's table).
  const typeValue =
    spec.typeValue ??
    (direction === 'belongsTo'
      ? (target as any).tableName
      : (upstream.model as any).tableName);

  let effectiveUpstream: InstanceQuery = upstream;
  if (polymorphic && direction === 'belongsTo') {
    // Narrow the upstream (the Comment side has commentableType column) by typeKey = typeValue.
    const tk = polymorphicTypeKey(polymorphic, spec.typeKey);
    effectiveUpstream = new InstanceQuery(upstream.model, upstream.terminalKind, {
      ...upstream.state,
      filter: mergeFilters(upstream.state.filter, { [tk]: typeValue }),
    });
  }

  if (direction === 'hasMany') {
    let leaf: CollectionQuery = CollectionQuery.fromModel(target).withParent(effectiveUpstream, link);
    if (polymorphic) {
      const tk = polymorphicTypeKey(polymorphic, spec.typeKey);
      leaf = leaf.filterBy({ [tk]: typeValue });
    }
    return leaf;
  }

  // belongsTo / hasOne — return InstanceQuery with terminalKind 'first'
  let collectionForm: CollectionQuery = CollectionQuery.fromModel(target).withParent(effectiveUpstream, link);
  if (polymorphic && direction === 'hasOne') {
    const tk = polymorphicTypeKey(polymorphic, spec.typeKey);
    collectionForm = collectionForm.filterBy({ [tk]: typeValue });
  }
  return new InstanceQuery(target, 'first', { ...collectionForm.state, limit: 1 });
}
