/**
 * Error codes: the FastAPI `QlearnError` codes (backend/app/exceptions.py) plus
 * transport-level ones the client produces itself.
 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'SANDBOX_EXECUTION_ERROR'
  | 'INTERNAL_ERROR'
  | 'CMS_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'
  | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(opts: { status: number; code: ApiErrorCode; message: string; details?: unknown }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }

  /** Worth retrying automatically: transient transport or server failures. */
  get isRetryable(): boolean {
    return (
      this.code === 'NETWORK_ERROR' ||
      this.code === 'TIMEOUT' ||
      this.code === 'RATE_LIMITED' ||
      this.status >= 500
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN';
}

/**
 * Build an ApiError from a non-success HTTP response body. Understands the
 * Q-Learn envelope `{success:false, error:{code,message,details}}` and
 * FastAPI's own `{detail: ...}` (raised for request-validation 422s and
 * missing bearer tokens before our handlers run).
 */
export function errorFromResponse(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as Record<string, unknown>;
  const envelope = b.error as { code?: string; message?: string; details?: unknown } | undefined;
  if (envelope && typeof envelope === 'object') {
    return new ApiError({
      status,
      code: status === 429 ? 'RATE_LIMITED' : envelope.code ?? codeForStatus(status),
      message: envelope.message ?? 'Request failed',
      details: envelope.details,
    });
  }
  if ('detail' in b) {
    return new ApiError({
      status,
      code: codeForStatus(status),
      message: typeof b.detail === 'string' ? b.detail : 'Request failed',
      details: b.detail,
    });
  }
  return new ApiError({ status, code: codeForStatus(status), message: `Request failed (${status})` });
}

/**
 * Student-facing copy for an error. Never surfaces server messages for 5xx
 * (they can carry internal detail) and never shows stack traces.
 */
export function toUserMessage(error: unknown): string {
  if (!isApiError(error)) {
    return 'Something went wrong. Please try again.';
  }
  switch (error.code) {
    case 'NETWORK_ERROR':
      return "You're offline or the server can't be reached. Check your connection and try again.";
    case 'TIMEOUT':
      return 'The server took too long to respond. Please try again.';
    case 'RATE_LIMITED':
      return "You're going a bit fast. Wait a moment, then try again.";
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.';
    case 'FORBIDDEN':
      return "You don't have access to this.";
    case 'NOT_FOUND':
      return "We couldn't find that. It may have been moved or removed.";
    case 'VALIDATION_ERROR':
      return error.status < 500 && error.message ? error.message : 'Please check your input and try again.';
    case 'CMS_UNAVAILABLE':
      return 'Lesson content is temporarily unavailable. Please try again soon.';
    case 'SANDBOX_EXECUTION_ERROR':
      return "The quantum simulator couldn't run this circuit. Please try again.";
    default:
      return error.status >= 500
        ? 'Q-Learn is having trouble right now. Please try again in a moment.'
        : 'Something went wrong. Please try again.';
  }
}
