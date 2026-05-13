import {
  type AssociationDefinition,
  type HasManyThroughDefinition,
  resolveAssociationTarget,
  resolveHasManyThrough,
  type SimpleAssociationDefinition,
} from '../Model.js';
import type { AssociationLink } from '../types.js';
import { CollectionQuery } from './CollectionQuery.js';
import { InstanceQuery } from './InstanceQuery.js';
import { mergeFilters } from './QueryState.js';

function polymorphicTypeKey(polymorphic: string, typeKey?: string): string {
  return typeKey ?? `${polymorphic}Type`;
}

function createHasManyThroughQuery(
  upstream: InstanceQuery,
  spec: HasManyThroughDefinition,
): CollectionQuery {
  const resolved = resolveHasManyThrough(spec, upstream.model);

  // Step A: CollectionQuery on `through`, parent-scoped by `upstream` (User → UserRole)
  const throughLink: AssociationLink = {
    childColumn: resolved.throughForeignKey, // UserRole.userId
    parentColumn: resolved.selfPrimaryKey, // User.id
    direction: 'hasMany',
  };
  const throughQuery = CollectionQuery.fromModel(resolved.through as any).withParent(
    upstream,
    throughLink,
  );

  // Step B: leaf is `target`, parent-scoped by `throughQuery` (UserRole → Role)
  const targetLink: AssociationLink = {
    childColumn: resolved.targetPrimaryKey, // Role.id
    parentColumn: resolved.targetForeignKey, // UserRole.roleId
    direction: 'belongsTo',
  };
  return CollectionQuery.fromModel(resolved.target as any).withParent(throughQuery, targetLink);
}

export function createAssociationQuery(
  upstream: InstanceQuery,
  spec: AssociationDefinition,
): CollectionQuery | InstanceQuery {
  // hasManyThrough — dispatch early before resolveAssociationTarget
  if ('hasManyThrough' in spec) {
    return createHasManyThroughQuery(upstream, spec as HasManyThroughDefinition);
  }

  const simpleSpec = spec as SimpleAssociationDefinition;
  const resolved = resolveAssociationTarget(simpleSpec);
  const target = resolved.target;
  const direction: AssociationLink['direction'] =
    'belongsTo' in simpleSpec ? 'belongsTo' : 'hasMany' in simpleSpec ? 'hasMany' : 'hasOne';
  const link: AssociationLink = {
    childColumn: resolved.childColumn,
    parentColumn: resolved.parentColumn,
    direction,
  };

  const polymorphic = simpleSpec.polymorphic;
  // For belongsTo: typeValue defaults to target.tableName (the parent model's table).
  // For hasMany/hasOne: typeValue defaults to upstream.model.tableName (the self model's table).
  const typeValue =
    simpleSpec.typeValue ??
    (direction === 'belongsTo' ? (target as any).tableName : (upstream.model as any).tableName);

  let effectiveUpstream: InstanceQuery = upstream;
  if (polymorphic && direction === 'belongsTo') {
    // Narrow the upstream (the Comment side has commentableType column) by typeKey = typeValue.
    const tk = polymorphicTypeKey(polymorphic, simpleSpec.typeKey);
    effectiveUpstream = new InstanceQuery(upstream.model, upstream.terminalKind, {
      ...upstream.state,
      filter: mergeFilters(upstream.state.filter, { [tk]: typeValue }),
    });
  }

  if (direction === 'hasMany') {
    let leaf: CollectionQuery = CollectionQuery.fromModel(target).withParent(
      effectiveUpstream,
      link,
    );
    if (polymorphic) {
      const tk = polymorphicTypeKey(polymorphic, simpleSpec.typeKey);
      leaf = leaf.filterBy({ [tk]: typeValue });
    }
    return leaf;
  }

  // belongsTo / hasOne — return InstanceQuery with terminalKind 'first'
  let collectionForm: CollectionQuery = CollectionQuery.fromModel(target).withParent(
    effectiveUpstream,
    link,
  );
  if (polymorphic && direction === 'hasOne') {
    const tk = polymorphicTypeKey(polymorphic, simpleSpec.typeKey);
    collectionForm = collectionForm.filterBy({ [tk]: typeValue });
  }
  return new InstanceQuery(target, 'first', { ...collectionForm.state, limit: 1 });
}
