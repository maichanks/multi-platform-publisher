export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  factor?: number;
  jitter?: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: any,
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Execute an async function with retry logic using exponential backoff.
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @param shouldRetry - Optional predicate to determine if error is retryable
 */
export async function withRetry<T>(
  fn: (...args: any[]) => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  shouldRetry?: (error: any) => boolean,
): Promise<T> {
  let lastError: any;
  const { maxAttempts, baseDelayMs, maxDelayMs, factor = 2, jitter = true } = config;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw
      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable
      const isRetryable = shouldRetry ? shouldRetry(error) : isRetryableError(error);
      if (!isRetryable) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(factor, attempt - 1) + (jitter ? Math.random() * baseDelayMs : 0),
        maxDelayMs,
      );

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError,
  );
}

/**
 * Determine if an error is retryable based on its properties
 */
export function isRetryableError(error: any): boolean {
  // Network errors (no response)
  if (!error.response) {
    return true;
  }

  // HTTP status codes that are typically retryable
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  const status = error.response?.status;

  if (status && retryableStatuses.includes(status)) {
    return true;
  }

  // Platform-specific rate limit errors
  const errorCode = error.response?.data?.error_code || error.response?.data?.code;
  const retryableCodes = ['rate_limit', 'too_many_requests', 'throttled', 'RATE_LIMIT_EXCEEDED'];
  if (errorCode && retryableCodes.some(code => errorCode.toLowerCase().includes(code))) {
    return true;
  }

  return false;
}

/**
 * Platform-specific retry configurations
 */
export const PLATFORM_RETRY_CONFIGS: Record<string, RetryConfig> = {
  twitter: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },
  reddit: {
    maxAttempts: 2,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
  },
  linkedin: {
    maxAttempts: 2,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
  },
};
