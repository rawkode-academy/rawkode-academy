@extern(embed)

package cuenv

import (
	"encoding/json"

	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/infisical/infisical:infisical_provider"
	r2_bucket "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_r2_bucket"
	r2_data_catalog "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_r2_data_catalog"
	account_token "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_account_token"
	pipeline_stream "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline_stream"
	pipeline_sink "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline_sink"
	pipeline "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline"
	infisical_secret "registry.terraform.io/infisical/infisical/resources/infisical_secret"
)

// The analytics lake: an R2 bucket with Basin Catalog, the stream the
// collector writes to, the Iceberg sinks and the pipelines between them, plus
// the two API tokens that read and write it. The root token in Infisical
// creates all of it, and the two tokens are copied to Infisical for the tasks
// and the website that need them. infrastructure/bootstrap creates the folders
// and the identity CI logs in with.
//
// The stream takes any CloudEvent as JSON and is never replaced, so its ID in
// wrangler.jsonc never changes. Two pipelines read it: the archive keeps every
// event as sent and never changes; the typed pipeline turns events into typed
// tables and is replaced whenever a table changes.
//
// Streams, sinks and pipelines can't be changed after creation: changing
// their configuration (including the SQL or the sink token) replaces them.
// Read the plan before merging.

_account: env.CLOUDFLARE_ACCOUNT_ID
_bucket:  "rawkode-analytics"

// Bucket-scoped resource key for account token policies.
_bucketResources: json.Marshal({
	"com.cloudflare.edge.r2.bucket.\(_account)_default_\(_bucket)": "*"
})

// The sink refuses a bucket-scoped token ("the provided token is not authorized
// the provided bucket or account_id"), so its token is scoped to the account, as
// in Cloudflare's Pipelines Terraform guide.
_accountResources: json.Marshal({
	"com.cloudflare.api.account.\(_account)": "*"
})

// Cloudflare API token permission groups, from the Basin Catalog and Basin SQL
// docs. The permission-group data sources return a list, which cuenv can't
// reference yet.
_permissionGroups: {
	catalogWrite:     "d229766a2f7f4d299f20eaa8c9b1fde9" // Workers R2 Data Catalog Write
	catalogRead:      "45db74139a62490b9b60eb7c4f34994b" // Workers R2 Data Catalog Read
	storageItemWrite: "2efd5506f9c8494dacb1fa10a3e7d5b6" // Workers R2 Storage Bucket Item Write
	storageItemRead:  "6a018a9f2fc74eb6b293b0c548f38b39" // Workers R2 Storage Bucket Item Read
	sqlRead:          "f45430d92e2b4a6cb9f94f2594c141b8" // Workers R2 SQL Read
}

_archiveSql: string @embed(file=basin/archive.sql, type=text)
_typedSql:   string @embed(file=basin/typed.sql, type=text)
_browserSql: string @embed(file=basin/browser.sql, type=text)

// Every sink writes Parquet into the analytics namespace of the catalog.
_icebergSink: {
	account_id: _account
	type:       "r2_data_catalog"
	format: {
		type:        "parquet"
		compression: "zstd"
	}
	config: {
		account_id: _account
		bucket:     infrastructure.resources.catalog.outputs.bucket_name
		namespace:  "analytics"
		token:      infrastructure.resources.catalog_token.outputs.value
		rolling_policy: interval_seconds: 300
	}
	// The pipeline's SQL shapes the rows, so the sink declares no fields.
	// Cloudflare reports an empty field list, and leaving it unset makes every
	// plan replace the sink.
	schema: fields: []
}

