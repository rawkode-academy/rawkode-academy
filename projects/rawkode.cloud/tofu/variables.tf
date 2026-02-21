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

variable "tags" {
  description = "Tags applied to resources"
  type        = list(string)
  default     = ["rawkode-cloud", "kubernetes"]
}

