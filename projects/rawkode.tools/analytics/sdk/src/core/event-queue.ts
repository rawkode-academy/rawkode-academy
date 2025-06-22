import type { CloudEvent } from 'cloudevents';
import type { QueuedEvent, StorageAdapter } from '../types';
import { generateUUID } from '../utils/uuid';
import { Logger } from '../utils/logger';

export class EventQueue {
  private queue: QueuedEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly storage: StorageAdapter,
    private readonly maxBatchSize: number,
    private readonly flushInterval: number,
    private readonly onFlush: (events: CloudEvent[]) => Promise<void>,
    private readonly logger: Logger
  ) {
    // Restore happens in initialize() method
  }

  async initialize(): Promise<void> {
    await this.restoreFromStorage();
  }

  async add(event: CloudEvent): Promise<void> {
    const queuedEvent: QueuedEvent = {
      id: generateUUID(),
      event,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedEvent);
    this.logger.debug('Event added to queue', { id: queuedEvent.id, queueSize: this.queue.length });

    // Persist to storage
    try {
      await this.storage.store([queuedEvent]);
    } catch (error) {
      this.logger.warn('Failed to persist event to storage', error);
    }

    // Check if we should flush
    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  async flush(): Promise<void> {
    this.cancelFlushTimer();

    if (this.queue.length === 0) {
      this.logger.debug('No events to flush');
      return;
    }

    // Take a batch of events
    const batch = this.queue.splice(0, this.maxBatchSize);
    const events = batch.map(qe => qe.event);

    this.logger.info(`Flushing ${events.length} events`);

    try {
      await this.onFlush(events);
      
      // Remove successfully sent events from storage
      const ids = batch.map(qe => qe.id);
      await this.storage.remove(ids);
      
      this.logger.info('Events flushed successfully');
    } catch (error) {
      // Put events back in the queue for retry
      this.queue.unshift(...batch.map(qe => ({
        ...qe,
        retryCount: qe.retryCount + 1
      })));
      
      this.logger.error('Failed to flush events', error);
      throw error;
    }

    // Schedule next flush if there are more events
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  async flushAll(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(error => {
        this.logger.error('Scheduled flush failed', error);
      });
    }, this.flushInterval);
  }

  private cancelFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      const storedEvents = await this.storage.getAll();
      if (storedEvents.length > 0) {
        this.queue.push(...storedEvents);
        this.logger.info(`Restored ${storedEvents.length} events from storage`);
        this.scheduleFlush();
      }
    } catch (error) {
      this.logger.error('Failed to restore events from storage', error);
    }
  }

  destroy(): void {
    this.cancelFlushTimer();
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}