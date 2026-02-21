terraform {
  required_version = ">= 1.11.0"

  backend "s3" {
    bucket                      = "rawkode.cloud"
    key                         = "terraform.tfstate"
    region                      = "fr-par"
    endpoints = {
      s3 = "https://s3.fr-par.scw.cloud"
    }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = ">= 2.69.0"
    }

    infisical = {
      source  = "Infisical/infisical"
      version = ">= 0.16.4"
    }

    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0.0"
    }

    time = {
      source  = "hashicorp/time"
      version = ">= 0.12.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.0.0"
    }
  }
}
