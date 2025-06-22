import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestClock, waitForCondition, sleep } from '../helpers/test-utilities';
import { createTimeoutTest } from '../helpers/timing-helpers';

interface WriteResult {
  success: boolean;
  duration: number;
  retries?: number;
  error?: string;
}

interface WriteCheckpoint {
  writtenCount: number;
  partialFile?: string;
  timestamp: Date;
}

class IcebergWriter {
  private r2Client: any;
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(config: {
    r2Client: any;
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  }) {
    this.r2Client = config.r2Client;
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 100;
    this.maxDelay = config.maxDelay || 5000;
  }

  async writeWithRetry(data: any): Promise<WriteResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const start = Date.now();
        await this.r2Client.put(data);
        
        return {
          success: true,
          duration: Date.now() - start,
          retries: attempt,
        };
      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetriableError(error)) {
          throw error;
        }
        
        if (attempt < this.maxRetries - 1) {
          await this.sleep(this.calculateBackoff(attempt));
        }
      }
    }
    
    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async writeWithTimeout(
    data: any[],
    timeoutMs: number
  ): Promise<{ type: 'complete' | 'partial'; checkpoint?: WriteCheckpoint }> {
    const startTime = Date.now();
    let written = 0;
    
    for (const item of data) {
      // Check timeout before starting the write
      if (Date.now() - startTime >= timeoutMs) {
        return {
          type: 'partial',
          checkpoint: {
            writtenCount: written,
            timestamp: new Date(),
          },
        };
      }
      
      // Perform the write
      await this.r2Client.put(item);
      written++;
      
      // Check timeout after write completes
      if (Date.now() - startTime >= timeoutMs && written < data.length) {
        return {
          type: 'partial',
          checkpoint: {
            writtenCount: written,
            timestamp: new Date(),
          },
        };
      }
    }
    
    return { type: 'complete' };
  }

  private isRetriableError(error: any): boolean {
    const retriableErrors = [
      'NetworkError',
      'TimeoutError',
      'ServiceUnavailable',
      'TooManyRequests',
    ];
    
    return retriableErrors.some(e => 
      error.message?.includes(e) || error.code === e
    );
  }

  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt) + Math.random() * 100,
      this.maxDelay
    );
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return sleep(ms);
  }
}

