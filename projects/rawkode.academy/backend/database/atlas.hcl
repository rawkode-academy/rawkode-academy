variable "user" {
  type = string
  default = getenv("DATABASE_USER")
}

variable "pass" {
  type = string
  default = getenv("DATABASE_PASS")
}

variable "host" {
  type = string
  default = getenv("DATABASE_HOST")
}

variable "name" {
  type = string
  default = getenv("DATABASE_NAME")
}

locals {
  url = "postgres://${var.user}:${var.pass}@${var.host}:5432/${var.name}"
}

env "production" {
  src = "file://schema.hcl"
  url = local.url
  schemas = ["public"]
}
