import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsClient } from './analytics-client';
import type { TrackingEvent } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('AnalyticsClient', () => {
  let client: AnalyticsClient;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    
    // Mock successful response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, events_received: 1 })
    });

    client = new AnalyticsClient({
      endpoint: 'https://example.com/analytics',
      flushInterval: 100, // Short interval for testing
      enableOfflineSupport: false // Disable for simpler testing
    });
  });

  afterEach(async () => {
    await client.destroy();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(client.initialize()).resolves.toBeUndefined();
    });

    it('should only initialize once', async () => {
      await client.initialize();
      await client.initialize(); // Should not throw
    });
  });

  describe('tracking', () => {
    it('should track a simple event', async () => {
      await client.initialize();
      
      const event: TrackingEvent = {
        type: 'test.event',
        data: { foo: 'bar' }
      };

      await client.track(event);
      
      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as any).mock.calls[0];
      
      expect(url).toBe('https://example.com/analytics');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(options.body);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].type).toBe('test.event');
      expect(body.events[0].data.foo).toBe('bar');
    });

    it('should batch multiple events', async () => {
      await client.initialize();
      
      // Track multiple events quickly
      await client.track({ type: 'event1', data: {} });
      await client.track({ type: 'event2', data: {} });
      await client.track({ type: 'event3', data: {} });
      
      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.events).toHaveLength(3);
    });

    it('should include metadata in events', async () => {
      await client.initialize();
      
      const event: TrackingEvent = {
        type: 'test.event',
        data: { action: 'click' },
        metadata: { customField: 'value' }
      };

      await client.track(event);
      await client.flush();

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.events[0].data.customField).toBe('value');
    });

    it('should handle user ID', async () => {
      await client.initialize();
      
      client.setUserId('user123');
      
      await client.track({ type: 'test', data: {} });
      await client.flush();

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.events[0].data.userId).toBe('user123');
    });
  });

  describe('error handling', () => {
    it('should retry on server errors', async () => {
      // First call fails, second succeeds
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, events_received: 1 })
        });

      await client.initialize();
      await client.track({ type: 'test', data: {} });
      await client.flush();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":"Invalid event"}'
      });

      await client.initialize();
      await client.track({ type: 'test', data: {} });
      
      await expect(client.flush()).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('compression', () => {
    it('should compress payloads when enabled', async () => {
      const compressedClient = new AnalyticsClient({
        endpoint: 'https://example.com/analytics',
        enableCompression: true,
        enableOfflineSupport: false
      });

      await compressedClient.initialize();
      await compressedClient.track({ type: 'test', data: { large: 'x'.repeat(1000) } });
      await compressedClient.flush();

      const [, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers['Content-Encoding']).toBe('gzip');
      expect(options.headers['Content-Type']).toBe('application/octet-stream');
      expect(options.body).toBeInstanceOf(Uint8Array);

      await compressedClient.destroy();
    });
  });

  describe('session management', () => {
    it('should generate and maintain session ID', async () => {
      await client.initialize();
      
      const sessionId = client.getSessionId();
      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^[0-9a-f-]+$/);
      
      // Session ID should remain the same
      expect(client.getSessionId()).toBe(sessionId);
    });
  });
});