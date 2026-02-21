output "private_network_id" {
  description = "Created private network ID"
  value       = scaleway_vpc_private_network.cluster.id
}

output "control_plane_server_id" {
  description = "Control plane bare metal server ID"
  value       = scaleway_baremetal_server.control_plane.id
}

output "minion_server_ids" {
  description = "Minion bare metal server IDs keyed by minion name"
  value       = { for name, server in scaleway_baremetal_server.minion : name => server.id }
}

output "infisical_project_id" {
  description = "Infisical project ID"
  value       = infisical_project.rawkode_cloud.id
}

output "infisical_identity_id" {
  description = "Infisical bootstrap machine identity ID for rawkode.cloud"
  value       = infisical_identity.rawkode_cloud.id
}

output "infisical_salt_pillar_runtime_identity_id" {
  description = "Infisical runtime machine identity ID used by Salt ext_pillar"
  value       = infisical_identity.salt_pillar_runtime.id
}
