import type { CloudEvent } from 'cloudevents';

export interface AnalyticsConfig {
  /**
   * The endpoint URL for the analytics collector
   * @default window.location.origin + '/analytics/events/batch'
   */
  endpoint?: string;

  /**
   * Maximum number of events to batch before sending
   * @default 100
   */
  maxBatchSize?: number;

  /**
   * Maximum time to wait before sending a batch (in milliseconds)
   * @default 30000 (30 seconds)
   */
  flushInterval?: number;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Whether to enable compression for batch requests
   * @default true
   */
  enableCompression?: boolean;

  /**
   * Whether to persist events to IndexedDB when offline
   * @default true
   */
  enableOfflineSupport?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Maximum retry delay in milliseconds
   * @default 30000
   */
  maxRetryDelay?: number;

  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;

  /**
   * Source identifier for CloudEvents
   * @default window.location.origin
   */
  source?: string;

  /**
   * Whether to automatically track page views
   * @default false
   */
  trackPageViews?: boolean;

  /**
   * Whether to automatically track clicks
   * @default false
   */
  trackClicks?: boolean;

  /**
   * Whether to automatically track errors
   * @default false
   */
  trackErrors?: boolean;
}

export interface EventMetadata {
  /** User ID if available */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Custom properties */
  [key: string]: unknown;
}

export interface TrackingEvent {
  /** Event type (e.g., 'pageview', 'click', 'custom') */
  type: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Optional metadata */
  metadata?: EventMetadata;
  /** Optional subject for the CloudEvent */
  subject?: string;
}

export interface BatchRequest {
  events: CloudEvent[];
}

export interface BatchResponse {
  success: boolean;
  events_received: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export interface RetryableError extends Error {
  retryable: boolean;
  statusCode?: number;
}

export interface QueuedEvent {
  id: string;
  event: CloudEvent;
  timestamp: number;
  retryCount: number;
}

export interface StorageAdapter {
  /**
   * Store events to persistent storage
   */
  store(events: QueuedEvent[]): Promise<void>;

  /**
   * Retrieve all stored events
   */
  getAll(): Promise<QueuedEvent[]>;

  /**
   * Remove specific events from storage
   */
  remove(ids: string[]): Promise<void>;

  /**
   * Clear all stored events
   */
  clear(): Promise<void>;

  /**
   * Check if storage is available
   */
  isAvailable(): Promise<boolean>;
}