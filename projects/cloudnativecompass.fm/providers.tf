terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.13"
    }
  }

  backend "gcs" {
    bucket = "rawkode-academy-iac"
    prefix = "projects/cloudnativecompass.fm"
  }
}

provider "cloudflare" {}
