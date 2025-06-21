# Real-time vs Batch Query Architecture for Analytics

## Overview

This document outlines the architecture for handling both real-time and batch analytics queries in a unified system. The design leverages Apache Iceberg for batch processing and Cloudflare Analytics Engine for real-time data, providing a seamless experience for end users while optimizing for performance and cost.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Data Sources                          │
├─────────────────────────────────────────────────────────┤
│  Events  │  User Actions  │  System Metrics  │  Logs    │
└────┬─────┴───────┬────────┴────────┬─────────┴────┬─────┘
     │             │                 │              │
     ▼             ▼                 ▼              ▼
┌─────────────────────────────────────────────────────────┐
│                  Event Collector                         │
│              (Cloudflare Worker)                         │
└────┬──────────────────────────────────────────────┬─────┘
     │                                              │
     ▼                                              ▼
┌─────────────────────┐                    ┌──────────────────┐
│  Analytics Engine   │                    │  Buffer (DO)      │
│  (Real-time Store)  │                    │  (Write Buffer)   │
└─────────┬───────────┘                    └────────┬─────────┘
          │                                         │
          │                                         ▼
          │                                ┌──────────────────┐
          │                                │   R2 Storage     │
          │                                │ (Parquet Files)  │
          │                                └────────┬─────────┘
          │                                         │
          ▼                                         ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Query Layer                         │
│                (GraphQL API)                             │
└─────────────────────────────────────────────────────────┘
```

## Data Freshness Requirements

### Real-time Category (<1 minute latency)
```typescript
interface RealTimeQuery {
  // Characteristics
  latency: '<1min';
  dataSource: 'AnalyticsEngine';
  useCases: [
    'LiveUserCount',
    'ActiveSessions',
    'CurrentErrors',
    'RealTimeAlerts',
    'LiveDashboards'
  ];
}

// Example queries
const realTimeQueries = {
  liveUsers: `
    SELECT COUNT(DISTINCT user_id) as active_users
    FROM analytics_engine.events
    WHERE timestamp >= NOW() - INTERVAL '5 minutes'
      AND event_type = 'session.active'
  `,
  
  errorRate: `
    SELECT 
      COUNT(*) FILTER (WHERE event_type LIKE 'error.%') as errors,
      COUNT(*) as total,
      ROUND(COUNT(*) FILTER (WHERE event_type LIKE 'error.%')::NUMERIC / COUNT(*) * 100, 2) as error_rate
    FROM analytics_engine.events
    WHERE timestamp >= NOW() - INTERVAL '1 minute'
  `,
  
  currentThroughput: `
    SELECT 
      date_trunc('second', timestamp) as second,
      COUNT(*) as events_per_second
    FROM analytics_engine.events
    WHERE timestamp >= NOW() - INTERVAL '60 seconds'
    GROUP BY 1
    ORDER BY 1 DESC
  `
};
```

### Near Real-time Category (1-15 minute latency)
```typescript
interface NearRealTimeQuery {
  // Characteristics
  latency: '1-15min';
  dataSource: 'Hybrid';  // Analytics Engine + Recent Iceberg
  useCases: [
    'RecentTrends',
    'SessionAnalytics',
    'ConversionTracking',
    'PerformanceMetrics'
  ];
}

// Hybrid query strategy
class NearRealTimeQueryExecutor {
  async execute(query: Query): Promise<QueryResult> {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    // Split query into two parts
    const [batchResult, realtimeResult] = await Promise.all([
      // Historical data from Iceberg (>5 minutes old)
      this.queryIceberg({
        ...query,
        timeFilter: `timestamp < '${cutoffTime.toISOString()}'`
      }),
      
      // Recent data from Analytics Engine (<5 minutes)
      this.queryAnalyticsEngine({
        ...query,
        timeFilter: `timestamp >= '${cutoffTime.toISOString()}'`
      })
    ]);
    
    // Merge results
    return this.mergeResults(batchResult, realtimeResult);
  }
}
```

### Batch Category (>15 minute latency)
```typescript
interface BatchQuery {
  // Characteristics
  latency: '>15min';
  dataSource: 'Iceberg';
  useCases: [
    'HistoricalAnalysis',
    'Reporting',
    'DataExports',
    'MLTraining',
    'CohortAnalysis'
  ];
}

