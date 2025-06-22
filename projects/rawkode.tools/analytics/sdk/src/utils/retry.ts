import type { RetryableError } from '../types';

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  onRetry?: (error: Error, attemptNumber: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const retryableError = error as RetryableError;
      if (retryableError.retryable === false) {
        throw error;
      }
      
      // Don't retry on 4xx errors (except 429)
      if (retryableError.statusCode && 
          retryableError.statusCode >= 400 && 
          retryableError.statusCode < 500 &&
          retryableError.statusCode !== 429) {
        throw error;
      }
      
      if (attempt < options.maxRetries) {
        const delay = calculateBackoff(attempt, options.retryDelay, options.maxRetryDelay);
        
        if (options.onRetry) {
          options.onRetry(lastError, attempt + 1);
        }
        
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
  return Math.min(jitteredDelay, maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}