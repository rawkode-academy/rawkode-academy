// Payload reads Studio objects in rawkode-academy-content (the public content
// bucket) in place. Every consumer receives this facade, never the binding, so
// no Payload code path can write, delete or start an upload in that bucket.
export type ReadOnlyBucket = Pick<R2Bucket, 'head' | 'get'>
export function readOnlyStudioContent(bucket: Pick<R2Bucket, 'head' | 'get'>): ReadOnlyBucket {
  return Object.freeze({
    head: (key: string) => bucket.head(key),
    get: ((key: string, options?: R2GetOptions) => bucket.get(key, options)) as R2Bucket['get'],
  })
}

// Production only: Worker Previews and the review runtime have no Studio bindings,
// so every Studio path there is absent (503 for the handoff endpoints).
export type StudioBindings = { STUDIO_CONTENT?: R2Bucket; STUDIO_CONTENT_BUCKET_NAME?: string; STUDIO_MACHINE_SECRET?: string | { get(): Promise<string> } }
export function studioHandoffConfigured(bindings: StudioBindings) {
  return Boolean(bindings.STUDIO_MACHINE_SECRET && bindings.STUDIO_CONTENT && bindings.STUDIO_CONTENT_BUCKET_NAME)
}
