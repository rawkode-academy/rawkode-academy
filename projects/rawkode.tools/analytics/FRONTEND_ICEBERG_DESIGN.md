# Frontend Design Considerations for Iceberg-Based Analytics

## Executive Summary

This document outlines the frontend architecture and design considerations for integrating with an Iceberg-based analytics backend. The design focuses on efficient event collection, optimized query patterns, and responsive data visualization while leveraging Iceberg's capabilities for time travel, schema evolution, and efficient columnar storage.

## Current State Analysis

### Event Collection Architecture
The current system uses CloudEvents format with the following characteristics:
- **Event Structure**: Standardized CloudEvents with type, source, subject, and custom data
- **Collection**: Direct HTTP POST to event collector workers
- **Buffering**: Durable Objects buffer events with 1000 event threshold or 60s timeout
- **Enrichment**: Cloudflare edge data (location, timezone, etc.) added server-side
- **Storage**: Parquet files in R2, partitioned by event type

### Current Limitations
1. No frontend batching - each event sent individually
2. No client-side buffering for offline resilience
3. Limited query capabilities through GraphQL API
4. No real-time data streaming
5. Basic event validation only

## Proposed Frontend Architecture

### 1. Event Collection Layer

#### Enhanced Event SDK
```typescript
interface AnalyticsConfig {
  endpoint: string;
  apiKey: string;
  batchSize?: number;        // Default: 50
  flushInterval?: number;    // Default: 5000ms
  maxRetries?: number;       // Default: 3
  enableOffline?: boolean;   // Default: true
  enrichment?: boolean;      // Default: true
}

class AnalyticsSDK {
  private buffer: CloudEvent[] = [];
  private flushTimer?: number;
  private offlineQueue: CloudEvent[] = [];
  
  constructor(config: AnalyticsConfig) {
    this.setupEventListeners();
    this.initializeOfflineSupport();
  }
  
  track(eventType: string, data: Record<string, any>, options?: TrackOptions) {
    const event = this.createCloudEvent(eventType, data, options);
    this.buffer.push(event);
    
    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }
  
  private async flush() {
    if (this.buffer.length === 0) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      await this.sendBatch(events);
    } catch (error) {
      if (this.config.enableOffline) {
        this.offlineQueue.push(...events);
        this.persistOfflineQueue();
      }
    }
  }
}
```

#### Batching Strategy
1. **Smart Batching**: Combine events based on:
   - Time window (5 second default)
   - Batch size (50 events default)
   - Event priority (immediate vs deferred)
   - Network conditions

2. **Compression**: Use gzip for batch payloads >10KB

3. **Deduplication**: Client-side event ID generation to prevent duplicates

4. **Priority Queues**: 
   - High: User interactions, conversions
   - Medium: Page views, feature usage
   - Low: Background telemetry

### 2. Query Interface Design

#### GraphQL Schema Extensions for Iceberg
```graphql
type Query {
  analytics: Analytics!
}

type Analytics {
  # Time-series queries optimized for Iceberg partitioning
  timeSeries(
    metric: String!
    dimensions: [String!]
    timeRange: TimeRange!
    granularity: TimeGranularity!
    filters: [Filter!]
  ): TimeSeriesResult!
  
  # Snapshot queries leveraging Iceberg time travel
  snapshot(
    table: String!
    timestamp: DateTime!
    filters: [Filter!]
  ): SnapshotResult!
  
  # Aggregation queries
  aggregate(
    metrics: [AggregateMetric!]!
    groupBy: [String!]
    timeRange: TimeRange!
    filters: [Filter!]
  ): AggregateResult!
  
  # Real-time stream for live dashboards
  stream(
    eventTypes: [String!]!
    filters: [Filter!]
  ): EventStream!
}

enum TimeGranularity {
  MINUTE
  HOUR
  DAY
  WEEK
  MONTH
}

type TimeSeriesResult {
  data: [TimeSeriesPoint!]!
  metadata: QueryMetadata!
}

type TimeSeriesPoint {
  timestamp: DateTime!
  value: Float!
  dimensions: JSON
}
```

#### Query Patterns for Dashboards

