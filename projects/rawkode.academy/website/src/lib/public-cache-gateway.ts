const PUBLIC_READ_APIS = [
  /^\/api\/feeds\//,
  /^\/api\/chapters\//,
  /^\/api\/search\.json$/,
  /^\/api\/sitemap-pages\.json$/,
]

const STATIC_FILE = /\.(?:avif|css|gif|ico|jpe?g|js|mjs|map|png|svg|webmanifest|webp|woff2?|ttf|otf)$/i
const PRIVATE_PATH = /^\/(?:home|settings|account|profile)(?:\/|$)/
const INTERACTIVE_API = /^\/api\/(?:auth|comments|subscriptions|studio)(?:\/|$)/
const CMS_ASSET = /^\/cms-assets\/[A-Za-z0-9_-]{8,128}$/
const CMS_DIAGRAM = /^\/cms-diagrams\/[a-f0-9]{64}\.svg$/
const REWRITE_HEADERS = [
  'x-http-method-override', 'x-http-method', 'x-method-override', 'x-forwarded-host',
  'x-host', 'x-forwarded-scheme', 'x-original-url', 'x-rewrite-url', 'forwarded',
]

/** Requests that can safely reach the Workers Cache entrypoint. The default
 * Worker checks this before calling the cached entrypoint, because native
 * Workers Cache runs before Astro middleware. */
export function canUseCachedAstro(request: Request, enabled = true): boolean {
  if (!enabled || request.method !== 'GET') return false
  const url = new URL(request.url)
  const pathname = url.pathname
  if (
    request.headers.has('Cookie') || request.headers.has('Authorization') ||
    request.headers.has('CF-Access-JWT-Assertion') || request.headers.has('Range') ||
    request.headers.has('If-Range') || request.headers.has('If-None-Match') ||
    request.headers.has('If-Modified-Since') || request.headers.has('If-Match') ||
    request.headers.has('If-Unmodified-Since') || REWRITE_HEADERS.some(name => request.headers.has(name)) ||
    /\b(?:no-cache|no-store)\b|(?:^|,)\s*max-age=0(?:,|$)/i.test(request.headers.get('Cache-Control') ?? '') ||
    /\bno-cache\b/i.test(request.headers.get('Pragma') ?? '')
  ) return false
  if (PRIVATE_PATH.test(pathname) || INTERACTIVE_API.test(pathname) || pathname === '/__cms-preview-check') return false
  if (pathname.startsWith('/api/') && !PUBLIC_READ_APIS.some(pattern => pattern.test(pathname))) return false
  // These are dynamic Worker routes with immutable checksum-addressed output.
  // They use .svg or extensionless paths, so allow them before static-file bypass.
  if (CMS_ASSET.test(pathname) || CMS_DIAGRAM.test(pathname)) return true
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/assets/') || STATIC_FILE.test(pathname)) return false
  return true
}

/** The Workers Cache key omits URL host. Pass it as trusted entrypoint props
 * so custom domains and the workers.dev preview cannot share page responses. */
export function cachedAstroProps(request: Request): { host: string } {
  return { host: new URL(request.url).host.toLowerCase() }
}