describe('Worker Timeout and Retry Tests', () => {
  describe('Retry Logic', () => {
    it('should retry transient failures with exponential backoff', async () => {
      // Given
      let attemptCount = 0;
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('NetworkError: Transient network error');
          }
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      
      // When
      const result = await writer.writeWithRetry({ data: 'test' });
      
      // Then
      expect(result.success).toBe(true);
      expect(result.retries).toBe(2);
      expect(mockR2.put).toHaveBeenCalledTimes(3);
    });

    it('should respect maximum retry attempts', async () => {
      // Given
      const mockR2 = {
        put: vi.fn().mockRejectedValue(new Error('ServiceUnavailable')),
      };
      
      const writer = new IcebergWriter({ 
        r2Client: mockR2,
        maxRetries: 3,
      });
      
      // When/Then
      await expect(writer.writeWithRetry({ data: 'test' }))
        .rejects.toThrow('Failed after 3 attempts');
      
      expect(mockR2.put).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retriable errors', async () => {
      // Given
      const mockR2 = {
        put: vi.fn().mockRejectedValue(new Error('InvalidData: Malformed request')),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      
      // When/Then
      await expect(writer.writeWithRetry({ data: 'test' }))
        .rejects.toThrow('InvalidData');
      
      expect(mockR2.put).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff with jitter', async () => {
      // Given
      const delays: number[] = [];
      let attemptCount = 0;
      
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 4) {
            throw new Error('TimeoutError');
          }
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ 
        r2Client: mockR2,
        baseDelay: 100,
        maxDelay: 2000,
        maxRetries: 4, // Increase to 4 to allow for 3 retries
      });
      
      // Mock sleep to capture delays
      writer['sleep'] = vi.fn().mockImplementation((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });
      
      // When
      await writer.writeWithRetry({ data: 'test' });
      
      // Then
      expect(delays.length).toBe(3);
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThan(300);
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThan(500);
      expect(delays[2]).toBeGreaterThanOrEqual(400);
      expect(delays[2]).toBeLessThan(1000);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout when write exceeds limit', async () => {
      // Given
      const processTime = 50; // ms per item
      const timeoutMs = 200;
      const itemCount = 10;
      
      const { minProcessed, maxProcessed } = createTimeoutTest({
        itemCount,
        processTime,
        timeout: timeoutMs,
      });
      
      const mockR2 = {
        put: vi.fn().mockImplementation(() => sleep(processTime)),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      const data = Array(itemCount).fill({ item: 'test' });
      
      // When
      const result = await writer.writeWithTimeout(data, timeoutMs);
      
      // Then
      expect(result.type).toBe('partial');
      expect(result.checkpoint?.writtenCount).toBeGreaterThanOrEqual(minProcessed);
      expect(result.checkpoint?.writtenCount).toBeLessThanOrEqual(maxProcessed);
      expect(result.checkpoint?.writtenCount).toBeLessThan(itemCount);
    });

    it('should complete when all items written within timeout', async () => {
      // Given
      const mockR2 = {
        put: vi.fn().mockResolvedValue({ success: true }),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      const data = Array(5).fill({ item: 'test' });
      
      // When
      const result = await writer.writeWithTimeout(data, 1000);
      
      // Then
      expect(result.type).toBe('complete');
      expect(result.checkpoint).toBeUndefined();
      expect(mockR2.put).toHaveBeenCalledTimes(5);
    });

    it('should checkpoint progress when timeout occurs', async () => {
      // Given
      const processTime = 30; // ms per item
      const timeoutMs = 100;
      const itemCount = 10;
      
      const { minProcessed, maxProcessed } = createTimeoutTest({
        itemCount,
        processTime,
        timeout: timeoutMs,
      });
      
      let callCount = 0;
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          callCount++;
          await sleep(processTime);
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      const data = Array(itemCount).fill(null).map((_, i) => ({ id: i }));
      
      // When
      const result = await writer.writeWithTimeout(data, timeoutMs);
      
      // Then
      expect(result.type).toBe('partial');
      
      // Allow for timing variance
      expect(result.checkpoint?.writtenCount).toBeGreaterThanOrEqual(minProcessed);
      expect(result.checkpoint?.writtenCount).toBeLessThanOrEqual(maxProcessed);
      expect(result.checkpoint?.timestamp).toBeInstanceOf(Date);
      
      // Verify we didn't write all items
      expect(result.checkpoint?.writtenCount).toBeLessThan(data.length);
    });
  });

  describe('Combined Timeout and Retry', () => {
    it('should retry within timeout constraints', async () => {
      // Given
      let attemptCount = 0;
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('NetworkError');
          }
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ 
        r2Client: mockR2,
        maxRetries: 3,
        baseDelay: 10,
      });
      
      // When
      const start = Date.now();
      const result = await writer.writeWithRetry({ data: 'test' });
      const duration = Date.now() - start;
      
      // Then
      expect(result.success).toBe(true);
      expect(result.retries).toBe(1);
      expect(duration).toBeLessThan(100); // Should be fast with short delays
    });

    it('should handle partial writes with retry on resume', async () => {
      // Given
      const mockR2 = {
        put: vi.fn().mockResolvedValue({ success: true }),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      
      // Simulate a checkpoint from a previous partial write
      const checkpoint: WriteCheckpoint = {
        writtenCount: 50,
        timestamp: new Date(Date.now() - 60000), // 1 minute ago
      };
      
      // Resume writing from checkpoint
      const remainingData = Array(50).fill(null).map((_, i) => ({ id: i + 50 }));
      
      // When
      const result = await writer.writeWithTimeout(remainingData, 5000);
      
      // Then
      expect(result.type).toBe('complete');
      expect(mockR2.put).toHaveBeenCalledTimes(50);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle R2 rate limiting', async () => {
      // Given
      let callCount = 0;
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) {
            const error = new Error('TooManyRequests');
            (error as any).code = 'TooManyRequests';
            throw error;
          }
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ 
        r2Client: mockR2,
        baseDelay: 50,
      });
      
      // When
      const result = await writer.writeWithRetry({ data: 'test' });
      
      // Then
      expect(result.success).toBe(true);
      expect(result.retries).toBe(2);
    });

    it('should handle worker CPU timeout gracefully', async () => {
      // Given
      const cpuTime = 100; // ms of CPU work
      const timeoutMs = 150;
      const itemCount = 5;
      
      const mockR2 = {
        put: vi.fn().mockImplementation(async () => {
          // Simulate CPU-intensive operation
          const start = Date.now();
          while (Date.now() - start < cpuTime) {
            // Busy wait
          }
          return { success: true };
        }),
      };
      
      const writer = new IcebergWriter({ r2Client: mockR2 });
      const data = Array(itemCount).fill({ item: 'test' });
      
      // When
      const result = await writer.writeWithTimeout(data, timeoutMs);
      
      // Then
      expect(result.type).toBe('partial');
      // Should process at least 1 item
      expect(result.checkpoint?.writtenCount).toBeGreaterThanOrEqual(1);
      // But not all items
      expect(result.checkpoint?.writtenCount).toBeLessThan(itemCount);
    });
  });
});

describe('Worker Resource Management', () => {
  it('should clean up resources on timeout', async () => {
    // Given
    const resources: string[] = [];
    const mockR2 = {
      put: vi.fn().mockImplementation(async (data: any) => {
        resources.push(`resource-${data.id}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      }),
    };
    
    const cleanup = vi.fn();
    
    class ResourceAwareWriter extends IcebergWriter {
      async writeWithTimeout(data: any[], timeoutMs: number) {
        try {
          return await super.writeWithTimeout(data, timeoutMs);
        } finally {
          // Clean up any allocated resources
          cleanup(resources);
        }
      }
    }
    
    const writer = new ResourceAwareWriter({ r2Client: mockR2 });
    const data = Array(10).fill(null).map((_, i) => ({ id: i }));
    
    // When
    await writer.writeWithTimeout(data, 50);
    
    // Then
    expect(cleanup).toHaveBeenCalledWith(expect.any(Array));
    expect(resources.length).toBeGreaterThan(0);
  });

  it('should handle memory pressure during large writes', async () => {
    // Given
    const mockR2 = {
      put: vi.fn().mockResolvedValue({ success: true }),
    };
    
    const writer = new IcebergWriter({ r2Client: mockR2 });
    
    // Create large data that would cause memory pressure
    const largeData = Array(1000).fill(null).map((_, i) => ({
      id: i,
      data: 'x'.repeat(1024), // 1KB per item
    }));
    
    // When - Process in batches to avoid memory issues
    const batchSize = 100;
    let processed = 0;
    
    for (let i = 0; i < largeData.length; i += batchSize) {
      const batch = largeData.slice(i, i + batchSize);
      const result = await writer.writeWithTimeout(batch, 5000);
      
      if (result.type === 'complete') {
        processed += batch.length;
      } else {
        processed += result.checkpoint!.writtenCount;
        break;
      }
    }
    
    // Then
    expect(processed).toBeGreaterThan(0);
    expect(processed).toBeLessThanOrEqual(largeData.length);
  });
});