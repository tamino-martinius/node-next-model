import { NextModelError, NotFoundError, ValidationError } from '@next-model/core';
import { GraphQLError } from 'graphql';

export class UnauthorizedError extends NextModelError {}

export function unauthorized(message = 'unauthorized'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'UNAUTHORIZED', status: 401 } });
}

export function notFound(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'NOT_FOUND', status: 404 } });
}

export function badRequest(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_REQUEST', status: 400 } });
}

export function wrapError(err: unknown): GraphQLError {
  if (err instanceof GraphQLError) return err;
  if (err instanceof UnauthorizedError) return unauthorized(err.message);
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof ValidationError) {
    return new GraphQLError(err.message, {
      extensions: { code: 'VALIDATION_ERROR', status: 422 },
    });
  }
  if (err instanceof NextModelError) {
    return new GraphQLError(err.message, {
      extensions: { code: 'PERSISTENCE_ERROR' },
    });
  }
  if (err instanceof Error) return new GraphQLError(err.message);
  return new GraphQLError(String(err));
}
