import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { gql, GraphQLClient } from 'graphql-request';

// Test configuration
const EVENT_COLLECTOR_URL = process.env.EVENT_COLLECTOR_URL || 'http://localhost:8787';
const API_URL = process.env.API_URL || 'http://localhost:4000/graphql';
const API_KEY = process.env.API_KEY || 'test-api-key';
const TEST_EVENT_TYPE = 'analytics.test.e2e';

// GraphQL client
const graphqlClient = new GraphQLClient(API_URL, {
  headers: {
    'X-API-Key': API_KEY,
  },
});

// Helper functions
async function sendEvent(eventData: any) {
  const event = {
    specversion: '1.0',
    type: TEST_EVENT_TYPE,
    source: 'e2e-test-suite',
    id: uuidv4(),
    time: new Date().toISOString(),
    data: eventData,
  };

  const response = await fetch(`${EVENT_COLLECTOR_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.success).toBe(true);
  return event;
}

async function sendBatchEvents(events: any[]) {
  const cloudEvents = events.map(data => ({
    specversion: '1.0',
    type: TEST_EVENT_TYPE,
    source: 'e2e-test-suite',
    id: uuidv4(),
    time: new Date().toISOString(),
    data,
  }));

  const response = await fetch(`${EVENT_COLLECTOR_URL}/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events: cloudEvents }),
  });

  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.events_received).toBe(events.length);
  return cloudEvents;
}

async function checkBufferStatus(eventType: string) {
  const response = await fetch(`${EVENT_COLLECTOR_URL}/debug/status/${eventType}`);
  expect(response.status).toBe(200);
  return response.json();
}

