# Incremental Static Regeneration (ISR) Setup

This document explains the ISR implementation for the Rawkode Academy website's
video pages.

## Overview

The video pages use Cloudflare's edge caching with time-based revalidation to
serve fresh content while maintaining excellent performance for high-traffic
scenarios.

## Cache Configuration

### Video Listing Pages (`/watch`, `/watch/latest`)

- **Client Cache**: 5 minutes (`max-age=300`)
- **Edge Cache**: 1 hour (`s-maxage=3600`)
- **Stale While Revalidate**: 24 hours (`stale-while-revalidate=86400`)
- **Cache Tags**: `videos-page, videos-list, videos-latest` or `videos-all`

### Individual Video Pages (`/watch/[slug]`)

- **Client Cache**: 10 minutes (`max-age=600`)
- **Edge Cache**: 2 hours (`s-maxage=7200`)
- **Stale While Revalidate**: 48 hours (`stale-while-revalidate=172800`)
- **Cache Tags**: `video-{slug}, videos-page, video-detail`

## Cache Purging

### Manual Purge via Justfile

The project includes a Justfile target for cache invalidation:

```bash
# Purge videos-latest cache tag
just invalidate-videos-cache

# With environment variables (non-interactive)
CF_API_TOKEN=your-token CF_ZONE_ID=your-zone-id just invalidate-videos-cache
```

The command will prompt for Cloudflare credentials if not provided via
environment variables.

### Direct Cloudflare API

You can also purge cache directly using Cloudflare's API:

```bash
# Purge by cache tags
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["videos-latest", "videos-page"]}'

# Purge specific video
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["video-kubernetes-basics"]}'

# Purge specific URLs
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"files": ["https://rawkode.academy/watch"]}'
```

### Environment Variables (Optional)

For convenience, you can set these in your shell or `.env` file:

```env
CF_ZONE_ID=your-cloudflare-zone-id
CF_API_TOKEN=your-cloudflare-api-token
```

### When to Purge

Purge cache when:

- New videos are published
- Video metadata is updated
- Videos are unpublished or made private

## How It Works

1. **First Request**: Cloudflare edge serves the page dynamically, caches the
   response
2. **Subsequent Requests**: Served from edge cache (very fast)
3. **After Cache Expires**:
   - If within stale window: Serves stale content immediately
   - Revalidates in background for next request
4. **Cache Purge**: Immediately removes cached content, next request generates
   fresh

## Benefits

- **Performance**: 99% of requests served from edge cache
- **Freshness**: New videos appear within cache TTL (1 hour for listings)
- **Reliability**: Stale content serves during origin issues
- **Cost**: Minimal compute, mostly CDN bandwidth
- **Scalability**: Handles traffic spikes without origin load

## Monitoring

Check cache performance using response headers:

- `CF-Cache-Status`: HIT, MISS, EXPIRED, STALE
- `X-Build-Time`: When the page was generated
- `Age`: How long content has been in cache

## Troubleshooting

### Videos not appearing immediately

- Normal behavior - wait for cache TTL or trigger manual purge
- Check if webhook is properly configured

### Cache not working

- Verify `CF-Cache-Status` header
- Ensure Cloudflare proxy is enabled for domain
- Check environment variables are set

### Performance issues

- Monitor `CF-Cache-Status` for high MISS rate
- Adjust TTLs based on update frequency
- Consider increasing stale window for better availability
