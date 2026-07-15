"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonRetryableError = exports.ExternalApiError = exports.ConfigurationError = exports.ValidationError = exports.NotFoundError = exports.AppError = void 0;
exports.errorMessage = errorMessage;
/** Base class for domain errors that carry a user-presentable message. */
class AppError extends Error {
    code;
    retryable;
    constructor(message, code, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = new.target.name;
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(entity, id) {
        super(id ? `${entity} not found: ${id}` : `${entity} not found`, 'NOT_FOUND', false);
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 'VALIDATION', false);
    }
}
exports.ValidationError = ValidationError;
class ConfigurationError extends AppError {
    constructor(message) {
        super(message, 'CONFIGURATION', false);
    }
}
exports.ConfigurationError = ConfigurationError;
/** External API failure — retryable by default (rate limits, 5xx, network). */
class ExternalApiError extends AppError {
    api;
    statusCode;
    constructor(api, message, statusCode, retryable = true) {
        super(`[${api}] ${message}`, 'EXTERNAL_API', retryable);
        this.api = api;
        this.statusCode = statusCode;
    }
}
exports.ExternalApiError = ExternalApiError;
/** Thrown to signal BullMQ that the job must NOT be retried. */
class NonRetryableError extends AppError {
    constructor(message) {
        super(message, 'NON_RETRYABLE', false);
    }
}
exports.NonRetryableError = NonRetryableError;
function errorMessage(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
//# sourceMappingURL=errors.js.map