package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "rawkode-academy-task-backup-content"

// Nightly exports of every content D1 database to the private
// rawkode-academy-backups R2 bucket (see backup.ts). Run `setup` once to
// create the bucket and its 90-day expiry rule.
env: {
	CLOUDFLARE_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce"
	BACKUP_BUCKET:         "rawkode-academy-backups"
	BACKUP_RETENTION_DAYS: "90"

	environment: production: {
		CLOUDFLARE_API_TOKEN: schema.#OnePasswordRef & {
			ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"
		}
	}
}

ci: pipelines: {}

tasks: {
	backup: schema.#Task & {
		hermetic: false
		command:  "bun"
		args: ["run", "backup.ts"]
	}
	setup: schema.#Task & {
		hermetic: false
		command:  "sh"
		args: ["-lc", "bunx wrangler r2 bucket create \"$BACKUP_BUCKET\" || true; bunx wrangler r2 bucket lifecycle add \"$BACKUP_BUCKET\" expire-d1-exports d1/ --expire-days \"$BACKUP_RETENTION_DAYS\" --force"]
	}
}
