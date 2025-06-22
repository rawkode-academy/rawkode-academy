import { vi } from 'vitest';

/**
 * Test utility functions for consistent test execution
 */

/**
 * Wait for a condition to be true with exponential backoff
 * @param condition Function that returns true when condition is met
 * @param options Configuration for retry behavior
 * @returns Promise that resolves when condition is met or timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    timeoutMs?: number;
    description?: string;
  } = {}
): Promise<void> {
  const {
    maxRetries = 50,
    initialDelay = 10,
    maxDelay = 1000,
    timeoutMs = 5000,
    description = 'condition to be met',
  } = options;

  const startTime = Date.now();
  let delay = initialDelay;
  let attempt = 0;

  while (attempt < maxRetries) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    try {
      const result = await condition();
      if (result) {
        return;
      }
    } catch (error) {
      // Ignore errors and retry
    }

    await sleep(delay);
    
    // Exponential backoff with jitter
    delay = Math.min(delay * 1.5 + Math.random() * 10, maxDelay);
    attempt++;
  }

  throw new Error(`Failed waiting for ${description} after ${attempt} attempts`);
}

/**
 * Retry an async operation with exponential backoff
 * @param operation Function to retry
 * @param options Retry configuration
 * @returns Result of the operation
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error) || attempt === maxRetries - 1) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      await sleep(delay);
      
      // Exponential backoff with jitter
      delay = Math.min(delay * 2 + Math.random() * 100, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for coordination between async operations
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: any) => void;
  
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Mock R2 bucket with realistic behavior including eventual consistency
 */
export class MockR2Bucket {
  private storage = new Map<string, any>();
  private writeDelay: number;
  private readDelay: number;
  private failureRate: number;
  private consistencyDelay: number;
  private pendingWrites = new Map<string, { value: any; timestamp: number }>();

  constructor(options: {
    writeDelay?: number;
    readDelay?: number;
    failureRate?: number;
    consistencyDelay?: number;
  } = {}) {
    this.writeDelay = options.writeDelay ?? 10;
    this.readDelay = options.readDelay ?? 5;
    this.failureRate = options.failureRate ?? 0;
    this.consistencyDelay = options.consistencyDelay ?? 50;
  }

  async put(key: string, value: any, options?: any): Promise<void> {
    await sleep(this.writeDelay);
    
    if (Math.random() < this.failureRate) {
      throw new Error('NetworkError: Transient network error');
    }

    // Simulate eventual consistency
    this.pendingWrites.set(key, { value, timestamp: Date.now() });
    
    // Apply write after consistency delay
    setTimeout(() => {
      this.storage.set(key, value);
      this.pendingWrites.delete(key);
    }, this.consistencyDelay);
  }

  async get(key: string): Promise<any> {
    await sleep(this.readDelay);
    
    if (Math.random() < this.failureRate) {
      throw new Error('NetworkError: Transient network error');
    }

    // Check if there's a pending write that hasn't been applied yet
    const pending = this.pendingWrites.get(key);
    if (pending && Date.now() - pending.timestamp < this.consistencyDelay) {
      // Return stale data or null during consistency window
      return this.storage.has(key) ? this.createR2Object(key, this.storage.get(key)) : null;
    }

    const value = this.storage.get(key);
    return value ? this.createR2Object(key, value) : null;
  }

  async list(options?: { prefix?: string }): Promise<{ objects: Array<{ key: string }> }> {
    await sleep(this.readDelay);

    const prefix = options?.prefix ?? '';
    const objects = Array.from(this.storage.keys())
      .filter(key => key.startsWith(prefix))
      .map(key => ({ key }));

    return { objects };
  }

  async delete(key: string): Promise<void> {
    await sleep(this.writeDelay);
    
    if (Math.random() < this.failureRate) {
      throw new Error('NetworkError: Transient network error');
    }

    this.storage.delete(key);
  }

  private createR2Object(key: string, value: any) {
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    return {
      key,
      body,
      text: async () => body,
      json: async () => typeof value === 'string' ? JSON.parse(value) : value,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    };
  }

  // Test helper methods
  reset() {
    this.storage.clear();
    this.pendingWrites.clear();
  }

  setFailureRate(rate: number) {
    this.failureRate = rate;
  }

  async waitForConsistency() {
    await sleep(this.consistencyDelay + 10);
  }
}

/**
 * Create a controlled async operation that can be paused and resumed
 */
export function createControllableOperation<T>() {
  const checkpoints: Array<() => void> = [];
  let currentCheckpoint = 0;

  const waitForCheckpoint = async () => {
    if (currentCheckpoint < checkpoints.length) {
      await new Promise<void>(resolve => {
        checkpoints[currentCheckpoint] = resolve;
      });
      currentCheckpoint++;
    }
  };

  const proceed = (checkpoint?: number) => {
    const index = checkpoint ?? 0;
    if (checkpoints[index]) {
      checkpoints[index]();
    }
  };

  const proceedAll = () => {
    checkpoints.forEach(checkpoint => checkpoint?.());
  };

  return {
    waitForCheckpoint,
    proceed,
    proceedAll,
  };
}

/**
 * Assert eventual consistency - retry assertion until it passes
 */
export async function assertEventually(
  assertion: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50, message = 'assertion to pass' } = options;
  
  const startTime = Date.now();
  let lastError: any;

  while (Date.now() - startTime < timeout) {
    try {
      await assertion();
      return; // Assertion passed
    } catch (error) {
      lastError = error;
      await sleep(interval);
    }
  }

  throw new Error(`Timeout waiting for ${message}: ${lastError?.message ?? 'Unknown error'}`);
}

/**
 * Run a test multiple times to ensure it's not flaky
 */
export async function ensureStableTest(
  testFn: () => Promise<void>,
  runs: number = 3
): Promise<void> {
  const results: Array<{ success: boolean; error?: any }> = [];

  for (let i = 0; i < runs; i++) {
    try {
      await testFn();
      results.push({ success: true });
    } catch (error) {
      results.push({ success: false, error });
    }
  }

  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    throw new Error(
      `Test failed ${failures.length}/${runs} times. Errors: ${failures
        .map(f => f.error?.message)
        .join(', ')}`
    );
  }
}

/**
 * Create a test clock for controlling time-based operations
 */
export class TestClock {
  private currentTime: number;
  private timers: Array<{
    id: number;
    callback: () => void;
    time: number;
    interval?: number;
  }> = [];
  private nextId = 1;

  constructor(startTime: number = Date.now()) {
    this.currentTime = startTime;
  }

  now(): number {
    return this.currentTime;
  }

  advance(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    while (this.currentTime < targetTime) {
      const nextTimer = this.timers
        .filter(t => t.time <= targetTime)
        .sort((a, b) => a.time - b.time)[0];

      if (!nextTimer) {
        this.currentTime = targetTime;
        break;
      }

      this.currentTime = nextTimer.time;
      nextTimer.callback();

      if (nextTimer.interval) {
        nextTimer.time += nextTimer.interval;
      } else {
        this.timers = this.timers.filter(t => t.id !== nextTimer.id);
      }
    }
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextId++;
    this.timers.push({
      id,
      callback,
      time: this.currentTime + delay,
    });
    return id;
  }

  setInterval(callback: () => void, interval: number): number {
    const id = this.nextId++;
    this.timers.push({
      id,
      callback,
      time: this.currentTime + interval,
      interval,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers = this.timers.filter(t => t.id !== id);
  }

  clearInterval(id: number): void {
    this.clearTimeout(id);
  }

  reset(): void {
    this.timers = [];
    this.currentTime = Date.now();
  }
}