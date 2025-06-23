# R2 Data Catalog Setup Instructions

## Changes Made

1. **Fixed environment variable**: Changed from `R2_CATALOG_AUTH_TOKEN` to `R2_DATA_CATALOG_API_TOKEN`
2. **Switched to REST Catalog API**: Replaced direct R2 metadata writes with REST API calls
3. **Added proper error handling**: Includes retry logic for table creation and configuration errors
4. **Added CLOUDFLARE_ACCOUNT_ID**: Required for constructing the catalog endpoint URL

## Required Configuration

Before deploying, you need to set these environment variables:

1. **CLOUDFLARE_ACCOUNT_ID**: Your Cloudflare account ID
   - Find this in Cloudflare dashboard → Right sidebar → Account ID
   - Or via Wrangler: `wrangler whoami`

2. **R2_DATA_CATALOG_API_TOKEN**: Already configured as a secret

## Deployment Steps

1. Update `wrangler.jsonc` with your account ID:
   ```json
   "CLOUDFLARE_ACCOUNT_ID": "your-account-id-here"
   ```

2. Deploy the worker:
   ```bash
   bunx wrangler deploy
   ```

3. Monitor logs for any errors:
   ```bash
   bunx wrangler tail
   ```

## How It Works Now

1. **Table Creation**: 
   - Uses REST API at `https://catalog.cloudflarestorage.com/{ACCOUNT_ID}/analytics-source`
   - Automatically creates table on first flush if it doesn't exist
   - Caches table existence in Durable Object storage

2. **Data Writing**:
   - Parquet files are written directly to R2 (this is still allowed)
   - R2 Data Catalog automatically registers files written to the table location
   - No manual snapshot creation needed

3. **Error Handling**:
   - Configuration errors (missing account ID) → 10-minute retry
   - Table creation in progress → 5-minute retry
   - Other errors → 30-second retry (default)

## Troubleshooting

- **"Missing CLOUDFLARE_ACCOUNT_ID"**: Set the account ID in wrangler.jsonc
- **401 Unauthorized**: Check R2_DATA_CATALOG_API_TOKEN is correctly set
- **Table creation fails**: Ensure the bucket has Data Catalog enabled