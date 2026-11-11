package cuenv

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/cuenv/cuenv/schema"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/dnsimple/dnsimple:dnsimple_provider"
	"registry.terraform.io/infisical/infisical:infisical_provider"
	"registry.terraform.io/integrations/github:github_provider"
	account_token "registry.terraform.io/cloudflare/cloudflare/resources/cloudflare_account_token"
	"registry.terraform.io/dnsimple/dnsimple/resources/dnsimple_domain_delegation"
	github_actions_variable "registry.terraform.io/integrations/github/resources/github_actions_variable"
	github_repository_environment "registry.terraform.io/integrations/github/resources/github_repository_environment"
	github_repository_environment_deployment_policy "registry.terraform.io/integrations/github/resources/github_repository_environment_deployment_policy"
	github_repository_ruleset "registry.terraform.io/integrations/github/resources/github_repository_ruleset"
	infisical_identity_oidc_auth "registry.terraform.io/infisical/infisical/resources/infisical_identity_oidc_auth"
	infisical_project_role "registry.terraform.io/infisical/infisical/resources/infisical_project_role"
	infisical_project_scoped_identity "registry.terraform.io/infisical/infisical/resources/infisical_project_scoped_identity"
	infisical_secret "registry.terraform.io/infisical/infisical/resources/infisical_secret"
	infisical_secret_folder "registry.terraform.io/infisical/infisical/resources/infisical_secret_folder"
)

// What CI needs before it can run infrastructure, and nothing more:
//
// - github-read-write, the Infisical identity infrastructure applies log in
//   as. Its login only works from an apply workflow on main, in the
//   `infrastructure` GitHub environment, so every apply waits for a reviewer.
//   It reads the github-read-write Cloudflare token (CLOUDFLARE_ROOT_TOKEN)
//   and the state bucket credentials.
// - github-read-only, the identity infrastructure plans on pull requests log
//   in as, in the `infrastructure-plan` GitHub environment. It reads
//   /infrastructure/read-only: a Cloudflare token and a state key that can
//   only read.
// - github-actions, the identity deploys on main log in as, in the
//   `production` GitHub environment. It reads project secrets only.
//
// Every other pull request job gets no identity and no secrets. Only main can
// enter the `infrastructure` environment, and the rulesets below make every
// change to main a reviewed pull request with passing checks.
//
// The DNSimple delegations live here too. DNSimple has no read-only tokens,
// so its token stays in 1Password and only this project, run by hand, holds
// it.

_account: env.CLOUDFLARE_ACCOUNT_ID

_infisical: {
	projectId:   "6575a392d7a5ef0555ade86b"
	environment: "production"
}

_github: {
	issuer:     "https://token.actions.githubusercontent.com"
	owner:      "rawkode-academy"
	repository: "rawkode-academy"
	repo:       "\(owner)/\(repository)"
	// IDs survive a rename; a recreated repository with the same name gets
	// new ones.
	repositoryId: "464263102"
	ownerId:      "88555011"
	// The audience GitHub issues when a job doesn't request one.
	audience: "https://github.com/rawkode-academy"
	// The GitHub environment deploys run in, and the one infrastructure
	// applies run in.
	deployEnvironment:         "production"
	infrastructureEnvironment: "infrastructure"
	// The one infrastructure plans on pull requests run in.
	planEnvironment: "infrastructure-plan"
	// Who approves an apply: rawkode.
	reviewers: [145816]
	// The check every pull request must pass: .github/workflows/pull-request.yml.
	requiredCheck: "validate"
	// GitHub Actions, as the app that reports the required check.
	actionsAppId: 15368
}

