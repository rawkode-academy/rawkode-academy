locals {
  scaleway_project_id          = "6f6da5bd-f7a3-45ac-b0f1-3aae5bd0f436"
  infisical_org_id             = "ceffb723-21f4-4452-beea-56d25ed1f9d9"
  minion_names                 = [for idx in range(var.minion_replica_count) : format("%s-%02d", var.minion_name_prefix, idx + 1)]
  minion_nodes                 = { for name in local.minion_names : name => name }
  control_plane_private_ipv4s  = [for ip in scaleway_baremetal_server.control_plane.private_ips : ip.address if can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}$", ip.address))]
  derived_salt_master_private_ip = (
    length(trimspace(var.salt_master_private_ip)) > 0
    ? trimspace(var.salt_master_private_ip)
    : one(local.control_plane_private_ipv4s)
  )
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
        project_id    = data.infisical_projects.rawkode_academy.id
      })
      teleport_auth_type               = var.teleport_auth_type
      teleport_github_org              = var.teleport_github_org
      teleport_github_team             = var.teleport_github_team
      teleport_github_roles            = var.teleport_github_roles
      teleport_github_client_id_key    = var.teleport_github_client_id_key
      teleport_github_client_secret_key = var.teleport_github_client_secret_key
      salt_pillar_runtime_client_id_key = var.salt_pillar_runtime_client_id_key
      salt_pillar_runtime_client_secret_key = var.salt_pillar_runtime_client_secret_key
      salt_pillar_runtime_project_id_key = var.salt_pillar_runtime_project_id_key
      scaleway_zone                   = var.scaleway_zone
      private_network_interface        = var.private_network_interface
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
    infisical_secret.salt_pillar_runtime_client_id,
    infisical_secret.salt_pillar_runtime_client_secret,
    infisical_secret.salt_pillar_runtime_project_id,
    infisical_secret.salt_master_private_key,
    infisical_secret.salt_master_public_key,
  ]
}

resource "scaleway_baremetal_server" "minion" {
  for_each = local.minion_nodes

  zone  = var.scaleway_zone
  name  = each.key
  offer = data.scaleway_baremetal_offer.node.id
  os    = data.scaleway_baremetal_os.node.id
  tags  = concat(var.tags, ["node:${each.key}", "role:salt-minion", "cluster:${var.cluster_name}", "PrivateNetwork"])

  ssh_key_ids = [data.scaleway_iam_ssh_key.rawkode.id]

  cloud_init = templatefile(
    "${path.module}/templates/cloud-init-salt-minion.yaml.tftpl",
    {
      private_network_interface = var.private_network_interface
      salt_master_private_ip    = local.derived_salt_master_private_ip
      minion_id                 = each.key
    }
  )

  options {
    id = data.scaleway_baremetal_option.private_network.option_id
  }

  reinstall_on_config_changes = true

  private_network {
    id = scaleway_vpc_private_network.cluster.id
  }

  depends_on = [scaleway_baremetal_server.control_plane]
}
