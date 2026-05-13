import { NextModelError, NotFoundError, ValidationError } from '@next-model/core';

export class UnauthorizedError extends NextModelError {
  statusCode = 401;
}

export class BadRequestError extends NextModelError {
  statusCode = 400;
}

export interface HttpErrorBody {
  error: string;
  message: string;
}

export function httpStatusFor(err: unknown): number {
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ValidationError) return 422;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof BadRequestError) return 400;
  return 500;
}

export function bodyFor(err: unknown): HttpErrorBody {
  if (err instanceof Error) return { error: err.name, message: err.message };
  return { error: 'InternalError', message: String(err) };
}

export function errorResponse(err: unknown): Response {
  return Response.json(bodyFor(err), { status: httpStatusFor(err) });
}
