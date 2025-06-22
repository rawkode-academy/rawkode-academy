import { Miniflare } from 'miniflare';
import type { R2Bucket } from '@cloudflare/workers-types';

export interface TestEnv {
  ANALYTICS_BUCKET: R2Bucket;
  CATALOG_BUCKET: R2Bucket;
  USE_ICEBERG: string;
  R2_CATALOG_ENDPOINT?: string;
  COMPACTION_THRESHOLD: string;
  TARGET_FILE_SIZE_MB: string;
}

export async function createTestMiniflare() {
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
      ANALYTICS_BUCKET: 'analytics-test',
      CATALOG_BUCKET: 'catalog-test',
    },
    bindings: {
      USE_ICEBERG: 'true',
      COMPACTION_THRESHOLD: '50',
      TARGET_FILE_SIZE_MB: '128',
    },
  });

  return mf;
}

export async function cleanupR2Bucket(bucket: R2Bucket) {
  const objects = await bucket.list();
  for (const object of objects.objects) {
    await bucket.delete(object.key);
  }
}

export function createMockR2Object(key: string, data: any) {
  const body = JSON.stringify(data);
  return {
    key,
    size: body.length,
    etag: `"${key}-etag"`,
    httpEtag: `"${key}-etag"`,
    uploaded: new Date(),
    httpMetadata: {},
    customMetadata: {},
    checksums: {},
    body: body,
    bodyUsed: false,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    text: async () => body,
    json: async () => data,
    blob: async () => new Blob([body]),
    writeHttpMetadata: () => {},
  };
}