import { openDB, type IDBPDatabase } from 'idb';
import type { QueuedEvent, StorageAdapter } from '../types';

const DB_NAME = 'analytics-sdk';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export class IndexedDBStorage implements StorageAdapter {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async initDB(): Promise<void> {
    if (this.db) return;
    
    if (!this.initPromise) {
      this.initPromise = this._initDB();
    }
    
    await this.initPromise;
  }

  private async _initDB(): Promise<void> {
    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp');
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  async store(events: QueuedEvent[]): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await Promise.all(events.map(event => store.put(event)));
    await tx.done;
  }

  async getAll(): Promise<QueuedEvent[]> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    return index.getAll();
  }

  async remove(ids: string[]): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await Promise.all(ids.map(id => store.delete(id)));
    await tx.done;
  }

  async clear(): Promise<void> {
    await this.initDB();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    await tx.done;
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!('indexedDB' in window)) return false;
    
    try {
      await this.initDB();
      return this.db !== null;
    } catch {
      return false;
    }
  }
}