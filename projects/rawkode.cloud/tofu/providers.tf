provider "scaleway" {
  region = var.scaleway_region
  zone   = var.scaleway_zone
}

provider "infisical" {
  host = "https://app.infisical.com"
}

provider "tls" {}

provider "cloudflare" {}
