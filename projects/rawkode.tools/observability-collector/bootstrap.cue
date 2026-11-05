package bootstrap

// The Cloudflare API tokens this project needs. infrastructure/bootstrap creates
// them and writes them to Infisical, because a token created through the API
// can't create other tokens.

_bucket: "rawkode-analytics"

_permissionGroups: {
	pipelinesWrite:   "e34111af393449539859485aa5ddd5bd" // Pipelines Write
	storageWrite:     "bf7481a1826f439697cb59a20b22293e" // Workers R2 Storage Write
	catalogWrite:     "d229766a2f7f4d299f20eaa8c9b1fde9" // Workers R2 Data Catalog Write
	catalogRead:      "45db74139a62490b9b60eb7c4f34994b" // Workers R2 Data Catalog Read
	storageItemWrite: "2efd5506f9c8494dacb1fa10a3e7d5b6" // Workers R2 Storage Bucket Item Write
	storageItemRead:  "6a018a9f2fc74eb6b293b0c548f38b39" // Workers R2 Storage Bucket Item Read
	sqlRead:          "f45430d92e2b4a6cb9f94f2594c141b8" // Workers R2 SQL Read
}

tokens: {
	// Used by this project's infrastructure.cue.
	infrastructure: {
		name:       "observability-collector-infrastructure"
		secretName: "CLOUDFLARE_API_TOKEN"
		permissionGroups: [
			_permissionGroups.pipelinesWrite,
			_permissionGroups.storageWrite,
			_permissionGroups.catalogWrite,
		]
	}

	// Used by the sink to commit to the Iceberg table, and by the maintenance
	// task.
	catalog_writer: {
		name:       "basin-catalog-writer"
		secretName: "BASIN_CATALOG_TOKEN"
		bucket:     _bucket
		permissionGroups: [
			_permissionGroups.catalogWrite,
			_permissionGroups.storageItemWrite,
		]
	}

	// Used by the website's /internal/analytics and by reconcile.
	sql_reader: {
		name:       "basin-sql-reader"
		secretName: "BASIN_SQL_TOKEN"
		bucket:     _bucket
		permissionGroups: [
			_permissionGroups.sqlRead,
			_permissionGroups.catalogRead,
			_permissionGroups.storageItemRead,
		]
	}
}
