# Caching Strategy for Iceberg-Based Analytics

## Overview

This document outlines a comprehensive caching strategy for analytics data stored in Apache Iceberg. The strategy is designed to optimize query performance, reduce backend load, and provide a responsive user experience while maintaining data freshness and consistency.

## Caching Architecture

### Multi-Layer Cache Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
├─────────────────────────────────────────────────────┤
│  L1: Browser Memory Cache (LRU, 50MB)               │
│  L2: IndexedDB Cache (1GB)                          │
│  L3: Service Worker Cache (Network First)           │
├─────────────────────────────────────────────────────┤
│                    Edge Layer                        │
├─────────────────────────────────────────────────────┤
│  L4: Cloudflare Edge Cache (KV Store)               │
│  L5: Cloudflare Cache API                           │
├─────────────────────────────────────────────────────┤
│                   Server Layer                       │
├─────────────────────────────────────────────────────┤
│  L6: Worker Memory Cache (In-Process)               │
│  L7: Durable Objects Cache (Persistent)             │
│  L8: Materialized Views (R2/Iceberg)                │
└─────────────────────────────────────────────────────┘
```

## Cache Key Design

### Deterministic Key Generation
```typescript
interface CacheKeyComponents {
  // Query identification
  queryType: 'timeseries' | 'aggregate' | 'raw' | 'snapshot';
  queryHash: string; // SHA-256 of normalized query
  
  // Data versioning
  icebergSnapshot: string; // Iceberg snapshot ID
  schemaVersion: number;   // Schema version number
  
  // Temporal components
  timeRange: {
    start: string; // ISO 8601
    end: string;   // ISO 8601
    granularity: string;
  };
  
  // User context
  tenantId?: string;
  userId?: string;
  permissions?: string[]; // Hashed permissions
}

class CacheKeyGenerator {
  generateKey(components: CacheKeyComponents): string {
    // Normalize components
    const normalized = {
      qt: components.queryType,
      qh: components.queryHash,
      is: components.icebergSnapshot,
      sv: components.schemaVersion,
      ts: components.timeRange.start,
      te: components.timeRange.end,
      tg: components.timeRange.granularity,
      tid: components.tenantId || 'global',
      uid: components.userId || 'anonymous',
      p: this.hashPermissions(components.permissions || [])
    };
    
    // Create deterministic key
    const keyString = Object.entries(normalized)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    
    // Return base64 encoded SHA-256 hash
    return this.sha256(keyString);
  }
  
  private hashPermissions(permissions: string[]): string {
    return this.sha256(permissions.sort().join(','));
  }
  
