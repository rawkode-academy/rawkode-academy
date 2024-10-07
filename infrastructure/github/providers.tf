terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "rawkode-academy-opentofu"
    prefix = "infrastructure/github"
  }
}

provider "github" {
	owner = "RawkodeAcademy"
}
