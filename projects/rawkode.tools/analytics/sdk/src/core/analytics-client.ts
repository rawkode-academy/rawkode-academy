import { CloudEvent, CloudEventV1 } from 'cloudevents';
import type { AnalyticsConfig, TrackingEvent, StorageAdapter } from '../types';
import { EventQueue } from './event-queue';
import { HttpClient } from './http-client';
import { IndexedDBStorage } from '../storage/indexeddb';
import { MemoryStorage } from '../storage/memory';
import { Logger } from '../utils/logger';
import { generateUUID } from '../utils/uuid';

const DEFAULT_CONFIG: Required<AnalyticsConfig> = {
  endpoint: '/analytics/events/batch',
  maxBatchSize: 100,
  flushInterval: 30000,
  debug: false,
  enableCompression: true,
  enableOfflineSupport: true,
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  headers: {},
  source: typeof window !== 'undefined' ? window.location.origin : 'unknown',
  trackPageViews: false,
  trackClicks: false,
  trackErrors: false
};

export class AnalyticsClient {
  private readonly config: Required<AnalyticsConfig>;
  private readonly logger: Logger;
  private readonly httpClient: HttpClient;
  private readonly storage: StorageAdapter;
  private eventQueue: EventQueue | null = null;
  private sessionId: string;
  private isOnline: boolean = true;
  private initialized: boolean = false;

  constructor(config: AnalyticsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(this.config.debug);
    this.sessionId = this.generateSessionId();

    // Initialize HTTP client
    this.httpClient = new HttpClient({
      endpoint: this.config.endpoint,
      headers: this.config.headers,
      enableCompression: this.config.enableCompression,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      maxRetryDelay: this.config.maxRetryDelay,
      logger: this.logger
    });

    // Initialize storage
    this.storage = this.config.enableOfflineSupport 
      ? new IndexedDBStorage() 
      : new MemoryStorage();

    // Set up online/offline listeners
    this.setupNetworkListeners();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if storage is available
      const storageAvailable = await this.storage.isAvailable();
      if (!storageAvailable && this.config.enableOfflineSupport) {
        this.logger.warn('IndexedDB not available, falling back to memory storage');
      }

      // Initialize event queue
      this.eventQueue = new EventQueue(
        this.storage,
        this.config.maxBatchSize,
        this.config.flushInterval,
        (events) => this.sendBatch(events),
        this.logger
      );

      // Set up automatic tracking if enabled
      if (this.config.trackPageViews) {
        this.setupPageViewTracking();
      }
      if (this.config.trackClicks) {
        this.setupClickTracking();
      }
      if (this.config.trackErrors) {
        this.setupErrorTracking();
      }

      this.initialized = true;
      this.logger.info('Analytics client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize analytics client', error);
      throw error;
    }
  }

  async track(event: TrackingEvent): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cloudEvent = this.createCloudEvent(event);
    this.logger.debug('Tracking event', cloudEvent);

    if (!this.eventQueue) {
      throw new Error('Analytics client not initialized');
    }

    await this.eventQueue.add(cloudEvent);
  }

  async flush(): Promise<void> {
    if (!this.eventQueue) {
      throw new Error('Analytics client not initialized');
    }

    await this.eventQueue.flushAll();
  }

  async destroy(): Promise<void> {
    if (this.eventQueue) {
      await this.eventQueue.flushAll();
      this.eventQueue.destroy();
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    this.initialized = false;
    this.logger.info('Analytics client destroyed');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setUserId(userId: string): void {
    // Store user ID for future events
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('analytics_user_id', userId);
    }
  }

  getUserId(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('analytics_user_id');
    }
    return null;
  }

  private createCloudEvent(event: TrackingEvent): CloudEvent<Record<string, unknown>> {
    const eventData: Record<string, unknown> = {
      ...event.data,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    };

    // Add user ID if available
    const userId = this.getUserId();
    if (userId) {
      eventData.userId = userId;
    }

    // Add metadata
    if (event.metadata) {
      Object.assign(eventData, event.metadata);
    }

    const ce = new CloudEventV1<Record<string, unknown>>({
      id: generateUUID(),
      type: event.type,
      source: this.config.source,
      subject: event.subject,
      data: eventData,
      datacontenttype: 'application/json',
      time: new Date().toISOString()
    });

    return ce;
  }

  private async sendBatch(events: CloudEvent[]): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Client is offline');
    }

    await this.httpClient.sendBatch(events);
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    this.isOnline = navigator.onLine;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    this.logger.info('Client is online');
    this.isOnline = true;
    
    // Try to flush queued events
    if (this.eventQueue) {
      this.eventQueue.flush().catch(error => {
        this.logger.error('Failed to flush events after coming online', error);
      });
    }
  };

  private handleOffline = (): void => {
    this.logger.info('Client is offline');
    this.isOnline = false;
  };

  private setupPageViewTracking(): void {
    if (typeof window === 'undefined') return;

    // Track initial page view
    this.track({
      type: 'pageview',
      data: {
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        referrer: document.referrer,
        title: document.title
      }
    }).catch(error => {
      this.logger.error('Failed to track page view', error);
    });

    // Track navigation changes (for SPAs)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleNavigation();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleNavigation();
    };

    window.addEventListener('popstate', () => {
      this.handleNavigation();
    });
  }

  private handleNavigation(): void {
    this.track({
      type: 'pageview',
      data: {
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        title: document.title
      }
    }).catch(error => {
      this.logger.error('Failed to track navigation', error);
    });
  }

  private setupClickTracking(): void {
    if (typeof window === 'undefined') return;

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a, button');
      
      if (link) {
        const data: Record<string, unknown> = {
          tagName: link.tagName.toLowerCase(),
          text: link.textContent?.trim() || '',
          className: link.className,
          id: link.id
        };

        if (link instanceof HTMLAnchorElement) {
          data.href = link.href;
        }

        this.track({
          type: 'click',
          data,
          subject: link.id || undefined
        }).catch(error => {
          this.logger.error('Failed to track click', error);
        });
      }
    }, true);
  }

  private setupErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.track({
        type: 'error',
        data: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      }).catch(error => {
        this.logger.error('Failed to track error', error);
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track({
        type: 'unhandledrejection',
        data: {
          reason: event.reason?.toString(),
          promise: event.promise?.toString()
        }
      }).catch(error => {
        this.logger.error('Failed to track unhandled rejection', error);
      });
    });
  }

  private generateSessionId(): string {
    // Try to restore session ID from sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const existingId = window.sessionStorage.getItem('analytics_session_id');
      if (existingId) {
        return existingId;
      }

      const newId = generateUUID();
      window.sessionStorage.setItem('analytics_session_id', newId);
      return newId;
    }

    return generateUUID();
  }
}