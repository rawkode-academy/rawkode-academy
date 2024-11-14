terraform {
  backend "s3" {
    region = "nl-ams"
    endpoints = {
      s3 = "https://s3.nl-ams.scw.cloud"
    }

    bucket = "rawkode-academy-opentofu-state"
    key    = "rawkode.academy/tfstate"

    skip_credentials_validation = true
    skip_region_validation      = true
  }
}