// Batch queries leverage Iceberg's full capabilities
const batchQueries = {
  monthlyReport: `
    WITH monthly_metrics AS (
      SELECT 
        date_trunc('month', timestamp) as month,
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM iceberg.events
      WHERE timestamp >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY 1, 2
    )
    SELECT * FROM monthly_metrics
    ORDER BY month DESC, event_count DESC
  `,
  
  cohortRetention: `
    -- Complex cohort analysis leveraging Iceberg's efficiency
    WITH user_cohorts AS (
      SELECT 
        user_id,
        DATE(MIN(timestamp)) as cohort_date
      FROM iceberg.events
      WHERE event_type = 'user.signup'
      GROUP BY 1
    ),
    retention_data AS (
      SELECT 
        c.cohort_date,
        DATEDIFF('day', c.cohort_date, DATE(e.timestamp)) as days_since_signup,
        COUNT(DISTINCT c.user_id) as retained_users
      FROM user_cohorts c
      JOIN iceberg.events e ON c.user_id = e.user_id
      WHERE e.timestamp > c.cohort_date
      GROUP BY 1, 2
    )
    SELECT * FROM retention_data
    ORDER BY cohort_date DESC, days_since_signup
  `
};
```

## Unified Query Interface

### Query Router Implementation
```typescript
class UnifiedQueryRouter {
  private analyticsEngine: AnalyticsEngineClient;
  private icebergClient: IcebergClient;
  private cacheManager: CacheManager;
  
  async route(query: UnifiedQuery): Promise<QueryResult> {
    const classification = this.classifyQuery(query);
    
    switch (classification.type) {
      case 'realtime':
        return this.executeRealtime(query);
        
      case 'nearRealtime':
        return this.executeHybrid(query);
        
      case 'batch':
        return this.executeBatch(query);
        
      case 'adaptive':
        return this.executeAdaptive(query);
    }
  }
  
  private classifyQuery(query: UnifiedQuery): QueryClassification {
    const features = {
      timeRange: this.analyzeTimeRange(query),
      aggregationLevel: this.analyzeAggregation(query),
      dataVolume: this.estimateDataVolume(query),
      userExpectation: query.metadata?.expectation || 'balanced'
    };
    
    // Classification logic
    if (features.timeRange.isRealtime && features.timeRange.duration < 300) {
      return { type: 'realtime', confidence: 0.95 };
    }
    
    if (features.timeRange.includesRecent && features.dataVolume < 1000000) {
      return { type: 'nearRealtime', confidence: 0.85 };
    }
    
    if (features.timeRange.isHistorical || features.dataVolume > 10000000) {
      return { type: 'batch', confidence: 0.90 };
    }
    
    return { type: 'adaptive', confidence: 0.70 };
  }
}
```

### Hybrid Query Execution
```typescript
class HybridQueryExecutor {
  async executeHybrid(query: UnifiedQuery): Promise<QueryResult> {
    const splitPoint = this.calculateSplitPoint(query);
    
    // Build sub-queries
    const batchQuery = this.buildBatchQuery(query, { endTime: splitPoint });
    const realtimeQuery = this.buildRealtimeQuery(query, { startTime: splitPoint });
    
    // Execute in parallel
    const [batchResult, realtimeResult] = await Promise.all([
      this.executeBatchWithCache(batchQuery),
      this.executeRealtimeWithBuffer(realtimeQuery)
    ]);
    
    // Merge based on query type
    return this.mergeResults(query, batchResult, realtimeResult);
  }
  
  private calculateSplitPoint(query: UnifiedQuery): Date {
    // Factors to consider:
    // 1. Data freshness in Iceberg (last commit time)
    // 2. Query time range
    // 3. Performance requirements
    
    const icebergFreshness = await this.getIcebergFreshness();
    const queryEnd = new Date(query.timeRange.end);
    const now = new Date();
    
    // Default: 5 minutes ago
    let splitPoint = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Adjust based on Iceberg freshness
    if (icebergFreshness > splitPoint) {
      splitPoint = icebergFreshness;
    }
    
    // Never split if query is entirely historical
    if (queryEnd < splitPoint) {
      return queryEnd; // All data from Iceberg
    }
    
    return splitPoint;
  }
  