// Cloudflare API token permission groups.
_permissionGroups: {
	storageItemWrite: "2efd5506f9c8494dacb1fa10a3e7d5b6" // Workers R2 Storage Bucket Item Write
	storageItemRead:  "6a018a9f2fc74eb6b293b0c548f38b39" // Workers R2 Storage Bucket Item Read
	zoneRead:         "c8fed203ed3043cba015a93ad1616f1f" // Zone Read
	zoneSettingsRead: "517b21aee92c4d89936c976ba6e4be55" // Zone Settings Read
	dnsRead:          "82e64a83756745bbbb1c9c2701bf816b" // DNS Read
	sslRead:          "7b7216b327b04b8fbc8f524e1f9b7531" // SSL and Certificates Read
	botRead:          "07bea2220b2343fa9fae15656c0d8e88" // Bot Management Read
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
		// The token comes from GITHUB_TOKEN in env.cue.
		github: github_provider.#Provider & {
			configuration: owner: _github.owner
		}
		// The token comes from DNSIMPLE_TOKEN in env.cue.
		dnsimple: dnsimple_provider.#Provider & {
			configuration: account: "126046"
		}
		// Universal Auth: the client ID and secret come from env.cue.
		infisical: infisical_provider.#Provider & {
			configuration: {
				host: "https://app.infisical.com"
				auth: universal: {}
			}
		}
	}

	resources: {
		// Domains registered with DNSimple, delegated to the name servers
		// Cloudflare assigns every zone in the account. infrastructure/dns
		// manages their zones.
		// The names infrastructure/dns gave them, so imports keep their address.
		for slug, registered in {"rawko-de": "rawko.de", "rawkode-link": "rawkode.link"} {
			"\(slug)_delegation": dnsimple_domain_delegation.#Resource & {
				configuration: {
					domain: registered
					name_servers: ["curt.ns.cloudflare.com", "miki.ns.cloudflare.com"]
				}
			}
		}

		// For deploys on main. No infrastructure credentials: those need a
		// reviewed apply.
		ci_role: infisical_project_role.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "CI"
				slug:       "ci"
				permissions_v2: [
					// The Basin tokens the collector's maintenance task reads.
					{
						subject: "secrets"
						action: ["describeSecret", "readValue"]
						conditions: json.Marshal({
							environment: "$eq": _infisical.environment
							secretPath: "$eq":  "/projects/basin"
						})
					},
				]
			}
		}

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
				// Infisical splits each value on commas and matches any part.
				bound_claims: {
					repository:          _github.repo
					repository_id:       _github.repositoryId
					repository_owner_id: _github.ownerId
					ref:                 "refs/heads/main"
					environment:         _github.deployEnvironment
					event_name:          "push,workflow_dispatch"
				}
				access_token_ttl:     3600
				access_token_max_ttl: 3600
			}
		}

		// The tokens infrastructure runs with, for reviewed applies only.
		read_write_role: infisical_project_role.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "github-read-write"
				slug:       "github-read-write"
				permissions_v2: [
					// The Cloudflare token and the state credentials.
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

		read_write_identity: infisical_project_scoped_identity.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "github-read-write"
				roles: [{role_slug: infrastructure.resources.read_write_role.outputs.slug}]
			}
		}

		// Only an apply workflow on main, in the `infrastructure` environment,
		// which a reviewer has approved, can log in. Pull requests,
		// pull_request_target and workflow_run runs can't: their event,
		// environment or ref doesn't match.
		read_write_oidc_login: infisical_identity_oidc_auth.#Resource & {
			configuration: {
				identity_id:        infrastructure.resources.read_write_identity.outputs.id
				oidc_discovery_url: _github.issuer
				bound_issuer:       _github.issuer
				bound_audiences: [_github.audience]
				bound_claims: {
					repository:          _github.repo
					repository_id:       _github.repositoryId
					repository_owner_id: _github.ownerId
					ref:                 "refs/heads/main"
					environment:         _github.infrastructureEnvironment
					event_name:          "push,workflow_dispatch"
					workflow_ref:        "\(_github.repo)/.github/workflows/*-infrastructure-apply.yml@refs/heads/main"
				}
				access_token_ttl:     3600
				access_token_max_ttl: 3600
			}
		}

		// What a plan may read. Nothing here can change Cloudflare or the state.
		read_only_role: infisical_project_role.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "github-read-only"
				slug:       "github-read-only"
				permissions_v2: [{
					subject: "secrets"
					action: ["describeSecret", "readValue"]
					conditions: json.Marshal({
						environment: "$eq": _infisical.environment
						secretPath: "$eq":  "/infrastructure/read-only"
					})
				}]
			}
		}

		read_only_identity: infisical_project_scoped_identity.#Resource & {
			configuration: {
				project_id: _infisical.projectId
				name:       "github-read-only"
				roles: [{role_slug: infrastructure.resources.read_only_role.outputs.slug}]
			}
		}

		// A plan workflow on a pull request, in the `infrastructure-plan`
		// environment. Anyone who can push a branch can change that workflow,
		// so treat everything this identity reads as readable by them.
		read_only_oidc_login: infisical_identity_oidc_auth.#Resource & {
			configuration: {
				identity_id:        infrastructure.resources.read_only_identity.outputs.id
				oidc_discovery_url: _github.issuer
				bound_issuer:       _github.issuer
				bound_audiences: [_github.audience]
				bound_claims: {
					repository:          _github.repo
					repository_id:       _github.repositoryId
					repository_owner_id: _github.ownerId
					ref:                 "refs/pull/*/merge"
					environment:         _github.planEnvironment
					event_name:          "pull_request"
					workflow_ref:        "\(_github.repo)/.github/workflows/*-infrastructure-plan.yml@refs/pull/*/merge"
				}
				access_token_ttl:     3600
				access_token_max_ttl: 3600
			}
		}

		// Deploys, and website previews on pull requests. Any branch can enter
		// it and it holds no secrets: github-actions only logs in from main.
		production_environment: github_repository_environment.#Resource & {
			configuration: {
				repository:        _github.repository
				environment:       _github.deployEnvironment
				can_admins_bypass: false
			}
		}

		// Infrastructure applies. Each waits for a reviewer.
		infrastructure_environment: github_repository_environment.#Resource & {
			configuration: {
				repository:  _github.repository
				environment: _github.infrastructureEnvironment
				// rawkode reviews alone, so approving their own applies must work.
				prevent_self_review: false
				can_admins_bypass:   false
				reviewers: [{users: _github.reviewers}]
				deployment_branch_policy: [{
					protected_branches:     false
					custom_branch_policies: true
				}]
			}
		}

		infrastructure_from_main: github_repository_environment_deployment_policy.#Resource & {
			dependsOn: ["infrastructure_environment"]
			configuration: {
				repository:     _github.repository
				environment:    _github.infrastructureEnvironment
				branch_pattern: "main"
			}
		}

		// Infrastructure plans on pull requests. Any branch can enter it and it
		// holds no secrets: it only names the job in its OIDC token.
		plan_environment: github_repository_environment.#Resource & {
			configuration: {
				repository:  _github.repository
				environment: _github.planEnvironment
			}
		}

		// Two rulesets, because a bypass lifts everything in its ruleset. Nobody
		// can bypass this one: every change to main is a pull request whose
		// checks pass.
		main_merge_requirements: github_repository_ruleset.#Resource & {
			configuration: {
				repository:  _github.repository
				name:        "main: merge requirements"
				target:      "branch"
				enforcement: "active"
				conditions: [{ref_name: [{include: ["~DEFAULT_BRANCH"], exclude: []}]}]
				rules: [{
					deletion:         true
					non_fast_forward: true
					pull_request: [{required_approving_review_count: 0}]
					required_status_checks: [{
						strict_required_status_checks_policy: false
						required_check: [{
							context:        _github.requiredCheck
							integration_id: _github.actionsAppId
						}]
					}]
				}]
			}
		}

		// Code owner review. rawkode reviews alone and can't approve their own
		// pull requests, so organisation admins (only rawkode) may merge
		// without it, through a pull request only.
		main_review_requirements: github_repository_ruleset.#Resource & {
			configuration: {
				repository:  _github.repository
				name:        "main: review requirements"
				target:      "branch"
				enforcement: "active"
				conditions: [{ref_name: [{include: ["~DEFAULT_BRANCH"], exclude: []}]}]
				bypass_actors: [{
					actor_id:    1
					actor_type:  "OrganizationAdmin"
					bypass_mode: "pull_request"
				}]
				rules: [{
					pull_request: [{
						required_approving_review_count: 1
						require_code_owner_review:       true
						dismiss_stale_reviews_on_push:   true
						require_last_push_approval:      true
					}]
				}]
			}
		}

		// Identity IDs aren't secret; the root env.cue picks one per workflow.
		ci_identity_variable: github_actions_variable.#Resource & {
			configuration: {
				repository:    _github.repository
				variable_name: "INFISICAL_MACHINE_IDENTITY_ID"
				value:         infrastructure.resources.ci_identity.outputs.id
			}
		}

		read_write_identity_variable: github_actions_variable.#Resource & {
			configuration: {
				repository:    _github.repository
				variable_name: "INFISICAL_READ_WRITE_IDENTITY_ID"
				value:         infrastructure.resources.read_write_identity.outputs.id
			}
		}

		read_only_identity_variable: github_actions_variable.#Resource & {
			configuration: {
				repository:    _github.repository
				variable_name: "INFISICAL_READ_ONLY_IDENTITY_ID"
				value:         infrastructure.resources.read_only_identity.outputs.id
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

		read_only_folder: infisical_secret_folder.#Resource & {
			configuration: {
				project_id:       _infisical.projectId
				environment_slug: _infisical.environment
				folder_path:      infrastructure.resources.infrastructure_folder.outputs.path
				name:             "read-only"
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

		// What CI runs infrastructure with. Write-only keeps it out of state, where
		// any branch could read it. Changing the secret doesn't plan an update, so
		// bump the version to rotate it.
		root_token_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id:     _infisical.projectId
				env_slug:         _infisical.environment
				folder_path:      infrastructure.resources.infrastructure_folder.outputs.path
				name:             "CLOUDFLARE_ROOT_TOKEN"
				value_wo:         schema.#WriteOnly & _rootToken
				value_wo_version: 1
			}
		}

		// R2 credentials for the cuenv state bucket.
		state_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "infrastructure-ci-state"
				policies: [{
					effect: "allow"
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

		// What plans read Cloudflare with: every zone's records and settings.
		read_only_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "infrastructure-ci-read-only"
				policies: [{
					effect: "allow"
					resources: json.Marshal({"com.cloudflare.api.account.\(_account)": "*"})
					permission_groups: [
						{id: _permissionGroups.zoneRead},
						{id: _permissionGroups.zoneSettingsRead},
						{id: _permissionGroups.dnsRead},
						{id: _permissionGroups.sslRead},
						{id: _permissionGroups.botRead},
					]
				}]
			}
		}

		read_only_token_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisical.projectId
				env_slug:     _infisical.environment
				folder_path:  infrastructure.resources.read_only_folder.outputs.path
				name:         "CLOUDFLARE_API_TOKEN"
				value:        infrastructure.resources.read_only_token.outputs.value
			}
		}

		// R2 credentials that read the state bucket and can't write it. The
		// bucket holds every project's state, so a plan can read all of it.
		state_read_only_token: account_token.#Resource & {
			configuration: {
				account_id: _account
				name:       "infrastructure-ci-state-read-only"
				policies: [{
					effect: "allow"
					resources: json.Marshal({"com.cloudflare.edge.r2.bucket.\(_account)_default_\(_stateBucket)": "*"})
					permission_groups: [{id: _permissionGroups.storageItemRead}]
				}]
			}
		}

		state_read_only_access_key_id_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisical.projectId
				env_slug:     _infisical.environment
				folder_path:  infrastructure.resources.read_only_folder.outputs.path
				name:         "CUENV_STATE_ACCESS_KEY_ID"
				value:        infrastructure.resources.state_read_only_token.outputs.id
			}
		}

		state_read_only_secret_access_key_secret: infisical_secret.#Resource & {
			configuration: {
				workspace_id: _infisical.projectId
				env_slug:     _infisical.environment
				folder_path:  infrastructure.resources.read_only_folder.outputs.path
				name:         "CUENV_STATE_SECRET_ACCESS_KEY"
				value:        hex.Encode(sha256.Sum256(infrastructure.resources.state_read_only_token.outputs.value))
			}
		}
	}
}
