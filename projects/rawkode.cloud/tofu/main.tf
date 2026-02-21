locals {
  scaleway_project_id = "6f6da5bd-f7a3-45ac-b0f1-3aae5bd0f436"
  infisical_org_id    = "ceffb723-21f4-4452-beea-56d25ed1f9d9"
  nodes               = toset(var.node_names)
}

resource "scaleway_vpc_private_network" "cluster" {
  name   = var.private_network_name
  region = var.scaleway_region
  tags   = var.tags
}

data "scaleway_baremetal_option" "private_network" {
  zone = var.scaleway_zone
  name = "Private Network"
}

resource "scaleway_baremetal_server" "node" {
  for_each = local.nodes

  zone  = var.scaleway_zone
  name  = each.key
  offer = var.baremetal_offer
  os    = var.baremetal_os
  tags  = concat(var.tags, ["node:${each.key}", "cluster:${var.cluster_name}"])

  cloud_init = each.key == var.salt_master_node ? templatefile(
    "${path.module}/templates/cloud-init-salt-master.yaml.tftpl",
    {
      bootstrap_token      = infisical_identity_token_auth_token.bootstrap.token
      infisical_project_id = infisical_project.rawkode_cloud.id
      region               = var.scaleway_region
      zone                 = var.scaleway_zone
    }
  ) : null

  options {
    id = data.scaleway_baremetal_option.private_network.option_id
  }

  reinstall_on_config_changes = true

  private_network {
    id = scaleway_vpc_private_network.cluster.id
  }
}

