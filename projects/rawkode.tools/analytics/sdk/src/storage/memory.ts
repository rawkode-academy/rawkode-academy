import type { QueuedEvent, StorageAdapter } from '../types';

/**
 * In-memory storage adapter for environments where IndexedDB is not available
 */
export class MemoryStorage implements StorageAdapter {
  private events: Map<string, QueuedEvent> = new Map();

  async store(events: QueuedEvent[]): Promise<void> {
    for (const event of events) {
      this.events.set(event.id, event);
    }
  }

  async getAll(): Promise<QueuedEvent[]> {
    return Array.from(this.events.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  async remove(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.events.delete(id);
    }
  }

  async clear(): Promise<void> {
    this.events.clear();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}