async function triggerFlush(eventType: string) {
  const response = await fetch(`${EVENT_COLLECTOR_URL}/debug/flush/${eventType}`, {
    method: 'DELETE',
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function listR2Files() {
  const response = await fetch(`${EVENT_COLLECTOR_URL}/debug/list-r2`);
  expect(response.status).toBe(200);
  const result = await response.json();
  return result.objects || [];
}

async function queryEvents(eventType: string, startTime: string) {
  const query = gql`
    query GetEventCounts($eventType: String, $startTime: String) {
      eventCounts(eventType: $eventType, startTime: $startTime) {
        type
        count
        timeRange {
          start
          end
        }
      }
    }
  `;

  const result = await graphqlClient.request(query, { eventType, startTime });
  return result.eventCounts;
}

async function waitForCondition(
  checkFn: () => Promise<boolean>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await checkFn()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe.skip('Analytics Pipeline E2E Tests - Requires running services', () => {
  let testRunId: string;
  let startTime: string;

  beforeAll(() => {
    testRunId = uuidv4();
    startTime = new Date().toISOString();
  });

  describe('Health Checks', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${EVENT_COLLECTOR_URL}/health`);
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.status).toBe('healthy');
    });

    it('should test R2 connectivity', async () => {
      const response = await fetch(`${EVENT_COLLECTOR_URL}/debug/test-r2`);
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.status).toBe('success');
      expect(result.test_file).toBeDefined();
    });
  });

  describe('Single Event Flow', () => {
    it('should ingest, buffer, and persist a single event', async () => {
      // 1. Send a test event
      const testData = {
        testRunId,
        scenario: 'single-event',
        timestamp: Date.now(),
        value: Math.random(),
      };
      const event = await sendEvent(testData);

      // 2. Verify event is buffered
      const bufferStatus = await checkBufferStatus(TEST_EVENT_TYPE);
      expect(bufferStatus.eventCount).toBeGreaterThan(0);

      // 3. Trigger flush
      await triggerFlush(TEST_EVENT_TYPE);

      // 4. Wait for parquet file to appear in R2
      await waitForCondition(async () => {
        const files = await listR2Files();
        return files.some((f: any) => 
          f.key.includes(TEST_EVENT_TYPE) && 
          f.key.endsWith('.parquet')
        );
      });

      // 5. Query via GraphQL API (may need to wait for processing)
      await waitForCondition(async () => {
        const results = await queryEvents(TEST_EVENT_TYPE, startTime);
        return results.length > 0 && results[0].count > 0;
      });

      const queryResults = await queryEvents(TEST_EVENT_TYPE, startTime);
      expect(queryResults).toHaveLength(1);
      expect(queryResults[0].type).toBe(TEST_EVENT_TYPE);
      expect(queryResults[0].count).toBeGreaterThan(0);
    });
  });

  describe('Batch Event Flow', () => {
    it('should handle batch event ingestion', async () => {
      // 1. Send batch of events
      const batchSize = 50;
      const events = Array.from({ length: batchSize }, (_, i) => ({
        testRunId,
        scenario: 'batch-events',
        batchIndex: i,
        timestamp: Date.now(),
      }));
      
      await sendBatchEvents(events);

      // 2. Check buffer has received events
      const bufferStatus = await checkBufferStatus(TEST_EVENT_TYPE);
      expect(bufferStatus.eventCount).toBeGreaterThanOrEqual(batchSize);

      // 3. Trigger flush and verify
      await triggerFlush(TEST_EVENT_TYPE);

      // 4. Verify files in R2
      await waitForCondition(async () => {
        const files = await listR2Files();
        const relevantFiles = files.filter((f: any) => 
          f.key.includes(TEST_EVENT_TYPE) && 
          f.key.endsWith('.parquet')
        );
        return relevantFiles.length > 0;
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject malformed events', async () => {
      const response = await fetch(`${EVENT_COLLECTOR_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invalid: 'event' }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBeDefined();
    });

    it('should handle payload size limits', async () => {
      // Create a large payload (over 1MB limit for single event)
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB string
      
      const response = await fetch(`${EVENT_COLLECTOR_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': largeData.length.toString(),
        },
        body: JSON.stringify({
          specversion: '1.0',
          type: TEST_EVENT_TYPE,
          source: 'e2e-test',
          id: uuidv4(),
          data: { payload: largeData },
        }),
      });

      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should validate batch size limits', async () => {
      // Try to send more than 1000 events in a batch
      const events = Array.from({ length: 1001 }, () => ({
        specversion: '1.0',
        type: TEST_EVENT_TYPE,
        source: 'e2e-test',
        id: uuidv4(),
        data: { test: true },
      }));

      const response = await fetch(`${EVENT_COLLECTOR_URL}/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('batch');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        sendEvent({
          testRunId,
          scenario: 'concurrent',
          requestIndex: i,
          timestamp: Date.now(),
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(event => {
        expect(event.id).toBeDefined();
      });
    });

    it('should meet latency requirements', async () => {
      const iterations = 10;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await sendEvent({
          testRunId,
          scenario: 'latency-test',
          iteration: i,
        });
        const latency = Date.now() - start;
        latencies.push(latency);
      }

      // Calculate p95 latency
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      expect(p95Latency).toBeLessThan(100); // p95 < 100ms
    });
  });

  describe('Data Integrity', () => {
    it('should not lose events during buffer flush', async () => {
      const eventCount = 100;
      const eventIds: string[] = [];

      // Send events
      for (let i = 0; i < eventCount; i++) {
        const event = await sendEvent({
          testRunId,
          scenario: 'integrity-test',
          index: i,
        });
        eventIds.push(event.id);
      }

      // Force flush
      await triggerFlush(TEST_EVENT_TYPE);

      // Wait for processing
      await waitForCondition(async () => {
        const results = await queryEvents(TEST_EVENT_TYPE, startTime);
        return results.length > 0 && results[0].count >= eventCount;
      });

      // Verify count
      const results = await queryEvents(TEST_EVENT_TYPE, startTime);
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBeGreaterThanOrEqual(eventCount);
    });
  });

  afterAll(async () => {
    // Clean up test data if needed
    console.log(`Test run ${testRunId} completed`);
  });
});