  private sha256(input: string): string {
    // Implementation using Web Crypto API or Node crypto
    return crypto.createHash('sha256').update(input).digest('base64url');
  }
}
```

## Cache Implementation Layers

### 1. Browser Memory Cache (L1)

```typescript
class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private currentSize: number = 0;
  
  constructor(maxSizeBytes: number = 50 * 1024 * 1024) { // 50MB default
    this.maxSize = maxSizeBytes;
  }
  
  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (entry.expiresAt < Date.now()) {
      this.delete(key);
      return null;
    }
    
    // Update access order (LRU)
    this.updateAccessOrder(key);
    
    // Track hit rate
    this.metrics.recordHit();
    
    return entry.data;
  }
  
  async set(key: string, data: T, ttl: number): Promise<void> {
    const size = this.estimateSize(data);
    
    // Evict if necessary
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    const entry: CacheEntry<T> = {
      data,
      size,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      hitCount: 0
    };
    
    this.cache.set(key, entry);
    this.currentSize += size;
    this.updateAccessOrder(key);
  }
  
  private evictLRU(): void {
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      if (entry) {
        this.currentSize -= entry.size;
        this.cache.delete(lruKey);
        this.metrics.recordEviction('lru');
      }
    }
  }
  
  private estimateSize(data: T): number {
    // Rough estimation of object size in memory
    return JSON.stringify(data).length * 2; // 2 bytes per character
  }
}
```

### 2. IndexedDB Cache (L2)

```typescript
class IndexedDBCache {
  private dbName = 'analytics-cache';
  private storeName = 'query-results';
  private db: IDBDatabase | null = null;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt');
          store.createIndex('icebergSnapshot', 'metadata.icebergSnapshot');
          store.createIndex('queryType', 'metadata.queryType');
        }
      };
    });
  }
  
  async get<T>(key: string): Promise<CachedResult<T> | null> {
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result || result.expiresAt < Date.now()) {
          resolve(null);
        } else {
          resolve(result);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async set<T>(key: string, data: T, metadata: CacheMetadata): Promise<void> {
    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    const entry = {
      key,
      data,
      metadata,
      createdAt: Date.now(),
      expiresAt: Date.now() + metadata.ttl,
      size: new Blob([JSON.stringify(data)]).size
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async cleanup(): Promise<void> {
    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('expiresAt');
    
    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 3. Service Worker Cache (L3)

```typescript
// service-worker.ts
class ServiceWorkerCache {
  private cacheName = 'analytics-v1';
  private maxAge = 3600 * 1000; // 1 hour default
  
  async handleFetch(request: Request): Promise<Response> {
    // Only cache GET requests to analytics API
    if (request.method !== 'GET' || !request.url.includes('/api/analytics/')) {
      return fetch(request);
    }
    
    // Try cache first for offline support
    const cachedResponse = await this.getFromCache(request);
    if (cachedResponse) {
      // Revalidate in background
      this.revalidateInBackground(request);
      return cachedResponse;
    }
    
    // Network request with caching
    return this.fetchAndCache(request);
  }
  
  private async getFromCache(request: Request): Promise<Response | null> {
    const cache = await caches.open(this.cacheName);
    const response = await cache.match(request);
    
    if (!response) return null;
    
    // Check if cache is fresh
    const cachedAt = response.headers.get('X-Cached-At');
    if (cachedAt && Date.now() - parseInt(cachedAt) > this.maxAge) {
      await cache.delete(request);
      return null;
    }
    
    return response;
  }
  
  private async fetchAndCache(request: Request): Promise<Response> {
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response.ok) {
      const cache = await caches.open(this.cacheName);
      
      // Clone response and add cache metadata
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers({
          ...response.headers,
          'X-Cached-At': Date.now().toString()
        })
      });
      
      await cache.put(request, responseToCache);
    }
    
    return response;
  }
  
  private async revalidateInBackground(request: Request): Promise<void> {
    try {
      const freshResponse = await fetch(request);
      if (freshResponse.ok) {
        const cache = await caches.open(this.cacheName);
        await cache.put(request, freshResponse);
      }
    } catch (error) {
      // Silently fail - we already returned cached response
      console.error('Background revalidation failed:', error);
    }
  }
}
```

### 4. Cloudflare Edge Cache (L4)

```typescript
// Cloudflare Worker implementation
class EdgeCache {
  private kv: KVNamespace;
  
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }
  
  async get<T>(key: string): Promise<CachedData<T> | null> {
    const cached = await this.kv.get(key, 'json');
    if (!cached) return null;
    
    // Validate cache entry
    if (cached.expiresAt < Date.now()) {
      // Async deletion
      this.kv.delete(key);
      return null;
    }
    
    return cached;
  }
  
  async set<T>(
    key: string, 
    data: T, 
    metadata: EdgeCacheMetadata
  ): Promise<void> {
    const entry = {
      data,
      metadata,
      createdAt: Date.now(),
      expiresAt: Date.now() + metadata.ttl
    };
    
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: Math.ceil(metadata.ttl / 1000), // KV expects seconds
      metadata: {
        icebergSnapshot: metadata.icebergSnapshot,
        queryType: metadata.queryType
      }
    });
  }
  
  async invalidateBySnapshot(snapshotId: string): Promise<void> {
    // List all keys with this snapshot
    const list = await this.kv.list({
      prefix: '', // Would need to implement prefix-based keys
      limit: 1000
    });
    
    // Delete matching entries
    const deletions = list.keys
      .filter(key => key.metadata?.icebergSnapshot === snapshotId)
      .map(key => this.kv.delete(key.name));
    
    await Promise.all(deletions);
  }
}
```

### 5. Durable Objects Cache (L7)

```typescript
// Durable Object for persistent caching
export class CacheDurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    switch (path) {
      case '/get':
        return this.handleGet(request);
      case '/set':
        return this.handleSet(request);
      case '/invalidate':
        return this.handleInvalidate(request);
      case '/stats':
        return this.handleStats();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
  
  private async handleGet(request: Request): Promise<Response> {
    const { key } = await request.json();
    
    const entry = await this.storage.get<CacheEntry>(key);
    if (!entry || entry.expiresAt < Date.now()) {
      await this.storage.delete(key);
      return Response.json({ found: false });
    }
    
    // Update hit count
    entry.hitCount++;
    await this.storage.put(key, entry);
    
    return Response.json({
      found: true,
      data: entry.data,
      metadata: entry.metadata
    });
  }
  
  private async handleSet(request: Request): Promise<Response> {
    const { key, data, metadata } = await request.json();
    
    const entry: CacheEntry = {
      data,
      metadata,
      createdAt: Date.now(),
      expiresAt: Date.now() + metadata.ttl,
      hitCount: 0,
      size: new Blob([JSON.stringify(data)]).size
    };
    
    await this.storage.put(key, entry);
    
    // Schedule cleanup if needed
    const nextCleanup = await this.storage.get<number>('nextCleanup');
    if (!nextCleanup || nextCleanup > entry.expiresAt) {
      await this.storage.put('nextCleanup', entry.expiresAt);
      await this.storage.setAlarm(entry.expiresAt);
    }
    
    return Response.json({ success: true });
  }
  
  async alarm(): Promise<void> {
    // Clean up expired entries
    const now = Date.now();
    const keys = await this.storage.list<CacheEntry>();
    
    let nextAlarm = Infinity;
    
    for (const [key, entry] of keys) {
      if (key === 'nextCleanup') continue;
      
      if (entry.expiresAt <= now) {
        await this.storage.delete(key);
      } else {
        nextAlarm = Math.min(nextAlarm, entry.expiresAt);
      }
    }
    
    // Schedule next cleanup
    if (nextAlarm < Infinity) {
      await this.storage.put('nextCleanup', nextAlarm);
      await this.storage.setAlarm(nextAlarm);
    }
  }
}
```

## TTL Strategy

### Dynamic TTL Calculation
```typescript
class TTLCalculator {
  calculateTTL(params: {
    queryType: string;
    timeRange: TimeRange;
    dataFreshness: 'real-time' | 'near-real-time' | 'batch';
    queryComplexity: number;
  }): number {
    const now = Date.now();
    const rangeEnd = new Date(params.timeRange.end).getTime();
    const isHistorical = rangeEnd < now - 24 * 60 * 60 * 1000; // >24h old
    
    // Base TTL by query type
    let baseTTL: number;
    switch (params.queryType) {
      case 'timeseries':
        baseTTL = 5 * 60 * 1000; // 5 minutes
        break;
      case 'aggregate':
        baseTTL = 15 * 60 * 1000; // 15 minutes
        break;
      case 'snapshot':
        baseTTL = 60 * 60 * 1000; // 1 hour
        break;
      default:
        baseTTL = 60 * 1000; // 1 minute
    }
    
    // Adjust for data freshness
    switch (params.dataFreshness) {
      case 'real-time':
        baseTTL = Math.min(baseTTL, 30 * 1000); // Max 30 seconds
        break;
      case 'near-real-time':
        baseTTL = Math.min(baseTTL, 5 * 60 * 1000); // Max 5 minutes
        break;
      case 'batch':
        baseTTL = baseTTL * 2; // Double for batch data
        break;
    }
    
    // Adjust for historical data (can cache longer)
    if (isHistorical) {
      baseTTL = baseTTL * 10; // 10x longer for historical
      baseTTL = Math.min(baseTTL, 24 * 60 * 60 * 1000); // Max 24 hours
    }
    
    // Adjust for query complexity (expensive queries cached longer)
    const complexityMultiplier = 1 + Math.log10(params.queryComplexity);
    baseTTL = baseTTL * complexityMultiplier;
    
    return Math.round(baseTTL);
  }
}
```

## Cache Invalidation

### Event-Driven Invalidation
```typescript
class CacheInvalidator {
  private eventBus: EventBus;
  private caches: CacheLayer[];
  
  constructor(eventBus: EventBus, caches: CacheLayer[]) {
    this.eventBus = eventBus;
    this.caches = caches;
    
    this.subscribeToEvents();
  }
  
  private subscribeToEvents(): void {
    // Iceberg table commits
    this.eventBus.on('iceberg.commit', async (event: IcebergCommitEvent) => {
      await this.invalidateBySnapshot(event.previousSnapshot, event.newSnapshot);
    });
    
    // Schema changes
    this.eventBus.on('schema.change', async (event: SchemaChangeEvent) => {
      await this.invalidateBySchema(event.schemaVersion);
    });
    
    // Data updates
    this.eventBus.on('data.update', async (event: DataUpdateEvent) => {
      await this.invalidateByTimeRange(event.affectedTimeRange);
    });
  }
  
  async invalidateBySnapshot(
    oldSnapshot: string, 
    newSnapshot: string
  ): Promise<void> {
    const invalidations = this.caches.map(cache => 
      cache.invalidateByMetadata({
        icebergSnapshot: oldSnapshot
      })
    );
    
    await Promise.all(invalidations);
    
    // Log invalidation metrics
    this.metrics.recordInvalidation('snapshot', {
      oldSnapshot,
      newSnapshot,
      entriesInvalidated: invalidations.length
    });
  }
  
  async invalidateByTimeRange(timeRange: TimeRange): Promise<void> {
    // Smart invalidation - only invalidate queries that overlap
    const invalidations = this.caches.map(async cache => {
      const keys = await cache.listKeys();
      const toInvalidate = keys.filter(key => {
        const metadata = this.parseKeyMetadata(key);
        return this.timeRangesOverlap(metadata.timeRange, timeRange);
      });
      
      return cache.invalidateKeys(toInvalidate);
    });
    
    await Promise.all(invalidations);
  }
}
```

### Proactive Cache Warming
```typescript
class CacheWarmer {
  private scheduler: CronScheduler;
  private queryExecutor: QueryExecutor;
  private cache: CacheManager;
  
  async warmCache(): Promise<void> {
    const warmingQueries = await this.identifyWarmingCandidates();
    
    // Execute queries in parallel with concurrency limit
    const concurrency = 5;
    const results = await this.parallelExecute(
      warmingQueries,
      concurrency,
      async (query) => {
        const result = await this.queryExecutor.execute(query);
        await this.cache.set(query.key, result, query.metadata);
        return result;
      }
    );
    
    this.metrics.recordWarming({
      queriesWarmed: results.length,
      duration: Date.now() - startTime
    });
  }
  
  private async identifyWarmingCandidates(): Promise<WarmingQuery[]> {
    // Get most frequently accessed queries
    const frequentQueries = await this.cache.getAccessPatterns({
      limit: 100,
      minHitCount: 10
    });
    
    // Get queries about to expire
    const expiringQueries = await this.cache.getExpiringEntries({
      expiresWithin: 10 * 60 * 1000 // 10 minutes
    });
    
    // Combine and deduplicate
    const candidates = [...frequentQueries, ...expiringQueries];
    return this.deduplicateQueries(candidates);
  }
}
```

## Cache Metrics and Monitoring

```typescript
interface CacheMetrics {
  // Performance metrics
  hitRate: number;
  missRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Size metrics
  totalEntries: number;
  totalSizeBytes: number;
  avgEntrySizeBytes: number;
  
  // Eviction metrics
  evictionRate: number;
  evictionReasons: {
    ttl: number;
    lru: number;
    size: number;
  };
  
  // Invalidation metrics
  invalidationRate: number;
  invalidationReasons: {
    snapshot: number;
    schema: number;
    manual: number;
  };
}

class CacheMonitor {
  async collectMetrics(): Promise<CacheMetrics> {
    const metrics: CacheMetrics = {
      hitRate: this.calculateHitRate(),
      missRate: 1 - this.calculateHitRate(),
      avgLatency: this.calculateAvgLatency(),
      p95Latency: this.calculatePercentileLatency(95),
      p99Latency: this.calculatePercentileLatency(99),
      totalEntries: await this.countEntries(),
      totalSizeBytes: await this.calculateTotalSize(),
      avgEntrySizeBytes: await this.calculateAvgEntrySize(),
      evictionRate: this.calculateEvictionRate(),
      evictionReasons: this.getEvictionReasons(),
      invalidationRate: this.calculateInvalidationRate(),
      invalidationReasons: this.getInvalidationReasons()
    };
    
    // Send to monitoring system
    await this.sendToMonitoring(metrics);
    
    // Check for anomalies
    this.checkAnomalies(metrics);
    
    return metrics;
  }
  
  private checkAnomalies(metrics: CacheMetrics): void {
    // Low hit rate alert
    if (metrics.hitRate < 0.7) {
      this.alert('Low cache hit rate', {
        current: metrics.hitRate,
        threshold: 0.7
      });
    }
    
    // High latency alert
    if (metrics.p99Latency > 100) {
      this.alert('High cache latency', {
        p99: metrics.p99Latency,
        threshold: 100
      });
    }
    
    // Memory pressure alert
    const memoryUsagePercent = metrics.totalSizeBytes / this.maxCacheSize;
    if (memoryUsagePercent > 0.9) {
      this.alert('Cache memory pressure', {
        usage: memoryUsagePercent,
        threshold: 0.9
      });
    }
  }
}
```

## Best Practices

### 1. Cache Key Design
- Include all query parameters in the key
- Use Iceberg snapshot ID for version tracking
- Hash long keys to maintain reasonable length
- Include user context when needed

### 2. TTL Management
- Shorter TTLs for recent data
- Longer TTLs for historical data
- Adjust based on query cost
- Consider data update patterns

### 3. Cache Sizing
- Monitor memory usage closely
- Implement size-based eviction
- Use compression for large entries
- Consider sharding for scale

### 4. Invalidation Strategy
- Prefer event-driven invalidation
- Implement cascade invalidation
- Track invalidation metrics
- Avoid over-invalidation

### 5. Performance Optimization
- Implement cache warming
- Use background refresh
- Monitor hit rates
- Optimize key generation

## Implementation Checklist

- [ ] Implement multi-layer cache hierarchy
- [ ] Create deterministic key generation
- [ ] Implement TTL calculation logic
- [ ] Set up event-driven invalidation
- [ ] Add cache warming capability
- [ ] Implement monitoring and metrics
- [ ] Add compression for large entries
- [ ] Create cache debugging tools
- [ ] Document cache behavior
- [ ] Load test cache system

## Conclusion

This caching strategy provides a comprehensive approach to caching Iceberg analytics data across multiple layers. The key principles are:

1. **Multi-layer hierarchy** for optimal performance
2. **Smart TTL management** based on data characteristics
3. **Event-driven invalidation** for consistency
4. **Proactive warming** for predictable performance
5. **Comprehensive monitoring** for operational excellence

The implementation should be rolled out incrementally, starting with the most impactful layers first.