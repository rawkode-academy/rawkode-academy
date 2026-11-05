package cuenv

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/cuenv/cuenv/schema"
	collector "github.com/rawkode-academy/rawkode-academy/projects/rawkode.tools/observability-collector:bootstrap"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/infisical/infisical:infisical_provider"
	account_token "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_account_token"
	infisical_identity_oidc_auth "registry.terraform.io/infisical/infisical/resources/infisical_identity_oidc_auth"
	infisical_secret "registry.terraform.io/infisical/infisical/resources/infisical_secret"
	infisical_secret_folder "registry.terraform.io/infisical/infisical/resources/infisical_secret_folder"
)

// What CI needs before it can run infrastructure as one Infisical identity:
// GitHub OIDC login for that identity, the state bucket credentials it reads,
// and the Cloudflare tokens each project declares in its bootstrap package.

_account: env.CLOUDFLARE_ACCOUNT_ID

// The machine identity behind the INFISICAL_MACHINE_IDENTITY_ID repository
// secret and the 1Password client ID and secret in env.cue. It was created by
// hand with admin access, so it is referenced rather than managed, and has no
// infisical_project_identity here: replacing its roles would lock this project
// out.
_identityId: "156205fa-dcbf-4576-b850-36d3454b805e"

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
		ci_oidc_auth: infisical_identity_oidc_auth.#Resource & {
			configuration: {
				identity_id:        _identityId
				oidc_discovery_url: _github.issuer
				bound_issuer:       _github.issuer
				bound_audiences: [_github.audience]
				// Fork pull requests get no OIDC token, so this means this
				// repository's own branches, tags and pull requests, which log in
				// with the identity's admin access.
				bound_subject: "repo:\(_github.repo):*"
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

		for tokenKey, token in collector.tokens {
			"observability_collector_\(tokenKey)_token": account_token.#Resource & {
				configuration: {
					account_id: _account
					name:       token.name
					policies: [{
						effect: "allow"
						if token.bucket != _|_ {
							resources: json.Marshal({"com.cloudflare.edge.r2.bucket.\(_account)_default_\(token.bucket)": "*"})
						}
						if token.bucket == _|_ {
							resources: json.Marshal({"com.cloudflare.api.account.\(_account)": "*"})
						}
						permission_groups: [for group in token.permissionGroups {id: group}]
					}]
				}
			}

			"observability_collector_\(tokenKey)_token_secret": infisical_secret.#Resource & {
				configuration: {
					workspace_id: _infisical.projectId
					env_slug:     _infisical.environment
					folder_path:  infrastructure.resources.basin_folder.outputs.path
					name:         token.secretName
					value:        infrastructure.resources["observability_collector_\(tokenKey)_token"].outputs.value
				}
			}
		}
	}
}
