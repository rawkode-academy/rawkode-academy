# Analytics SDK

A production-ready frontend event collection SDK with batching, offline support, and compression.

## Features

- **Event Batching**: Automatically batches events (up to 100 events or 30 seconds)
- **Offline Support**: Uses IndexedDB to persist events when offline
- **Retry Logic**: Exponential backoff with configurable retry attempts
- **Compression**: Optional gzip compression for reduced bandwidth usage
- **Type Safety**: Full TypeScript support with comprehensive types
- **Automatic Tracking**: Optional automatic tracking of page views, clicks, and errors
- **Session Management**: Automatic session ID generation and persistence
- **CloudEvents**: Uses CloudEvents specification for standardized event format

## Installation

```bash
npm install @rawkode-tools/analytics-sdk
```

## Quick Start

```typescript
import { AnalyticsClient } from '@rawkode-tools/analytics-sdk';

// Initialize the client
const analytics = new AnalyticsClient({
  endpoint: 'https://your-domain.com/analytics/events/batch',
  debug: true
});

// Initialize (required before tracking)
await analytics.initialize();

// Track a custom event
await analytics.track({
  type: 'button.clicked',
  data: {
    buttonId: 'cta-hero',
    label: 'Get Started'
  }
});

// Set user ID for all future events
analytics.setUserId('user-123');

// Flush all queued events immediately
await analytics.flush();

// Clean up when done
await analytics.destroy();
```

## Configuration Options

```typescript
const analytics = new AnalyticsClient({
  // API endpoint for batch events
  endpoint: '/analytics/events/batch',
  
  // Maximum events per batch
  maxBatchSize: 100,
  
  // Time before automatic flush (ms)
  flushInterval: 30000,
  
  // Enable debug logging
  debug: false,
  
  // Enable gzip compression
  enableCompression: true,
  
  // Store events in IndexedDB when offline
  enableOfflineSupport: true,
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  
  // Custom headers
  headers: {
    'X-API-Key': 'your-api-key'
  },
  
  // CloudEvent source
  source: 'https://your-app.com',
  
  // Automatic tracking
  trackPageViews: true,
  trackClicks: true,
  trackErrors: true
});
```

## Usage Examples

### Basic Event Tracking

```typescript
// Track a simple event
await analytics.track({
  type: 'user.signup',
  data: {
    plan: 'premium',
    referrer: 'landing-page'
  }
});

// Track with metadata
await analytics.track({
  type: 'video.played',
  data: {
    videoId: '12345',
    duration: 120
  },
  metadata: {
    experiment: 'video-thumbnails-a',
    variant: 'control'
  }
});

// Track with subject (for entity-specific events)
await analytics.track({
  type: 'product.viewed',
  subject: 'product-123',
  data: {
    name: 'Premium Widget',
    price: 99.99,
    category: 'widgets'
  }
});
```

### User Identification

```typescript
// Set user ID (persisted to localStorage)
analytics.setUserId('user-123');

// Get current user ID
const userId = analytics.getUserId();

// Events will automatically include user ID
await analytics.track({
  type: 'subscription.upgraded',
  data: { plan: 'enterprise' }
});
```

### Session Management

```typescript
// Get current session ID
const sessionId = analytics.getSessionId();

// Session ID is automatically included in all events
// and persists for the browser session
```

### Manual Flush Control

```typescript
// Flush events immediately (useful before navigation)
window.addEventListener('beforeunload', async () => {
  await analytics.flush();
});

// Or in a React component
useEffect(() => {
  return () => {
    analytics.flush();
  };
}, []);
```

### Error Handling

```typescript
try {
  await analytics.track({
    type: 'payment.completed',
    data: { amount: 99.99 }
  });
} catch (error) {
  console.error('Failed to track event:', error);
  // Events are queued and will retry automatically
}
```

### Offline Support

Events are automatically queued in IndexedDB when offline:

```typescript
// Events tracked while offline are stored
await analytics.track({
  type: 'offline.action',
  data: { timestamp: Date.now() }
});

// When connection returns, events are automatically sent
// You can also manually trigger a flush
window.addEventListener('online', () => {
  analytics.flush();
});
```

## Event Structure

Events follow the CloudEvents specification:

```typescript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: "button.clicked",
  source: "https://your-app.com",
  time: "2024-01-01T12:00:00Z",
  data: {
    buttonId: "cta-hero",
    label: "Get Started",
    sessionId: "session-123",
    userId: "user-123",
    timestamp: "2024-01-01T12:00:00Z",
    url: "https://your-app.com/home",
    userAgent: "Mozilla/5.0..."
  }
}
```

## Automatic Tracking

### Page Views

```typescript
const analytics = new AnalyticsClient({
  trackPageViews: true
});

// Automatically tracks:
// - Initial page load
// - Browser navigation (back/forward)
// - SPA navigation (pushState/replaceState)
```

### Click Tracking

```typescript
const analytics = new AnalyticsClient({
  trackClicks: true
});

// Automatically tracks clicks on:
// - Links (<a> tags)
// - Buttons (<button> tags)
// Includes: tag name, text, class, ID, href
```

### Error Tracking

```typescript
const analytics = new AnalyticsClient({
  trackErrors: true
});

// Automatically tracks:
// - JavaScript errors
// - Unhandled promise rejections
// Includes: message, file, line/column, stack trace
```

## Performance Considerations

### Batching Strategy

- Events are batched to reduce network requests
- Batches are sent when reaching 100 events or after 30 seconds
- Configure based on your traffic patterns:

```typescript
// High-traffic application
const analytics = new AnalyticsClient({
  maxBatchSize: 100,
  flushInterval: 10000 // 10 seconds
});

// Low-traffic application
const analytics = new AnalyticsClient({
  maxBatchSize: 20,
  flushInterval: 60000 // 1 minute
});
```

### Compression

Enable compression for large payloads:

```typescript
const analytics = new AnalyticsClient({
  enableCompression: true // Gzip compression
});
```

### Memory Management

- Events are stored in IndexedDB, not memory
- Failed events are retried with exponential backoff
- Old events can be cleared:

```typescript
// Clear all stored events
await analytics.destroy();
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

Requires support for:
- Fetch API
- IndexedDB (optional, falls back to memory)
- Compression Streams API (optional)

## TypeScript Support

Full TypeScript support with comprehensive types:

```typescript
import type { 
  AnalyticsConfig, 
  TrackingEvent,
  EventMetadata 
} from '@rawkode-tools/analytics-sdk';

const config: AnalyticsConfig = {
  endpoint: 'https://api.example.com/events',
  debug: true
};

const event: TrackingEvent = {
  type: 'custom.event',
  data: { key: 'value' },
  metadata: { experiment: 'A' }
};
```

## Security Considerations

- No sensitive data should be included in events
- Use HTTPS endpoints only
- Consider implementing API key authentication:

```typescript
const analytics = new AnalyticsClient({
  headers: {
    'Authorization': 'Bearer your-api-key'
  }
});
```

## License

MIT