variable "scaleway_region" {
  description = "Scaleway region for regional resources"
  type        = string
  default     = "fr-par"
}

variable "scaleway_zone" {
  description = "Scaleway zone for zonal resources"
  type        = string
  default     = "fr-par-1"
}

variable "cluster_name" {
  description = "Logical cluster name"
  type        = string
  default     = "rawkode-cloud"
}

variable "baremetal_offer" {
  description = "Scaleway Elastic Metal offer name"
  type        = string
  default     = "EM-A610R-NVME"
}

variable "baremetal_subscription_period" {
  description = "Billing period for the Elastic Metal offer"
  type        = string
  default     = "hourly"
}

variable "baremetal_os" {
  description = "Scaleway Elastic Metal OS name"
  type        = string
  default     = "Ubuntu"
}

variable "baremetal_os_version" {
  description = "Scaleway Elastic Metal OS version"
  type        = string
  default     = "24.04 LTS (Noble Numbat)"
}

variable "private_network_name" {
  description = "Scaleway private network name"
  type        = string
  default     = "rawkode-cloud-private"
}

variable "private_network_interface" {
  description = "Linux interface name attached to the Scaleway private network"
  type        = string
  default     = "enp6s0"
}

variable "minion_replica_count" {
  description = "Number of minion bare metal servers to provision"
  type        = number
  default     = 1

  validation {
    condition     = var.minion_replica_count >= 0 && var.minion_replica_count == floor(var.minion_replica_count)
    error_message = "minion_replica_count must be a whole number greater than or equal to 0."
  }
}

variable "minion_name_prefix" {
  description = "Prefix used to build minion hostnames (for example production-minion-01)"
  type        = string
  default     = "production-minion"
}

variable "salt_master_private_ip" {
  description = "Salt master private-network address that minions should connect to"
  type        = string
  default     = ""

  validation {
    condition     = var.minion_replica_count == 0 || length(trimspace(var.salt_master_private_ip)) > 0
    error_message = "salt_master_private_ip must be set when minion_replica_count is greater than 0."
  }
}

variable "teleport_auth_type" {
  description = "Teleport authentication type (use github for OSS)"
  type        = string
  default     = "github"

  validation {
    condition     = contains(["local", "github"], var.teleport_auth_type)
    error_message = "teleport_auth_type must be either 'local' or 'github'."
  }
}

variable "teleport_github_org" {
  description = "GitHub organization allowed to authenticate to Teleport"
  type        = string
  default     = "rawkode-academy"
}

variable "teleport_github_team" {
  description = "GitHub team allowed to authenticate to Teleport"
  type        = string
  default     = "platform"
}

variable "teleport_github_roles" {
  description = "Teleport roles mapped from the configured GitHub team"
  type        = list(string)
  default     = ["access", "editor"]
}

variable "teleport_github_client_id_key" {
  description = "Infisical secret key name used for Teleport GitHub client ID"
  type        = string
  default     = "GITHUB_CLIENT_ID"
}

variable "teleport_github_client_secret_key" {
  description = "Infisical secret key name used for Teleport GitHub client secret"
  type        = string
  default     = "GITHUB_CLIENT_SECRET"
}

variable "salt_pillar_runtime_client_id_key" {
  description = "Infisical secret key name that stores the runtime Salt pillar Infisical client ID"
  type        = string
  default     = "SALT_PILLAR_CLIENT_ID"
}

variable "salt_pillar_runtime_client_secret_key" {
  description = "Infisical secret key name that stores the runtime Salt pillar Infisical client secret"
  type        = string
  default     = "SALT_PILLAR_CLIENT_SECRET"
}

variable "salt_pillar_runtime_project_id_key" {
  description = "Infisical secret key name that stores the runtime Salt pillar Infisical project ID"
  type        = string
  default     = "SALT_PILLAR_PROJECT_ID"
}

variable "tags" {
  description = "Tags applied to resources"
  type        = list(string)
  default     = ["rawkode-cloud", "kubernetes"]
}
