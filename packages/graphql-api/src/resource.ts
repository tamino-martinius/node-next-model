import { buildResolvers } from './resolvers.js';
import { buildMutationExtension, buildQueryExtension, buildTypeDefs, resolveNames } from './sdl.js';
import type { Resource, ResourceOptions } from './types.js';

const ROOT_STUBS = ['type Query', 'type Mutation']
  .map((t) => `${t} {\n  _empty: Boolean\n}`)
  .join('\n\n');

export function buildModelResource<C>(options: ResourceOptions<C>): Resource<C> {
  // SDL helpers are agnostic to the resolver `C` generic — they only read the
  // Model + fields. Cast once to avoid threading the type through them.
  const sdlOpts = options as ResourceOptions<unknown>;
  const names = resolveNames(sdlOpts);
  const { resolvers, operations } = buildResolvers<C>(options);
  const parts = [buildTypeDefs(sdlOpts, names)];
  if (Object.keys(resolvers.Query).length > 0) {
    parts.push(buildQueryExtension(sdlOpts, names));
  }
  if (Object.keys(resolvers.Mutation).length > 0) {
    parts.push(buildMutationExtension(sdlOpts, names));
  }
  return {
    typeDefs: parts.join('\n\n'),
    resolvers,
    resource: options,
    operations,
  } as Resource<C> & { operations: typeof operations };
}

export function composeSchema<C>(resources: Resource<C>[]): {
  typeDefs: string;
  resolvers: {
    Query: Record<string, (...args: unknown[]) => unknown>;
    Mutation: Record<string, (...args: unknown[]) => unknown>;
  };
} {
  const combinedResolvers = {
    Query: {} as Record<string, (...args: unknown[]) => unknown>,
    Mutation: {} as Record<string, (...args: unknown[]) => unknown>,
  };
  const pieces: string[] = [ROOT_STUBS];
  for (const resource of resources) {
    pieces.push(resource.typeDefs);
    Object.assign(combinedResolvers.Query, resource.resolvers.Query);
    Object.assign(combinedResolvers.Mutation, resource.resolvers.Mutation);
  }
  return {
    typeDefs: pieces.join('\n\n'),
    resolvers: combinedResolvers,
  };
}
