#!/usr/bin/env python3

import os
import sys
import boto3
from botocore.config import Config

def main():
    # Check command line arguments
    if len(sys.argv) != 2:
        print("Usage: python3 delete-r2-prefix.py <prefix>", file=sys.stderr)
        print("Example: python3 delete-r2-prefix.py 'path/to/delete/'", file=sys.stderr)
        sys.exit(1)
    
    prefix = sys.argv[1]
    
    # Check environment variables
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    for var in required_vars:
        if not os.environ.get(var):
            print(f"Error: {var} is not set", file=sys.stderr)
            sys.exit(1)
    
    account_id = os.environ['R2_ACCOUNT_ID']
    access_key_id = os.environ['R2_ACCESS_KEY_ID']
    secret_access_key = os.environ['R2_SECRET_ACCESS_KEY']
    bucket_name = os.environ['R2_BUCKET_NAME']
    
    # Check if we're getting 1Password references instead of actual values
    if account_id.startswith('op://'):
        print("Error: Environment variables contain 1Password references.", file=sys.stderr)
        print("Please run this script with: op run -- python3 delete-r2-prefix.py <prefix>", file=sys.stderr)
        sys.exit(1)
    
    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    
    print("Configuration:")
    print(f"  Bucket: {bucket_name}")
    print(f"  Prefix: {prefix}")
    print(f"  Endpoint: {endpoint_url}")
    print()
    
    # Prompt for confirmation
    response = input(f"Are you sure you want to delete all objects with prefix '{prefix}'? (yes/no): ")
    if response.lower() != 'yes':
        print("Operation cancelled.")
        sys.exit(0)
    
    # Create S3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(region_name='auto')
    )
    
    # List all objects with the prefix
    print(f"Listing objects with prefix '{prefix}'...")
    
    objects_to_delete = []
    paginator = s3_client.get_paginator('list_objects_v2')
    
    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
        if 'Contents' in page:
            for obj in page['Contents']:
                objects_to_delete.append(obj['Key'])
    
    if not objects_to_delete:
        print(f"No objects found with prefix '{prefix}'")
        sys.exit(0)
    
    print(f"Found {len(objects_to_delete)} objects to delete")
    
    # Delete objects
    deleted = 0
    for key in objects_to_delete:
        print(f"Deleting: {key}")
        try:
            s3_client.delete_object(Bucket=bucket_name, Key=key)
            deleted += 1
        except Exception as e:
            print(f"Error deleting {key}: {e}", file=sys.stderr)
    
    print()
    print(f"Successfully deleted {deleted} objects with prefix '{prefix}'")

if __name__ == "__main__":
    main()