  private async mergeResults(
    query: UnifiedQuery,
    batchResult: QueryResult,
    realtimeResult: QueryResult
  ): Promise<QueryResult> {
    const merger = this.getMerger(query.type);
    
    const merged = merger.merge(batchResult, realtimeResult);
    
    // Add metadata about data sources
    merged.metadata = {
      sources: [
        {
          type: 'iceberg',
          rowCount: batchResult.rowCount,
          timeRange: batchResult.timeRange,
          latency: batchResult.executionTime
        },
        {
          type: 'analyticsEngine',
          rowCount: realtimeResult.rowCount,
          timeRange: realtimeResult.timeRange,
          latency: realtimeResult.executionTime
        }
      ],
      totalLatency: Math.max(batchResult.executionTime, realtimeResult.executionTime),
      mergeStrategy: merger.strategy
    };
    
    return merged;
  }
}
```

## Data Source Characteristics

### Analytics Engine (Real-time)
```typescript
interface AnalyticsEngineCharacteristics {
  // Strengths
  strengths: {
    latency: '<100ms';
    ingestionDelay: '<1s';
    concurrentQueries: 'unlimited';
    costModel: 'per-query';
  };
  
  // Limitations
  limitations: {
    retention: '90 days';
    maxQueryComplexity: 'medium';
    aggregations: ['count', 'sum', 'avg', 'min', 'max'];
    joins: 'not supported';
  };
  
  // Best for
  optimalUseCases: [
    'Real-time dashboards',
    'Alert triggering',
    'Live metrics',
    'Recent activity'
  ];
}
```

### Apache Iceberg (Batch)
```typescript
interface IcebergCharacteristics {
  // Strengths
  strengths: {
    scalability: 'petabyte-scale';
    queryComplexity: 'unlimited';
    timeTravel: true;
    schemaEvolution: true;
    costModel: 'per-scan';
  };
  
  // Limitations
  limitations: {
    minLatency: '1-5min';
    ingestionDelay: '5-15min';
    smallQueryOverhead: 'high';
  };
  
  // Best for
  optimalUseCases: [
    'Historical analysis',
    'Complex aggregations',
    'Large-scale processing',
    'Data exports'
  ];
}
```

## Query Optimization Strategies

### 1. Adaptive Query Planning
```typescript
class AdaptiveQueryPlanner {
  async plan(query: UnifiedQuery): Promise<QueryPlan> {
    const stats = await this.gatherStatistics(query);
    
    // Cost-based optimization
    const plans = [
      this.planRealtime(query, stats),
      this.planBatch(query, stats),
      this.planHybrid(query, stats)
    ];
    
    // Select optimal plan
    const optimalPlan = plans.reduce((best, current) => 
      current.estimatedCost < best.estimatedCost ? current : best
    );
    
    // Add fallback strategy
    optimalPlan.fallback = this.planFallback(query, optimalPlan);
    
    return optimalPlan;
  }
  
  private estimateCost(plan: QueryPlan): number {
    // Factor in:
    // - Data volume to scan
    // - Query complexity
    // - Expected latency
    // - Resource consumption
    // - Financial cost
    
    const dataCost = plan.estimatedRows * plan.bytesPerRow * 0.0001;
    const latencyCost = plan.estimatedLatency * plan.latencySensitivity;
    const complexityCost = plan.operations.length * 10;
    
    return dataCost + latencyCost + complexityCost;
  }
}
```

### 2. Query Result Streaming
```typescript
class StreamingQueryExecutor {
  async *executeStreaming(
    query: UnifiedQuery
  ): AsyncGenerator<QueryChunk, void, unknown> {
    const plan = await this.planner.plan(query);
    
    if (plan.supportStreaming) {
      // Stream from batch source
      if (plan.source === 'iceberg') {
        yield* this.streamFromIceberg(query);
      }
      
      // Stream from real-time source
      if (plan.source === 'hybrid') {
        // First stream historical data
        yield* this.streamFromIceberg({
          ...query,
          timeRange: { 
            start: query.timeRange.start,
            end: plan.splitPoint 
          }
        });
        
        // Then stream real-time data
        yield* this.streamFromAnalyticsEngine({
          ...query,
          timeRange: {
            start: plan.splitPoint,
            end: query.timeRange.end
          }
        });
      }
    } else {
      // Fallback to batch execution
      const result = await this.executeBatch(query);
      yield {
        data: result.data,
        isLast: true,
        metadata: result.metadata
      };
    }
  }
  
