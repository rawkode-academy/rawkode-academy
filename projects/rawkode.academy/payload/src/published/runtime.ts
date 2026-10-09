import config from '@payload-config'
import { getPayload } from 'payload'
import { Catalogue } from '../catalogue'
import { cloudflare } from '../cloudflare'
import type { PublishedRuntime } from './http'

// No Payload session and no cookies: a fresh, request-scoped anonymous Catalogue.
export async function publishedRuntime(): Promise<PublishedRuntime> {
  const payload = await getPayload({ config })
  return {
    catalogue: new Catalogue(payload, cloudflare.env.D1),
    now: Date.now,
    cache: typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined,
  }
}
