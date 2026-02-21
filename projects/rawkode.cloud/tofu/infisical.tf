data "infisical_projects" "rawkode_academy" {
  slug = "rawkode-academy"
}

# --- Bootstrap identity (used by cloud-init to fetch runtime credentials) ---
resource "infisical_identity" "rawkode_cloud" {
  name   = "rawkode.cloud"
  role   = "member"
  org_id = local.infisical_org_id
}

# Bootstrap auth method (universal auth)
resource "infisical_identity_universal_auth" "runtime" {
  identity_id          = infisical_identity.rawkode_cloud.id
  access_token_ttl     = 3600
  access_token_max_ttl = 86400
}

resource "infisical_identity_universal_auth_client_secret" "runtime" {
  identity_id = infisical_identity.rawkode_cloud.id
  depends_on  = [infisical_identity_universal_auth.runtime]
}

# --- Runtime identity (used by Salt ext_pillar in steady state) ---
resource "infisical_identity" "salt_pillar_runtime" {
  name   = "rawkode.cloud/salt-pillar-runtime"
  role   = "member"
  org_id = local.infisical_org_id
}

resource "infisical_identity_universal_auth" "salt_pillar_runtime" {
  identity_id          = infisical_identity.salt_pillar_runtime.id
  access_token_ttl     = 3600
  access_token_max_ttl = 86400
}

resource "infisical_identity_universal_auth_client_secret" "salt_pillar_runtime" {
  identity_id = infisical_identity.salt_pillar_runtime.id
  depends_on  = [infisical_identity_universal_auth.salt_pillar_runtime]
}

# --- Project access policies ---

# Policy: read secrets from /projects/rawkode-cloud
resource "infisical_project_identity_specific_privilege" "runtime" {
  identity_id  = infisical_identity.rawkode_cloud.id
  project_slug = data.infisical_projects.rawkode_academy.slug

  permissions_v2 = [
    {
      subject = "secrets"
      action  = ["read"]
      conditions = jsonencode({
        environment = { "$eq" = "production" }
        secretPath  = { "$eq" = "/projects/rawkode-cloud" }
      })
    }
  ]
}

resource "infisical_project_identity_specific_privilege" "salt_pillar_runtime" {
  identity_id  = infisical_identity.salt_pillar_runtime.id
  project_slug = data.infisical_projects.rawkode_academy.slug

  permissions_v2 = [
    {
      subject = "secrets"
      action  = ["read"]
      conditions = jsonencode({
        environment = { "$eq" = "production" }
        secretPath  = { "$eq" = "/projects/rawkode-cloud" }
      })
    }
  ]
}

# --- Secrets: /projects/rawkode-cloud folder ---

resource "infisical_secret_tag" "terraformed" {
  name       = "Terraformed"
  slug       = "terraformed"
  color      = "#0ea5e9"
  project_id = data.infisical_projects.rawkode_academy.id
}

resource "infisical_secret" "scaleway_access_key" {
  name         = "SCW_ACCESS_KEY"
  value        = scaleway_iam_api_key.salt_master.access_key
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}

resource "infisical_secret" "salt_pillar_runtime_client_id" {
  name         = var.salt_pillar_runtime_client_id_key
  value        = infisical_identity_universal_auth_client_secret.salt_pillar_runtime.client_id
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
  depends_on = [
    infisical_identity_universal_auth_client_secret.salt_pillar_runtime,
  ]
}

resource "infisical_secret" "salt_pillar_runtime_client_secret" {
  name         = var.salt_pillar_runtime_client_secret_key
  value        = infisical_identity_universal_auth_client_secret.salt_pillar_runtime.client_secret
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
  depends_on = [
    infisical_identity_universal_auth_client_secret.salt_pillar_runtime,
  ]
}

resource "infisical_secret" "salt_pillar_runtime_project_id" {
  name         = var.salt_pillar_runtime_project_id_key
  value        = data.infisical_projects.rawkode_academy.id
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}

resource "infisical_secret" "scaleway_secret_key" {
  name         = "SCW_SECRET_KEY"
  value        = scaleway_iam_api_key.salt_master.secret_key
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}

resource "infisical_secret" "scaleway_project_id" {
  name         = "SCW_PROJECT_ID"
  value        = local.scaleway_project_id
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}

# --- Salt master key pair ---

resource "tls_private_key" "salt_master" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "infisical_secret" "salt_master_private_key" {
  name         = "SALT_MASTER_PRIVATE_KEY"
  value        = tls_private_key.salt_master.private_key_pem
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}

resource "infisical_secret" "salt_master_public_key" {
  name         = "SALT_MASTER_PUBLIC_KEY"
  value        = tls_private_key.salt_master.public_key_pem
  env_slug     = "production"
  workspace_id = data.infisical_projects.rawkode_academy.id
  folder_path  = "/projects/rawkode-cloud"
  tag_ids      = [infisical_secret_tag.terraformed.id]
}
