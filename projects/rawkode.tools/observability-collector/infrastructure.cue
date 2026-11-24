@extern(embed)

package cuenv

import (
	"encoding/json"
	"strings"

	"github.com/cuenv/cuenv/schema"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/infisical/infisical:infisical_provider"
	r2_bucket "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_r2_bucket"
	r2_data_catalog "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_r2_data_catalog"
	account_token "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_account_token"
	pipeline_stream "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline_stream"
	pipeline_sink "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline_sink"
	pipeline "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_pipeline"
	infisical_secret "registry.terraform.io/infisical/infisical/resources/infisical_secret"
	permission_groups "registry.terraform.io/cloudflare/cloudflare/data/cloudflare_account_api_token_permission_groups_list"
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
// docs, looked up by name so no ID is hardcoded. The lookup takes a
// URL-encoded name and fails the plan if nothing matches.
_permissionNames: [
	"Workers R2 Data Catalog Write",
	"Workers R2 Data Catalog Read",
	"Workers R2 Storage Bucket Item Write",
	"Workers R2 Storage Bucket Item Read",
	"Workers R2 SQL Read",
]

// Permission group IDs by name, read from Cloudflare.
_permissions: {
	for n in _permissionNames {
		(n): schema.#Select & {
			from: infrastructure.data[n].outputs.result
			path: [0, "id"]
			type: "string"
		}
	}
}

_archiveSql: string @embed(file=basin/archive.sql, type=text)
_typedSql:   string @embed(file=basin/typed.sql, type=text)

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

	// The name filter takes the URL-encoded permission group name.
	data: {
		for n in _permissionNames {
			(n): permission_groups.#DataSource & {
				configuration: {
					account_id: _account
					name:       strings.Replace(n, " ", "%20", -1)
				}
				outputs: result: type: "list"
			}
		}
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
						{id: _permissions["Workers R2 Data Catalog Write"]},
						{id: _permissions["Workers R2 Storage Bucket Item Write"]},
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
						{id: _permissions["Workers R2 SQL Read"]},
						{id: _permissions["Workers R2 Data Catalog Read"]},
						{id: _permissions["Workers R2 Storage Bucket Item Read"]},
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

		// Rows before 23 November 2026. No pipeline writes to it any more; the
		// sink stays so the table and its history are left untouched.
		short_links_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "short_links"
				config: table_name: "short_links"
			}
		}

		// short_links plus the bot labels. A sink can't change its table's
		// columns, so the labelled table has a new name.
		short_link_redirects_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "short_link_redirects"
				config: table_name: "short_link_redirects"
			}
		}

		// Typed browser events (rawkode-academy-browser), one table per event
		// family. Rows are at-least-once: deduplicate on event_id.
		web_page_views_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "web_page_views"
				config: table_name: "web_page_views"
			}
		}
		web_clicks_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "web_clicks"
				config: table_name: "web_clicks"
			}
		}
		web_page_leaves_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "web_page_leaves"
				config: table_name: "web_page_leaves"
			}
		}
		web_exceptions_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "web_exceptions"
				config: table_name: "web_exceptions"
			}
		}
		web_vitals_sink: pipeline_sink.#Resource & {
			configuration: _icebergSink & {
				name: "web_vitals"
				config: table_name: "web_vitals"
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
			dependsOn: [
				"stream",
				"short_link_redirects_sink",
				"web_page_views_sink",
				"web_clicks_sink",
				"web_page_leaves_sink",
				"web_exceptions_sink",
				"web_vitals_sink",
			]
			configuration: {
				account_id: _account
				name:       "analytics_typed"
				sql:        _typedSql
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