1. **Pre-aggregated Queries**: Leverage Iceberg's metadata for fast aggregations
   ```typescript
   // Example: Daily active users
   const query = `
     query DailyActiveUsers($timeRange: TimeRange!) {
       analytics {
         timeSeries(
           metric: "unique_users"
           timeRange: $timeRange
           granularity: DAY
         ) {
           data {
             timestamp
             value
           }
         }
       }
     }
   `;
   ```

2. **Dimensional Analysis**: Use Iceberg's column pruning
   ```typescript
   // Example: Events by country
   const query = `
     query EventsByCountry($timeRange: TimeRange!) {
       analytics {
         aggregate(
           metrics: [{ field: "events", function: COUNT }]
           groupBy: ["cf_country"]
           timeRange: $timeRange
         ) {
           data {
             dimensions
             metrics
           }
         }
       }
     }
   `;
   ```

3. **Time Travel Queries**: Compare metrics across time
   ```typescript
   // Example: Week-over-week comparison
   const query = `
     query WeekOverWeek($currentWeek: TimeRange!, $previousWeek: TimeRange!) {
       current: analytics {
         aggregate(
           metrics: [{ field: "revenue", function: SUM }]
           timeRange: $currentWeek
         ) {
           data { metrics }
         }
       }
       previous: analytics {
         aggregate(
           metrics: [{ field: "revenue", function: SUM }]
           timeRange: $previousWeek
         ) {
           data { metrics }
         }
       }
     }
   `;
   ```

### 3. Time-Series Visualization Architecture

#### Component Library
```typescript
// Chart component with Iceberg-optimized data fetching
interface TimeSeriesChartProps {
  metric: string;
  dimensions?: string[];
  timeRange: TimeRange;
  granularity: TimeGranularity;
  refreshInterval?: number;
  enableZoom?: boolean;
  enableExport?: boolean;
}

const TimeSeriesChart: Component<TimeSeriesChartProps> = (props) => {
  const { data, loading, error } = useTimeSeriesQuery({
    metric: props.metric,
    dimensions: props.dimensions,
    timeRange: props.timeRange,
    granularity: props.granularity,
    refreshInterval: props.refreshInterval,
  });
  
  // Render using D3.js or Chart.js with optimizations
  return (
    <ChartContainer>
      {loading && <ChartSkeleton />}
      {error && <ChartError error={error} />}
      {data && (
        <D3TimeSeriesChart
          data={data}
          enableZoom={props.enableZoom}
          onZoom={handleZoom}
        />
      )}
    </ChartContainer>
  );
};
```

#### Visualization Optimizations
1. **Progressive Loading**: Load overview first, details on zoom
2. **Data Sampling**: For large datasets, use Iceberg's sampling capabilities
3. **Adaptive Granularity**: Adjust based on time range
4. **Virtual Scrolling**: For long time series data

### 4. Caching Strategy

#### Multi-Layer Cache Architecture
```typescript
class AnalyticsCacheManager {
  private memoryCache: LRUCache<string, any>;
  private indexedDBCache: IDBCache;
  private serviceWorkerCache: Cache;
  
  async get(key: string): Promise<any> {
    // L1: Memory cache (hot data)
    const memResult = this.memoryCache.get(key);
    if (memResult) return memResult;
    
    // L2: IndexedDB (warm data)
    const idbResult = await this.indexedDBCache.get(key);
    if (idbResult) {
      this.memoryCache.set(key, idbResult);
      return idbResult;
    }
    
    // L3: Service Worker cache (cold data)
    const swResult = await this.serviceWorkerCache.match(key);
    if (swResult) {
      const data = await swResult.json();
      this.promoteToWarmerCaches(key, data);
      return data;
    }
    
    return null;
  }
  
  async set(key: string, data: any, ttl: number) {
    const metadata = {
      timestamp: Date.now(),
      ttl,
      icebergSnapshot: data.snapshotId, // Track Iceberg snapshot
    };
    
    // Write to all cache layers
    this.memoryCache.set(key, data);
    await this.indexedDBCache.set(key, data, metadata);
    await this.serviceWorkerCache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: { 'X-Cache-Metadata': JSON.stringify(metadata) }
      })
    );
  }
}
```

