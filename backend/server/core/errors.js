'use strict';

/** Domain error classes mapped deterministically to HTTP status codes. */

class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details = []) {
    super(422, 'ERR_VALIDATION', message, details);
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'ERR_UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'ERR_FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'ERR_NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, 'ERR_CONFLICT', message);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests, slow down and retry') {
    super(429, 'ERR_RATE_LIMITED', message);
    this.name = 'RateLimitError';
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Request body exceeds the allowed size') {
    super(413, 'ERR_PAYLOAD_TOO_LARGE', message);
    this.name = 'PayloadTooLargeError';
  }
}

class QuotaExceededError extends AppError {
  constructor(message = 'Plan quota exceeded', details = []) {
    super(403, 'ERR_QUOTA_EXCEEDED', message, details);
    this.name = 'QuotaExceededError';
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Backing service is temporarily unavailable') {
    super(503, 'ERR_SERVICE_UNAVAILABLE', message);
    this.name = 'ServiceUnavailableError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  PayloadTooLargeError,
  QuotaExceededError,
  ServiceUnavailableError,
};
