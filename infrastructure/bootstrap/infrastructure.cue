package cuenv

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/cuenv/cuenv/schema"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/infisical/infisical:infisical_provider"
	account_token "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_account_token"
	infisical_identity_oidc_auth "registry.terraform.io/infisical/infisical/resources/infisical_identity_oidc_auth"
	infisical_project_role "registry.terraform.io/infisical/infisical/resources/infisical_project_role"
	infisical_project_scoped_identity "registry.terraform.io/infisical/infisical/resources/infisical_project_scoped_identity"
	infisical_secret "registry.terraform.io/infisical/infisical/resources/infisical_secret"
	infisical_secret_folder "registry.terraform.io/infisical/infisical/resources/infisical_secret_folder"
)

// What CI needs before it can run infrastructure: an Infisical identity that
// logs in from main and reads only what it needs, and the state bucket
// credentials. Projects create their own Cloudflare resources and tokens with
// the root token.

_account: env.CLOUDFLARE_ACCOUNT_ID

_infisical: {
	projectId:   "6575a392d7a5ef0555ade86b"
	environment: "production"
}

_github: {
	issuer: "https://token.actions.githubusercontent.com"
	repo:   "rawkode-academy/rawkode-academy"
	// The audience GitHub issues when a job doesn't request one.
	audience: "https://github.com/rawkode-academy"
}

// Cloudflare API token permission groups.
_permissionGroups: {
	storageItemWrite: "2efd5506f9c8494dacb1fa10a3e7d5b6" // Workers R2 Storage Bucket Item Write
	storageItemRead:  "6a018a9f2fc74eb6b293b0c548f38b39" // Workers R2 Storage Bucket Item Read
}

_stateBucket: "cuenv-state"

infrastructure: {
	state: s3: {
		bucket:   _stateBucket
		region:   "auto"
		endpoint: "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
		accessKeyId: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cuenv-state/username"}
		secretAccessKey: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cuenv-state/password"}
	}

	providers: {
		cloudflare: cloudflare_provider.#Provider
		// Universal Auth: the client ID and secret come from env.cue.
		infisical: infisical_provider.#Provider & {
			configuration: {
				host: "https://app.infisical.com"
				auth: universal: {}
			}
		}
	}

	resources: {
		ci_role: infisical_project_role.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "CI"
				slug:       "ci"
				permissions_v2: [
					// The root token and the state credentials.
					{
						subject: "secrets"
						action: ["describeSecret", "readValue"]
						conditions: json.Marshal({
							environment: "$eq": _infisical.environment
							secretPath: "$eq":  "/infrastructure"
						})
					},
					// The Basin tokens the collector's infrastructure.cue writes.
					{
						subject: "secrets"
						action: ["describeSecret", "readValue", "create", "edit", "delete"]
						conditions: json.Marshal({
							environment: "$eq": _infisical.environment
							secretPath: "$eq":  "/projects/basin"
						})
					},
				]
			}
		}

		// Its ID is the INFISICAL_MACHINE_IDENTITY_ID repository secret.
		ci_identity: infisical_project_scoped_identity.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "github-actions"
				roles: [{role_slug: infrastructure.resources.ci_role.outputs.slug}]
			}
		}

		ci_oidc_login: infisical_identity_oidc_auth.#Resource & {
			configuration: {
				identity_id:        infrastructure.resources.ci_identity.outputs.id
				oidc_discovery_url: _github.issuer
				bound_issuer:       _github.issuer
				bound_audiences: [_github.audience]
				// Claims rather than a subject, because a job in a GitHub environment
				// has that environment as its subject instead of its branch.
				bound_claims: {
					repository: _github.repo
					ref:        "refs/heads/main"
				}
				access_token_ttl:     3600
				access_token_max_ttl: 3600
			}
		}

		infrastructure_folder: infisical_secret_folder.#Resource & {
			configuration: {
				project_id:       _infisical.projectId
				environment_slug: _infisical.environment
				folder_path:      "/"
				name:             "infrastructure"
			}
		}

		// /projects already exists: rawkode.cloud keeps its secrets under it.
		basin_folder: infisical_secret_folder.#Resource & {
			configuration: {
				project_id:       _infisical.projectId
				environment_slug: _infisical.environment
				folder_path:      "/projects"
				name:             "basin"
			}
		}

		// R2 credentials for the cuenv state bucket.
		state_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "infrastructure-ci-state"
				policies: [{
					effect:    "allow"
					resources: json.Marshal({"com.cloudflare.edge.r2.bucket.\(_account)_default_\(_stateBucket)": "*"})
					permission_groups: [
						{id: _permissionGroups.storageItemWrite},
						{id: _permissionGroups.storageItemRead},
					]
				}]
			}
		}

		// R2's S3 credentials derive from an API token: the access key is its
		// ID, and the secret key is the SHA-256 of its value.
		state_access_key_id_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisical.projectId
				env_slug:     _infisical.environment
				folder_path:  infrastructure.resources.infrastructure_folder.outputs.path
				name:         "CUENV_STATE_ACCESS_KEY_ID"
				value:        infrastructure.resources.state_token.outputs.id
			}
		}

		state_secret_access_key_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisical.projectId
				env_slug:     _infisical.environment
				folder_path:  infrastructure.resources.infrastructure_folder.outputs.path
				name:         "CUENV_STATE_SECRET_ACCESS_KEY"
				value:        hex.Encode(sha256.Sum256(infrastructure.resources.state_token.outputs.value))
			}
		}
	}
}
