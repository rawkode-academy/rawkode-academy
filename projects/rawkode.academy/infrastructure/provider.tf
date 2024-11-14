terraform {
  required_providers {
    scaleway = {
      source  = "opentofu/scaleway"
      version = "2.45.0"
    }
  }
}

provider "scaleway" {
	// Rawkode Academy Org & Default Project
  organization_id = "b07462e9-1a00-43b4-a6a8-6e3004a31984"
  project_id      = "b07462e9-1a00-43b4-a6a8-6e3004a31984"

  region = "nl-ams"
  zone   = "nl-ams-1"
}
