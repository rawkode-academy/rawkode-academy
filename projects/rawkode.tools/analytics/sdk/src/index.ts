export { AnalyticsClient } from './core/analytics-client';
export type {
  AnalyticsConfig,
  TrackingEvent,
  EventMetadata,
  BatchResponse,
  ErrorResponse
} from './types';

// Export CloudEvent types for advanced usage
export type { CloudEvent, CloudEventV1 } from 'cloudevents';

// Version
export const VERSION = '1.0.0';