  private async *streamFromIceberg(
    query: UnifiedQuery
  ): AsyncGenerator<QueryChunk, void, unknown> {
    const pageSize = 10000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const chunk = await this.iceberg.query({
        ...query,
        limit: pageSize,
        offset
      });
      
      yield {
        data: chunk.data,
        isLast: chunk.data.length < pageSize,
        metadata: {
          offset,
          totalRows: chunk.totalRows
        }
      };
      
      hasMore = chunk.data.length === pageSize;
      offset += pageSize;
    }
  }
}
```

### 3. Predictive Caching
```typescript
class PredictiveCacheManager {
  private ml: MLPredictor;
  private patterns: QueryPatternAnalyzer;
  
  async predict(context: QueryContext): Promise<PredictedQueries[]> {
    // Analyze historical query patterns
    const userPatterns = await this.patterns.analyze(context.userId);
    const timePatterns = await this.patterns.analyzeTimeOfDay(context.timestamp);
    
    // Predict likely next queries
    const predictions = await this.ml.predict({
      userPatterns,
      timePatterns,
      currentQuery: context.query,
      sessionContext: context.session
    });
    
    // Pre-execute high-probability queries
    const toPreCache = predictions.filter(p => p.probability > 0.7);
    
    for (const prediction of toPreCache) {
      this.preExecuteInBackground(prediction.query);
    }
    
    return predictions;
  }
  
  private async preExecuteInBackground(query: UnifiedQuery): Promise<void> {
    // Execute with low priority
    const result = await this.executor.execute({
      ...query,
      priority: 'background',
      cacheOnly: false
    });
    
    // Cache result
    await this.cache.set(query.hash, result, {
      ttl: this.calculatePredictiveTTL(query),
      tags: ['predictive', query.userId]
    });
  }
}
```

## Real-time Data Pipeline

### Event Stream Processing
```typescript
class RealTimeEventProcessor {
  private analyticsEngine: AnalyticsEngineClient;
  private buffer: CircularBuffer<Event>;
  private aggregator: StreamAggregator;
  
  async processEvent(event: CloudEvent): Promise<void> {
    // Write to Analytics Engine immediately
    await this.analyticsEngine.writeEvent(event);
    
    // Buffer for aggregation
    this.buffer.add(event);
    
    // Update streaming aggregates
    this.aggregator.update(event);
    
    // Check for alert conditions
    await this.checkAlerts(event);
  }
  
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    return {
      eventsPerSecond: this.aggregator.getRate('1s'),
      eventsPerMinute: this.aggregator.getRate('1m'),
      activeUsers: this.aggregator.getCardinality('userId', '5m'),
      errorRate: this.aggregator.getRatio('errors', 'total', '1m'),
      topEvents: this.aggregator.getTopK('eventType', 10, '5m')
    };
  }
}
```

### WebSocket/SSE Streaming
```typescript
class RealtimeStreamingService {
  private connections: Map<string, StreamConnection> = new Map();
  
