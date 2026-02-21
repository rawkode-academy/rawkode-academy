output "private_network_id" {
  description = "Created private network ID"
  value       = scaleway_vpc_private_network.cluster.id
}

output "baremetal_server_ids" {
  description = "Bare metal server IDs keyed by node name"
  value = {
    for name, server in scaleway_baremetal_server.node : name => server.id
  }
}

output "infisical_project_id" {
  description = "Infisical project ID"
  value       = infisical_project.rawkode_cloud.id
}

output "infisical_identity_id" {
  description = "Infisical machine identity ID for rawkode.cloud"
  value       = infisical_identity.rawkode_cloud.id
}