#### Cache Invalidation Strategy
1. **Time-based**: TTL based on query granularity
   - Real-time: 30 seconds
   - Hourly: 5 minutes
   - Daily: 1 hour
   - Monthly: 24 hours

2. **Event-based**: Invalidate on data updates
   - Subscribe to Iceberg table commits
   - Invalidate affected time ranges

3. **Snapshot-based**: Track Iceberg snapshot IDs
   - Invalidate when new snapshot available
   - Enable time-travel with cached snapshots

### 5. Real-time vs Batch Requirements

#### Hybrid Architecture
```typescript
interface AnalyticsDataSource {
  realtime: RealtimeSource;
  batch: BatchSource;
  merger: DataMerger;
}

class HybridAnalyticsProvider implements AnalyticsDataSource {
  async query(request: QueryRequest): Promise<QueryResult> {
    const { timeRange, includeRealtime } = request;
    
    // Determine data sources based on time range
    const now = Date.now();
    const batchCutoff = now - (5 * 60 * 1000); // 5 minutes ago
    
    // Batch data from Iceberg (>5 minutes old)
    const batchPromise = timeRange.start < batchCutoff
      ? this.batch.query({
          ...request,
          timeRange: {
            start: timeRange.start,
            end: Math.min(timeRange.end, batchCutoff)
          }
        })
      : Promise.resolve(null);
    
    // Real-time data from Analytics Engine (<5 minutes)
    const realtimePromise = includeRealtime && timeRange.end > batchCutoff
      ? this.realtime.query({
          ...request,
          timeRange: {
            start: Math.max(timeRange.start, batchCutoff),
            end: timeRange.end
          }
        })
      : Promise.resolve(null);
    
    // Merge results
    const [batchData, realtimeData] = await Promise.all([
      batchPromise,
      realtimePromise
    ]);
    
    return this.merger.merge(batchData, realtimeData);
  }
}
```

#### Use Case Segmentation

1. **Real-time Required** (<5 minute latency):
   - Live user count
   - Active sessions
   - Error rate monitoring
   - Conversion tracking

2. **Near Real-time** (5-15 minute latency):
   - Traffic dashboards
   - Feature usage metrics
   - Performance monitoring

3. **Batch Sufficient** (>15 minute latency):
   - Historical analysis
   - Cohort analysis
   - Revenue reporting
   - User journey analysis

### 6. Frontend SDK Implementation

#### Event Collection SDK
```typescript
// analytics-sdk.ts
export class RawkodeAnalytics {
  private config: AnalyticsConfig;
  private buffer: EventBuffer;
  private offline: OfflineManager;
  private enrichment: EnrichmentProvider;
  
  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.buffer = new EventBuffer(config);
    this.offline = new OfflineManager();
    this.enrichment = new EnrichmentProvider();
    
    this.initialize();
  }
  
  // Core tracking methods
  track(eventType: string, properties?: Record<string, any>) {
    const event = this.createEvent('track', eventType, properties);
    this.buffer.add(event);
  }
  
  page(name?: string, properties?: Record<string, any>) {
    const event = this.createEvent('page', 'page.viewed', {
      name: name || window.location.pathname,
      ...properties
    });
    this.buffer.add(event);
  }
  
  identify(userId: string, traits?: Record<string, any>) {
    const event = this.createEvent('identify', 'user.identified', {
      userId,
      ...traits
    });
    this.buffer.add(event);
  }
  
  // Event creation with CloudEvents format
  private createEvent(
    action: string,
    eventType: string,
    data?: Record<string, any>
  ): CloudEvent {
    return {
      specversion: '1.0',
      id: generateEventId(),
      source: this.config.source || window.location.origin,
      type: eventType,
      time: new Date().toISOString(),
      subject: this.enrichment.getUserId(),
      data: {
        action,
        ...this.enrichment.getContext(),
        ...data
      }
    };
  }
}

// Enrichment provider for client-side context
class EnrichmentProvider {
  getContext(): Record<string, any> {
    return {
      page: {
        url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
        title: document.title,
        referrer: document.referrer
      },
      device: {
        type: this.getDeviceType(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language
      },
      timestamp: Date.now()
    };
  }
  
  getUserId(): string {
    // Get or generate anonymous user ID
    let userId = localStorage.getItem('analytics_user_id');
    if (!userId) {
      userId = generateUserId();
      localStorage.setItem('analytics_user_id', userId);
    }
    return userId;
  }
  
  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}
```

