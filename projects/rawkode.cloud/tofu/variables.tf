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
  default     = ["rkc01"]
}

variable "baremetal_offer" {
  description = "Scaleway Elastic Metal offer ID"
  type        = string
  default     = "f1322af3-53dd-473b-8749-83661fbb73d8"
}

variable "baremetal_os" {
  description = "Scaleway Elastic Metal OS ID"
  type        = string
  default     = "7d1914e1-f4ab-47fc-bd8c-b3a23143e87a"
}

variable "private_network_name" {
  description = "Scaleway private network name"
  type        = string
  default     = "rawkode-cloud-private"
}

variable "tags" {
  description = "Tags applied to resources"
  type        = list(string)
  default     = ["rawkode-cloud", "kubernetes"]
}

variable "salt_master_node" {
  description = "Node name that runs the Salt master"
  type        = string
  default     = "rkc01"
}
