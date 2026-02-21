resource "infisical_project" "rawkode_cloud" {
  name = "rawkode.cloud"
  slug = "rawkode-cloud"
}

resource "time_sleep" "wait_for_project" {
  depends_on      = [infisical_project.rawkode_cloud]
  create_duration = "5s"
}

# --- Identity: rawkode.cloud ---
resource "infisical_identity" "rawkode_cloud" {
  name   = "rawkode.cloud"
  role   = "member"
  org_id = local.infisical_org_id
}

# Long-term auth method (universal auth)
resource "infisical_identity_universal_auth" "runtime" {
  identity_id          = infisical_identity.rawkode_cloud.id
  access_token_ttl     = 3600
  access_token_max_ttl = 86400
}

resource "infisical_identity_universal_auth_client_secret" "runtime" {
  identity_id = infisical_identity.rawkode_cloud.id
  depends_on  = [infisical_identity_universal_auth.runtime]
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

# Policy: read secrets from /projects/rawkode-cloud
resource "infisical_project_identity_specific_privilege" "runtime" {
  identity_id  = infisical_project_identity.rawkode_cloud.identity_id
  project_slug = infisical_project.rawkode_cloud.slug

  permissions_v2 = [
    {
      subject = "secrets"
      action  = ["read"]
      conditions = jsonencode({
        environment = { "$eq" = "prod" }
        secretPath  = { "$eq" = "/projects/rawkode-cloud" }
      })
    }
  ]
}

# --- Secret folder ---

resource "infisical_secret_folder" "rawkode_cloud" {
  name             = "rawkode-cloud"
  environment_slug = "prod"
  folder_path      = "/projects"
  project_id       = infisical_project.rawkode_cloud.id
  depends_on       = [time_sleep.wait_for_project]
}

# --- Secrets: /projects/rawkode-cloud folder ---

resource "infisical_secret" "scaleway_access_key" {
  name         = "SCW_ACCESS_KEY"
  value        = scaleway_iam_api_key.salt_master.access_key
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

resource "infisical_secret" "scaleway_secret_key" {
  name         = "SCW_SECRET_KEY"
  value        = scaleway_iam_api_key.salt_master.secret_key
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

resource "infisical_secret" "scaleway_project_id" {
  name         = "SCW_PROJECT_ID"
  value        = local.scaleway_project_id
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

# --- Salt master key pair ---

resource "tls_private_key" "salt_master" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "infisical_secret" "salt_master_private_key" {
  name         = "SALT_MASTER_PRIVATE_KEY"
  value        = tls_private_key.salt_master.private_key_pem
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

resource "infisical_secret" "salt_master_public_key" {
  name         = "SALT_MASTER_PUBLIC_KEY"
  value        = tls_private_key.salt_master.public_key_pem
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

# --- Teleport OIDC credentials ---

resource "infisical_secret" "teleport_oidc_client_id" {
  name         = "TELEPORT_OIDC_CLIENT_ID"
  value        = var.teleport_oidc_client_id
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}

resource "infisical_secret" "teleport_oidc_client_secret" {
  name         = "TELEPORT_OIDC_CLIENT_SECRET"
  value        = var.teleport_oidc_client_secret
  env_slug     = "prod"
  workspace_id = infisical_project.rawkode_cloud.id
  folder_path  = "/projects/rawkode-cloud"
  depends_on   = [infisical_secret_folder.rawkode_cloud]
}
