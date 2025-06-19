#!/bin/bash

# Setup R2 buckets for analytics platform

echo "Creating R2 buckets for analytics platform..."

# Production buckets
echo "Creating production buckets..."
op run -- bunx wrangler r2 bucket create analytics-source
op run -- bunx wrangler r2 bucket create analytics-processed
op run -- bunx wrangler r2 bucket create analytics-catalog

echo "R2 buckets created successfully!"

# Set up lifecycle rules for analytics-processed bucket
echo -e "\nSetting up lifecycle rules for analytics-processed bucket..."

# Delete processed data after 90 days (can be rebuilt from raw)
op run -- bunx wrangler r2 bucket lifecycle add analytics-processed \
  "delete-old-processed-data" \
  "processed/" \
  --expire-days 90 \
  -y

# Delete temporary files after 7 days
op run -- bunx wrangler r2 bucket lifecycle add analytics-processed \
  "delete-temp-files" \
  "temp/" \
  --expire-days 7 \
  -y

echo "Lifecycle rules configured successfully!"

# List lifecycle rules
echo -e "\nLifecycle rules for analytics-processed:"
op run -- bunx wrangler r2 bucket lifecycle list analytics-processed

# List all buckets
echo -e "\nListing all R2 buckets:"
op run -- bunx wrangler r2 bucket list
