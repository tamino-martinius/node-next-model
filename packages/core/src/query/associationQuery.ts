import { type AssociationDefinition, resolveAssociationTarget } from '../Model.js';
import type { AssociationLink } from '../types.js';
import { CollectionQuery } from './CollectionQuery.js';
import { InstanceQuery } from './InstanceQuery.js';

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
  if (direction === 'hasMany') {
    return CollectionQuery.fromModel(target).withParent(upstream, link);
  }
  // belongsTo / hasOne — return InstanceQuery with terminalKind 'first'
  const collectionForm = CollectionQuery.fromModel(target).withParent(upstream, link);
  return new InstanceQuery(target, 'first', { ...collectionForm.state, limit: 1 });
}
