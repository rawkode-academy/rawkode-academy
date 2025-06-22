import { Miniflare } from 'miniflare';
import type { R2Bucket } from '@cloudflare/workers-types';
import { sleep } from './test-utilities';

export interface TestEnv {
  ANALYTICS_BUCKET: R2Bucket;
  CATALOG_BUCKET: R2Bucket;
  USE_ICEBERG: string;
  R2_CATALOG_ENDPOINT?: string;
  COMPACTION_THRESHOLD: string;
  TARGET_FILE_SIZE_MB: string;
}

let mfInstance: Miniflare | null = null;
let instanceCount = 0;

export async function createTestMiniflare() {
  // Create unique bucket names for each test to ensure isolation
  const testId = `${Date.now()}_${instanceCount++}`;
  
  const mf = new Miniflare({
    modules: true,
    script: `
      export default {
        async fetch(request, env, ctx) {
          return new Response('Test worker');
        }
      }
    `,
    r2Buckets: {
      ANALYTICS_BUCKET: `analytics-test-${testId}`,
      CATALOG_BUCKET: `catalog-test-${testId}`,
    },
    bindings: {
      USE_ICEBERG: 'true',
      COMPACTION_THRESHOLD: '50',
      TARGET_FILE_SIZE_MB: '128',
    },
  });

  mfInstance = mf;
  return mf;
}

export async function cleanupR2Bucket(bucket: R2Bucket) {
  try {
    let hasMore = true;
    let cursor: string | undefined;
    
    while (hasMore) {
      const result = await bucket.list({ cursor, limit: 1000 });
      
      if (result.objects.length === 0) {
        break;
      }
      
      // Delete in parallel for speed
      await Promise.all(
        result.objects.map(object => bucket.delete(object.key))
      );
      
      hasMore = result.truncated ?? false;
      cursor = result.cursor;
    }
    
    // Wait a bit for eventual consistency
    await sleep(50);
  } catch (error) {
    console.warn('Error cleaning up R2 bucket:', error);
  }
}

export function createMockR2Object(key: string, data: any) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(body).buffer;
  
  return {
    key,
    size: body.length,
    etag: `"${key}-etag-${Date.now()}"`,
    httpEtag: `"${key}-etag-${Date.now()}"`,
    uploaded: new Date(),
    httpMetadata: {},
    customMetadata: {},
    checksums: {},
    body: body,
    bodyUsed: false,
    arrayBuffer: async () => buffer.slice(0), // Return a copy
    text: async () => body,
    json: async () => typeof data === 'string' ? JSON.parse(data) : data,
    blob: async () => new Blob([body]),
    writeHttpMetadata: () => {},
  };
}

/**
 * Ensure all Miniflare instances are properly disposed
 */
export async function cleanupAllMiniflare() {
  if (mfInstance) {
    await mfInstance.dispose();
    mfInstance = null;
  }
}

/**
 * Create isolated test environment with automatic cleanup
 */
export function createIsolatedTestEnv() {
  let mf: Miniflare | null = null;
  let env: TestEnv | null = null;
  
  return {
    async setup() {
      mf = await createTestMiniflare();
      env = await mf.getBindings<TestEnv>();
      return { mf, env };
    },
    
    async cleanup() {
      if (env) {
        await cleanupR2Bucket(env.ANALYTICS_BUCKET);
        await cleanupR2Bucket(env.CATALOG_BUCKET);
      }
      if (mf) {
        await mf.dispose();
      }
    },
    
    get env() {
      if (!env) throw new Error('Test environment not initialized');
      return env;
    },
    
    get mf() {
      if (!mf) throw new Error('Miniflare not initialized');
      return mf;
    },
  };
}