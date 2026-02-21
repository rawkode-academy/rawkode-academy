resource "infisical_project" "rawkode_cloud" {
  name = "rawkode.cloud"
  slug = "rawkode-cloud"
}

# --- Identity: rawkode.cloud ---
resource "infisical_identity" "rawkode_cloud" {
  name   = "rawkode.cloud"
  role   = "member"
  org_id = local.infisical_org_id
}

# Bootstrap auth method (token auth, minimal TTL)
resource "infisical_identity_token_auth" "bootstrap" {
  identity_id                 = infisical_identity.rawkode_cloud.id
  access_token_ttl            = 300
  access_token_max_ttl        = 300
  access_token_num_uses_limit = 3
}

resource "infisical_identity_token_auth_token" "bootstrap" {
  identity_id = infisical_identity.rawkode_cloud.id
  name        = "cloud-init-bootstrap"
  depends_on  = [infisical_identity_token_auth.bootstrap]
}

# Long-term auth method (universal auth)
resource "infisical_identity_universal_auth" "runtime" {
  identity_id          = infisical_identity.rawkode_cloud.id
  access_token_ttl     = 3600
  access_token_max_ttl = 86400
}

resource "infisical_identity_universal_auth_client_secret" "runtime" {
  identity_id = infisical_identity.rawkode_cloud.id
}

# --- Project membership ---
resource "infisical_project_identity" "rawkode_cloud" {
  project_id  = infisical_project.rawkode_cloud.id
  identity_id = infisical_identity.rawkode_cloud.id
  roles = [
    {
      role_slug = "no-access"
    }
  ]
}

# --- Project access policies ---

# Policy: Bootstrap — read secrets from /bootstrap
resource "infisical_project_identity_specific_privilege" "bootstrap" {
  identity_id  = infisical_project_identity.rawkode_cloud.identity_id
  project_slug = infisical_project.rawkode_cloud.slug

  permissions_v2 = [
    {
      subject = "secrets"
      action  = ["read"]
      conditions = jsonencode({
        environment = { "$eq" = "prod" }
        secretPath  = { "$eq" = "/bootstrap" }
      })
    }
  ]
}

# Policy: Runtime — read secrets from /salt-master
resource "infisical_project_identity_specific_privilege" "runtime" {
  identity_id  = infisical_project_identity.rawkode_cloud.identity_id
  project_slug = infisical_project.rawkode_cloud.slug

  permissions_v2 = [
    {
      subject = "secrets"
      action  = ["read"]
      conditions = jsonencode({
        environment = { "$eq" = "prod" }
        secretPath  = { "$eq" = "/salt-master" }
      })
    }
  ]
}

# --- Secrets: /bootstrap folder ---

resource "infisical_secret" "bootstrap_client_id" {
  name         = "INFISICAL_CLIENT_ID"
  value        = infisical_identity_universal_auth_client_secret.runtime.client_id
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/bootstrap"
}

resource "infisical_secret" "bootstrap_client_secret" {
  name         = "INFISICAL_CLIENT_SECRET"
  value        = infisical_identity_universal_auth_client_secret.runtime.client_secret
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/bootstrap"
}

# --- Secrets: /salt-master folder ---

resource "infisical_secret" "scaleway_access_key" {
  name         = "SCW_ACCESS_KEY"
  value        = scaleway_iam_api_key.salt_master.access_key
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/salt-master"
}

resource "infisical_secret" "scaleway_secret_key" {
  name         = "SCW_SECRET_KEY"
  value        = scaleway_iam_api_key.salt_master.secret_key
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/salt-master"
}

resource "infisical_secret" "scaleway_project_id" {
  name         = "SCW_PROJECT_ID"
  value        = local.scaleway_project_id
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/salt-master"
}