infrastructure: {
	// The cuenv-state R2 bucket, which holds all cuenv state keyed by module
	// path.
	state: s3: {
		bucket:   "cuenv-state"
		region:   "auto"
		endpoint: "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
		// Used by plans and state commands: this key can't write.
		accessKeyId: _readOnly & {secretName: "CUENV_STATE_ACCESS_KEY_ID"}
		secretAccessKey: _readOnly & {secretName: "CUENV_STATE_SECRET_ACCESS_KEY"}
		context: apply: {
			accessKeyId: _readWrite & {secretName: "CUENV_STATE_ACCESS_KEY_ID"}
			secretAccessKey: _readWrite & {secretName: "CUENV_STATE_SECRET_ACCESS_KEY"}
		}
	}

	providers: {
		cloudflare: cloudflare_provider.#Provider
		// OIDC Auth: the identity ID and JWT come from INFISICAL_MACHINE_IDENTITY_ID
		// and INFISICAL_AUTH_JWT, which env.cue passes through.
		infisical: infisical_provider.#Provider & {
			configuration: {
				host: "https://app.infisical.com"
				auth: oidc: {}
			}
		}
	}

	// Plan (and comment the plan) on pull requests with the read-only
	// credentials; apply on pushes to main.
	workflows: {
		plan: environment:  "infrastructure-plan"
		apply: environment: "infrastructure"
	}

	resources: {
		bucket: r2_bucket.#Resource & {
			configuration: {
				account_id: _account
				name:       _bucket
			}
		}

		catalog: r2_data_catalog.#Resource & {
			configuration: {
				account_id:  _account
				bucket_name: infrastructure.resources.bucket.outputs.name
			}
		}

		// Used by the sink to commit to the Iceberg table, and by the
		// maintenance task.
		catalog_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "basin-catalog-writer"
				policies: [{
					effect:    "allow"
					resources: _accountResources
					permission_groups: [
						{id: _permissionGroups.catalogWrite},
						{id: _permissionGroups.storageItemWrite},
					]
				}]
			}
		}

		// Used by the website's /internal/analytics and by reconcile.
		sql_read_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "basin-sql-reader"
				policies: [{
					effect:    "allow"
					resources: _bucketResources
					permission_groups: [
						{id: _permissionGroups.sqlRead},
						{id: _permissionGroups.catalogRead},
						{id: _permissionGroups.storageItemRead},
					]
				}]
			}
		}

		stream: pipeline_stream.#Resource & {
			configuration: {
				account_id: _account
				name:       "analytics_events"
				format: type: "json"
				// One JSON column, so the schema never has to change. The
				// collector sends each CloudEvent as { value: event }.
				schema: fields: [{
					name:     "value"
					type:     "json"
					required: true
				}]
				worker_binding: enabled: true
				// Cloudflare stores a disabled endpoint this way; anything else
				// plans an update that the API rejects.
				http: {
					enabled:        false
					authentication: false
					cors: {}
				}
			}
		}

		archive_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "analytics_events_archive"
				config: table_name: "events_archive"
			}
		}

		short_links_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "short_links"
				config: table_name: "short_links"
			}
		}

		// Each pipeline's SQL names the stream and its sinks, so it has to wait
		// for them.
		archive_pipeline: pipeline.#Resource & {
			dependsOn: ["stream", "archive_sink"]
			configuration: {
				account_id: _account
				name:       "analytics_archive"
				sql:        _archiveSql
			}
		}

		typed_pipeline: pipeline.#Resource & {
			dependsOn: ["stream", "short_links_sink"]
			configuration: {
				account_id: _account
				name:       "analytics_typed"
				sql:        _typedSql
			}
		}

		// Additive: preserve both live pipelines, their sinks and stream identity.
		browser_sink_v1: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "analytics_browser_events_v1"
				config: table_name: "browser_events_v1"
			}
		}

		browser_pipeline_v1: pipeline.#Resource & {
			dependsOn: ["stream", "browser_sink_v1"]
			configuration: {
				account_id: _account
				name:       "analytics_browser_v1"
				sql:        _browserSql
			}
		}

		catalog_token_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisicalSecret.projectId
				env_slug:     _infisicalSecret.environment
				folder_path:  _basinSecret.secretPath
				name:         "BASIN_CATALOG_TOKEN"
				value:        infrastructure.resources.catalog_token.outputs.value
			}
		}

		sql_read_token_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisicalSecret.projectId
				env_slug:     _infisicalSecret.environment
				folder_path:  _basinSecret.secretPath
				name:         "BASIN_SQL_TOKEN"
				value:        infrastructure.resources.sql_read_token.outputs.value
			}
		}
	}
}
