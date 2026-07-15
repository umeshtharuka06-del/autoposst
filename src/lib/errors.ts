/** Base class for domain errors that carry a user-presentable message. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} not found: ${id}` : `${entity} not found`, 'NOT_FOUND', false);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION', false);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION', false);
  }
}

/** External API failure — retryable by default (rate limits, 5xx, network). */
export class ExternalApiError extends AppError {
  constructor(
    public readonly api: string,
    message: string,
    public readonly statusCode?: number,
    retryable = true,
  ) {
    super(`[${api}] ${message}`, 'EXTERNAL_API', retryable);
  }
}

/** Thrown to signal BullMQ that the job must NOT be retried. */
export class NonRetryableError extends AppError {
  constructor(message: string) {
    super(message, 'NON_RETRYABLE', false);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
