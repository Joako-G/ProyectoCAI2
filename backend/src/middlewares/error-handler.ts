import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export const apiNotFound: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError('Route not found'));
};

function bodyParserErrorType(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'type' in error ? String(error.type) : undefined;
}

function clientError(error: unknown): { status: number; message: string } | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status, statusCode, expose, message } = error as Record<string, unknown>;
  const code = typeof status === 'number' ? status : statusCode;
  if (expose === true && typeof code === 'number' && code >= 400 && code < 500 && typeof message === 'string') {
    return { status: code, message };
  }
  return undefined;
}

// Four parameters are required for Express to treat this as an error handler.
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ValidationError) {
    response.status(400).json({ error: 'validation_error', message: error.message, fieldErrors: error.fieldErrors });
  } else if (error instanceof NotFoundError) {
    response.status(404).json({ error: 'not_found', message: error.message });
  } else if (error instanceof ConflictError) {
    response.status(409).json({ error: 'conflict', message: error.message });
  } else if (bodyParserErrorType(error) === 'entity.parse.failed') {
    response.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON' });
  } else if (bodyParserErrorType(error) === 'entity.too.large') {
    response.status(413).json({ error: 'payload_too_large', message: 'Request body is too large' });
  } else {
    const client = clientError(error);
    if (client) {
      response.status(client.status).json({ error: 'bad_request', message: client.message });
      return;
    }
    console.error('Unhandled error', error);
    response.status(500).json({ error: 'internal_error', message: 'Unexpected error' });
  }
};