### 7. Performance Optimizations

#### Query Performance
1. **Partition Pruning**: Include partition keys in all queries
2. **Column Projection**: Only request needed fields
3. **Predicate Pushdown**: Filter early in the query
4. **Result Pagination**: Implement cursor-based pagination

#### Frontend Performance
1. **Code Splitting**: Load analytics components on demand
2. **Web Workers**: Process large datasets off main thread
3. **Virtual Rendering**: For large data visualizations
4. **Progressive Enhancement**: Basic view first, enhance with JS

### 8. Error Handling & Resilience

```typescript
class AnalyticsErrorHandler {
  private errorBuffer: ErrorEvent[] = [];
  private circuitBreaker: CircuitBreaker;
  
  async handleError(error: Error, context: ErrorContext) {
    // Log locally
    this.errorBuffer.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      context
    });
    
    // Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      // Queue for later retry
      await this.offline.queue(context.event);
      return;
    }
    
    try {
      // Attempt to send error event
      await this.sendErrorEvent(error, context);
      this.circuitBreaker.recordSuccess();
    } catch (sendError) {
      this.circuitBreaker.recordFailure();
      await this.offline.queue(context.event);
    }
  }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. Implement basic event SDK with batching
2. Add offline support with IndexedDB
3. Create TypeScript types for CloudEvents
4. Set up development environment

### Phase 2: Query Layer (Week 3-4)
1. Extend GraphQL schema for Iceberg queries
2. Implement query builders for common patterns
3. Add caching layer with TTL management
4. Create React/Vue hooks for data fetching

### Phase 3: Visualization (Week 5-6)
1. Build time-series chart components
2. Implement dashboard layout system
3. Add interactive filtering and drilling
4. Create export functionality

### Phase 4: Optimization (Week 7-8)
1. Implement progressive loading
2. Add service worker caching
3. Optimize bundle sizes
4. Performance testing and tuning

## Technology Stack Recommendations

### Core Libraries
- **Event Collection**: Custom SDK with CloudEvents
- **State Management**: Zustand or Pinia (lightweight)
- **Data Fetching**: Apollo Client or URQL with caching
- **Visualization**: D3.js for custom charts, Recharts for standard
- **Time Handling**: date-fns or dayjs
- **Offline Storage**: IndexedDB with Dexie.js

### Build Tools
- **Bundler**: Vite for fast development
- **TypeScript**: Strict mode enabled
- **Testing**: Vitest for unit, Playwright for E2E
- **Linting**: ESLint with custom rules
- **Formatting**: Prettier with consistent config

## Security Considerations

1. **API Key Management**: 
   - Use separate keys for dev/prod
   - Implement key rotation
   - Rate limit by key

2. **Data Privacy**:
   - PII detection before sending
   - Configurable data masking
   - User consent management

3. **Content Security Policy**:
   - Restrict analytics endpoints
   - Validate event payloads
   - Sanitize user inputs

## Monitoring & Observability

```typescript
interface AnalyticsMonitoring {
  // SDK health metrics
  eventsQueued: number;
  eventsSent: number;
  eventsDropped: number;
  batchesSent: number;
  
  // Performance metrics
  avgBatchSize: number;
  avgLatency: number;
  errorRate: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  cacheTTL: number;
}
```

## Conclusion

This frontend architecture provides a robust foundation for integrating with an Iceberg-based analytics backend. The design emphasizes:

1. **Efficient event collection** with smart batching and offline support
2. **Optimized query patterns** leveraging Iceberg's capabilities
3. **Responsive visualizations** with progressive loading
4. **Multi-layer caching** for performance
5. **Hybrid real-time/batch** data access

The modular design allows for incremental implementation while maintaining flexibility for future enhancements.