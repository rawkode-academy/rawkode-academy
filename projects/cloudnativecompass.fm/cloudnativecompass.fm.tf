variable "cloudflare_account_id" {
  type = string
}

resource "cloudflare_zone" "cloudnativecompassfm" {
  account = {
    id = var.cloudflare_account_id
  }

  name = "cloudnativecompass.fm"
}

// You should not configure any DNS records here. This domain is configured as
// a custom domain on rawkode.link, our url shorterner service.
