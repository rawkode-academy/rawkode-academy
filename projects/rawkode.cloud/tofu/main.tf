locals {
  scaleway_project_id = "6f6da5bd-f7a3-45ac-b0f1-3aae5bd0f436"
  infisical_org_id    = "ceffb723-21f4-4452-beea-56d25ed1f9d9"
}

resource "scaleway_vpc_private_network" "cluster" {
  name   = var.private_network_name
  region = var.scaleway_region
  tags   = var.tags
}

data "scaleway_baremetal_offer" "node" {
  zone                = var.scaleway_zone
  name                = var.baremetal_offer
  subscription_period = var.baremetal_subscription_period
}

data "scaleway_baremetal_os" "node" {
  zone    = var.scaleway_zone
  name    = var.baremetal_os
  version = var.baremetal_os_version
}

data "scaleway_baremetal_option" "private_network" {
  zone = var.scaleway_zone
  name = "Private Network"
}

data "scaleway_iam_ssh_key" "rawkode" {
  ssh_key_id = "4c5f5dfa-37fa-4a36-ba7a-f9572c934ad9"
}

resource "scaleway_baremetal_server" "control_plane" {
  zone  = var.scaleway_zone
  name  = "production-control-plane"
  offer = data.scaleway_baremetal_offer.node.id
  os    = data.scaleway_baremetal_os.node.id
  tags  = concat(var.tags, ["node:production-control-plane", "role:salt-master", "cluster:${var.cluster_name}", "PrivateNetwork"])

  ssh_key_ids = [data.scaleway_iam_ssh_key.rawkode.id]

  cloud_init = templatefile(
    "${path.module}/templates/cloud-init-salt-master.yaml.tftpl",
    {
      infisical_credentials_json = jsonencode({
        client_id     = infisical_identity_universal_auth_client_secret.runtime.client_id
        client_secret = infisical_identity_universal_auth_client_secret.runtime.client_secret
        project_id    = infisical_project.rawkode_cloud.id
      })
      scaleway_credentials_json = jsonencode({
        access_key = scaleway_iam_api_key.salt_master.access_key
        secret_key = scaleway_iam_api_key.salt_master.secret_key
        project_id = local.scaleway_project_id
        region     = var.scaleway_region
        zone       = var.scaleway_zone
      })
      salt_master_private_key     = tls_private_key.salt_master.private_key_pem
      salt_master_public_key      = tls_private_key.salt_master.public_key_pem
      teleport_oidc_client_id     = "rawkode-cloud"
      teleport_oidc_client_secret = "pkce-public-client-placeholder"
      private_network_interface   = var.private_network_interface
    }
  )

  options {
    id = data.scaleway_baremetal_option.private_network.option_id
  }

  reinstall_on_config_changes = true

  private_network {
    id = scaleway_vpc_private_network.cluster.id
  }

  depends_on = [
    infisical_secret.scaleway_access_key,
    infisical_secret.scaleway_secret_key,
    infisical_secret.scaleway_project_id,
    infisical_secret.salt_master_private_key,
    infisical_secret.salt_master_public_key,
  ]
}
