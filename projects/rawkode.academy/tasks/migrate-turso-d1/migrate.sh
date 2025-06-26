#!/usr/bin/env bash
set -xeuo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <service-name>"
    echo "Example: $0 service-name"
    exit 1
fi

SERVICE_NAME="$1"
OUTPUT_FILE="output.db"
TABLE_NAME=${SERVICE_NAME//-/_}

if ! command -v turso &> /dev/null; then
    echo "Error: turso CLI is not installed"
    exit 1
fi

turso org switch rawkodeacademy
turso db export "$SERVICE_NAME" --overwrite --output-file "$OUTPUT_FILE"
sqlite3 "$OUTPUT_FILE" -cmd ".mode insert $TABLE_NAME" "select * from $TABLE_NAME" > "${TABLE_NAME}.sql"

rm ${OUTPUT_FILE}

bunx wrangler d1 execute --config ../../platform/${SERVICE_NAME}/read-model/wrangler.jsonc platform-${SERVICE_NAME} --file "${TABLE_NAME}.sql" --remote

rm ${TABLE_NAME}.sql
