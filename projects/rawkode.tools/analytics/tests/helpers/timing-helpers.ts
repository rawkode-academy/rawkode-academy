/**
 * Timing helpers for predictable test execution
 */

/**
 * Execute operations with precise timing control
 * This helps avoid flaky tests due to timing variations
 */
export class TimingController {
  private operations: Array<{
    delay: number;
    started: boolean;
    completed: boolean;
  }> = [];

  async runWithTiming<T>(
    operation: () => Promise<T>,
    expectedDelay: number
  ): Promise<T> {
    const op = {
      delay: expectedDelay,
      started: false,
      completed: false,
    };
    
    this.operations.push(op);
    op.started = true;
    
    const startTime = Date.now();
    const result = await operation();
    const actualDelay = Date.now() - startTime;
    
    op.completed = true;
    
    // Allow for some variance in timing (±20%)
    const variance = expectedDelay * 0.2;
    if (Math.abs(actualDelay - expectedDelay) > variance) {
      console.warn(
        `Timing variance detected: expected ${expectedDelay}ms, got ${actualDelay}ms`
      );
    }
    
    return result;
  }

  getCompletedCount(): number {
    return this.operations.filter(op => op.completed).length;
  }

  getTotalDelay(): number {
    return this.operations
      .filter(op => op.completed)
      .reduce((sum, op) => sum + op.delay, 0);
  }

  reset(): void {
    this.operations = [];
  }
}

/**
 * Create a mock timer that can be controlled precisely
 */
export class MockTimer {
  private currentTime: number;
  private timers: Map<number, { callback: () => void; time: number }> = new Map();
  private nextId = 1;

  constructor(startTime: number = 0) {
    this.currentTime = startTime;
  }

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextId++;
    this.timers.set(id, {
      callback,
      time: this.currentTime + delay,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  advance(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    // Execute all timers that should fire
    const toExecute: Array<() => void> = [];
    
    for (const [id, timer] of this.timers.entries()) {
      if (timer.time <= targetTime) {
        toExecute.push(timer.callback);
        this.timers.delete(id);
      }
    }
    
    this.currentTime = targetTime;
    
    // Execute callbacks after updating time
    toExecute.forEach(callback => callback());
  }

  reset(): void {
    this.currentTime = 0;
    this.timers.clear();
  }
}

/**
 * Helper to make timeout tests more predictable
 */
export function createTimeoutTest(options: {
  itemCount: number;
  processTime: number;
  timeout: number;
}): {
  expectedProcessed: number;
  minProcessed: number;
  maxProcessed: number;
} {
  const { itemCount, processTime, timeout } = options;
  
  // Calculate expected items based on timeout
  const expectedProcessed = Math.floor(timeout / processTime);
  
  // Allow for variance due to overhead
  const overhead = 0.2; // 20% overhead
  const minProcessed = Math.max(1, Math.floor(expectedProcessed * (1 - overhead)));
  const maxProcessed = Math.min(itemCount, Math.ceil(expectedProcessed * (1 + overhead)));
  
  return {
    expectedProcessed: Math.min(expectedProcessed, itemCount),
    minProcessed,
    maxProcessed,
  };
}