  async handleConnection(ws: WebSocket, params: StreamParams): Promise<void> {
    const connection = new StreamConnection(ws, params);
    this.connections.set(connection.id, connection);
    
    // Send initial state
    await this.sendInitialState(connection);
    
    // Subscribe to relevant events
    const subscription = await this.subscribe(params.filters);
    
    subscription.on('event', async (event) => {
      if (this.matchesFilters(event, params.filters)) {
        await connection.send({
          type: 'event',
          data: event,
          timestamp: Date.now()
        });
      }
    });
    
    // Handle aggregated updates
    if (params.includeAggregates) {
      setInterval(async () => {
        const aggregates = await this.getAggregates(params);
        await connection.send({
          type: 'aggregates',
          data: aggregates,
          timestamp: Date.now()
        });
      }, params.aggregateInterval || 5000);
    }
    
    // Cleanup on disconnect
    ws.on('close', () => {
      subscription.unsubscribe();
      this.connections.delete(connection.id);
    });
  }
}
```

## Monitoring and Operations

### Query Performance Monitoring
```typescript
interface QueryPerformanceMetrics {
  // Latency metrics
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  
  // Throughput metrics
  throughput: {
    queriesPerSecond: number;
    bytesScannedPerSecond: number;
    rowsReturnedPerSecond: number;
  };
  
  // Resource usage
  resources: {
    cpuUtilization: number;
    memoryUsage: number;
    ioOperations: number;
  };
  
  // Cost metrics
  cost: {
    computeCost: number;
    storageCost: number;
    networkCost: number;
  };
}

class QueryMonitor {
  async collectMetrics(): Promise<QueryPerformanceMetrics> {
    const realtimeMetrics = await this.collectRealtimeMetrics();
    const batchMetrics = await this.collectBatchMetrics();
    const hybridMetrics = await this.collectHybridMetrics();
    
    return this.aggregateMetrics([
      realtimeMetrics,
      batchMetrics,
      hybridMetrics
    ]);
  }
  
  async detectAnomalies(metrics: QueryPerformanceMetrics): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    // Latency anomalies
    if (metrics.latency.p99 > this.thresholds.latency.p99) {
      anomalies.push({
        type: 'high_latency',
        severity: 'warning',
        value: metrics.latency.p99,
        threshold: this.thresholds.latency.p99
      });
    }
    
    // Cost anomalies
    const totalCost = metrics.cost.computeCost + 
                     metrics.cost.storageCost + 
                     metrics.cost.networkCost;
    
    if (totalCost > this.thresholds.cost.hourly) {
      anomalies.push({
        type: 'high_cost',
        severity: 'critical',
        value: totalCost,
        threshold: this.thresholds.cost.hourly
      });
    }
    
    return anomalies;
  }
}
```

## Best Practices

### 1. Query Classification
- Automatically classify queries based on time range and complexity
- Use machine learning to improve classification over time
- Allow manual override for specific use cases

### 2. Data Freshness SLAs
- Define clear SLAs for each query category
- Monitor SLA compliance
- Alert on SLA violations

### 3. Cost Optimization
- Route queries to the most cost-effective source
- Implement query result caching
- Use sampling for approximate queries

### 4. Performance Optimization
- Pre-aggregate common metrics
- Implement query result pagination
- Use columnar projections in Iceberg

### 5. Operational Excellence
- Monitor query patterns
- Implement circuit breakers
- Plan for graceful degradation

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. Implement query classifier
2. Create unified query interface
3. Set up basic routing logic
4. Add performance monitoring

### Phase 2: Hybrid Queries (Week 3-4)
1. Implement split-point calculation
2. Create result merger
3. Add caching layer
4. Test hybrid query performance

### Phase 3: Real-time Features (Week 5-6)
1. Set up Analytics Engine integration
2. Implement streaming queries
3. Add WebSocket/SSE support
4. Create real-time dashboards

### Phase 4: Optimization (Week 7-8)
1. Implement adaptive query planning
2. Add predictive caching
3. Optimize query performance
4. Add cost tracking

## Conclusion

This architecture provides a comprehensive approach to handling both real-time and batch analytics queries. Key benefits include:

1. **Seamless user experience** - Users don't need to know about underlying data sources
2. **Optimal performance** - Queries are automatically routed to the best source
3. **Cost efficiency** - Expensive batch queries only when necessary
4. **Flexibility** - Easy to add new data sources or change routing logic
5. **Scalability** - Each component can scale independently

The implementation should focus on transparency and monitoring to ensure the system performs optimally as usage patterns evolve.