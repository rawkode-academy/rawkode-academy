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

data "scaleway_baremetal_offer" "node" {
  zone = var.scaleway_zone
  name = var.baremetal_offer
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

resource "scaleway_baremetal_server" "node" {
  for_each = local.nodes

  zone  = var.scaleway_zone
  name  = each.key
  offer = data.scaleway_baremetal_offer.node.id
  os    = data.scaleway_baremetal_os.node.id
  tags  = concat(var.tags, ["node:${each.key}", "cluster:${var.cluster_name}"])

  ssh_key_ids = [data.scaleway_iam_ssh_key.rawkode.id]

  options {
    id = data.scaleway_baremetal_option.private_network.option_id
  }

  reinstall_on_config_changes = true

  private_network {
    id = scaleway_vpc_private_network.cluster.id
  }

  connection {
    type  = "ssh"
    user  = "ubuntu"
    host  = one([for ip in self.ips : ip.address if ip.version == "IPv4"])
    agent = true
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p /etc/salt/credentials",
      "sudo chmod 700 /etc/salt/credentials",
    ]
  }

  provisioner "file" {
    content = jsonencode({
      client_id     = infisical_identity_universal_auth_client_secret.runtime.client_id
      client_secret = infisical_identity_universal_auth_client_secret.runtime.client_secret
      project_id    = infisical_project.rawkode_cloud.id
    })
    destination = "/tmp/infisical.json"
  }

  provisioner "file" {
    content = jsonencode({
      access_key = scaleway_iam_api_key.salt_master.access_key
      secret_key = scaleway_iam_api_key.salt_master.secret_key
      project_id = local.scaleway_project_id
      region     = var.scaleway_region
      zone       = var.scaleway_zone
    })
    destination = "/tmp/scaleway-api.json"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mv /tmp/infisical.json /etc/salt/credentials/infisical.json",
      "sudo mv /tmp/scaleway-api.json /etc/salt/credentials/scaleway-api.json",
      "sudo chmod 600 /etc/salt/credentials/*.json",
      "sudo chown -R root:root /etc/salt/credentials",
    ]
  }

  depends_on = [
    infisical_secret.scaleway_access_key,
    infisical_secret.scaleway_secret_key,
    infisical_secret.scaleway_project_id,
  ]
}

