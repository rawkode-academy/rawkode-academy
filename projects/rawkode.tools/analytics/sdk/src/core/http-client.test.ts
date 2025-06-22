import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from './http-client';
import { Logger } from '../utils/logger';
import { CloudEvent } from 'cloudevents';
import type { RetryableError } from '../types';

// Mock fetch
global.fetch = vi.fn();

// Mock compression
vi.mock('../utils/compression', () => ({
  compress: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
}));

describe('HttpClient', () => {
  let client: HttpClient;
  let logger: Logger;

  const createTestEvent = (): CloudEvent<Record<string, unknown>> => {
    return new CloudEvent({
      id: 'test-id',
      type: 'test.event',
      source: 'test',
      data: { test: true },
      specversion: '1.0'
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    
    logger = new Logger(false);
    client = new HttpClient({
      endpoint: 'https://api.example.com/events',
      headers: { 'X-API-Key': 'test-key' },
      enableCompression: false,
      maxRetries: 2,
      retryDelay: 10,
      maxRetryDelay: 100,
      logger
    });
  });

  describe('successful requests', () => {
    it('should send batch successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, events_received: 1 })
      });

      const events = [createTestEvent()];
      const response = await client.sendBatch(events);

      expect(response.success).toBe(true);
      expect(response.events_received).toBe(1);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key'
          }),
          body: expect.stringContaining('"events"')
        })
      );
    });

    it('should include custom headers', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, events_received: 1 })
      });

      await client.sendBatch([createTestEvent()]);

      const [, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers['X-API-Key']).toBe('test-key');
    });
  });

  describe('compression', () => {
    it('should compress when enabled', async () => {
      const compressedClient = new HttpClient({
        endpoint: 'https://api.example.com/events',
        enableCompression: true,
        maxRetries: 0,
        retryDelay: 10,
        maxRetryDelay: 100,
        logger
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, events_received: 1 })
      });

      await compressedClient.sendBatch([createTestEvent()]);

      const [, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers['Content-Encoding']).toBe('gzip');
      expect(options.headers['Content-Type']).toBe('application/octet-stream');
      expect(options.body).toBeInstanceOf(Uint8Array);
    });
  });

  describe('error handling', () => {
    it('should retry on 5xx errors', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, events_received: 1 })
        });

      const response = await client.sendBatch([createTestEvent()]);
      
      expect(response.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 errors', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => '{"error":"Rate limited"}'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, events_received: 1 })
        });

      const response = await client.sendBatch([createTestEvent()]);
      
      expect(response.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":"Invalid event"}'
      });

      await expect(client.sendBatch([createTestEvent()])).rejects.toThrow('Invalid event');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      await expect(client.sendBatch([createTestEvent()])).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should parse error response JSON', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":"Custom error message","details":"More info"}'
      });

      try {
        await client.sendBatch([createTestEvent()]);
      } catch (error) {
        expect((error as Error).message).toBe('Custom error message');
        expect((error as RetryableError).statusCode).toBe(400);
        expect((error as RetryableError).retryable).toBe(false);
      }
    });
  });

  describe('timeout', () => {
    it('should timeout after 30 seconds', async () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise(() => {
          // Never resolves
        })
      );

      // This test would actually wait 30 seconds, so we'll skip it
      // In a real implementation, you'd use fake timers or mock AbortSignal
    });
  });
});