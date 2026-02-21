variable "scaleway_region" {
  description = "Scaleway region for regional resources"
  type        = string
  default     = "fr-par"
}

variable "scaleway_zone" {
  description = "Scaleway zone for zonal resources"
  type        = string
  default     = "fr-par-2"
}

variable "cluster_name" {
  description = "Logical cluster name"
  type        = string
  default     = "rawkode-cloud"
}

variable "node_names" {
  description = "Bare metal node names"
  type        = list(string)
  default     = ["production-01"]
}

variable "baremetal_offer" {
  description = "Scaleway Elastic Metal offer name"
  type        = string
  default     = "EM-A315X-SSD"
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

variable "salt_master_node" {
  description = "Node name that runs the Salt master"
  type        = string
  default     = "production-01"
}

variable "tags" {
  description = "Tags applied to resources"
  type        = list(string)
  default     = ["rawkode-cloud", "kubernetes"]
}

