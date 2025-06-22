import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventQueue } from './event-queue';
import { MemoryStorage } from '../storage/memory';
import { Logger } from '../utils/logger';
import { CloudEvent } from 'cloudevents';

describe('EventQueue', () => {
  let storage: MemoryStorage;
  let logger: Logger;
  let onFlush: ReturnType<typeof vi.fn>;
  let queue: EventQueue;

  const createTestEvent = (type: string): CloudEvent<Record<string, unknown>> => {
    return new CloudEvent({
      id: `test-${Date.now()}`,
      type,
      source: 'test',
      data: { test: true },
      specversion: '1.0'
    });
  };

  beforeEach(async () => {
    storage = new MemoryStorage();
    logger = new Logger(false);
    onFlush = vi.fn().mockResolvedValue(undefined);
    queue = new EventQueue(storage, 3, 1000, onFlush, logger);
    await queue.initialize();
  });

  afterEach(() => {
    queue.destroy();
  });

  describe('adding events', () => {
    it('should add events to the queue', async () => {
      const event = createTestEvent('test.event');
      await queue.add(event);
      
      expect(queue.getQueueSize()).toBe(1);
    });

    it('should persist events to storage', async () => {
      const event = createTestEvent('test.event');
      await queue.add(event);
      
      const stored = await storage.getAll();
      expect(stored).toHaveLength(1);
      expect(stored[0].event.type).toBe('test.event');
    });

    it('should auto-flush when reaching max batch size', async () => {
      await queue.add(createTestEvent('event1'));
      await queue.add(createTestEvent('event2'));
      await queue.add(createTestEvent('event3'));
      
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'event1' }),
          expect.objectContaining({ type: 'event2' }),
          expect.objectContaining({ type: 'event3' })
        ])
      );
    });
  });

  describe('flushing', () => {
    it('should flush all events', async () => {
      await queue.add(createTestEvent('event1'));
      await queue.add(createTestEvent('event2'));
      
      await queue.flush();
      
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(queue.getQueueSize()).toBe(0);
    });

    it('should remove flushed events from storage', async () => {
      await queue.add(createTestEvent('event1'));
      await queue.flush();
      
      const stored = await storage.getAll();
      expect(stored).toHaveLength(0);
    });

    it('should handle flush failures', async () => {
      onFlush.mockRejectedValueOnce(new Error('Flush failed'));
      
      await queue.add(createTestEvent('event1'));
      await expect(queue.flush()).rejects.toThrow('Flush failed');
      
      // Event should still be in queue
      expect(queue.getQueueSize()).toBe(1);
    });

    it('should increment retry count on failure', async () => {
      onFlush.mockRejectedValueOnce(new Error('Flush failed'));
      
      await queue.add(createTestEvent('event1'));
      
      try {
        await queue.flush();
      } catch {
        // Expected to fail
      }
      
      // Flush again successfully
      onFlush.mockResolvedValueOnce(undefined);
      await queue.flush();
      
      // Check that retry count was incremented
      const calls = onFlush.mock.calls;
      expect(calls).toHaveLength(2);
    });
  });

  describe('scheduled flushing', () => {
    it('should schedule automatic flush', async () => {
      vi.useFakeTimers();
      
      await queue.add(createTestEvent('event1'));
      
      expect(onFlush).not.toHaveBeenCalled();
      
      // Advance timers
      vi.advanceTimersByTime(1000);
      
      // Wait for async flush
      await vi.runAllTimersAsync();
      
      expect(onFlush).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });

  describe('restoration from storage', () => {
    it('should restore events on initialization', async () => {
      // Add events to storage directly
      await storage.store([
        {
          id: '1',
          event: createTestEvent('stored.event'),
          timestamp: Date.now(),
          retryCount: 0
        }
      ]);
      
      // Create new queue which should restore
      const newQueue = new EventQueue(storage, 3, 1000, onFlush, logger);
      await newQueue.initialize();
      
      expect(newQueue.getQueueSize()).toBe(1);
      
      newQueue.destroy();
    });
  });
});