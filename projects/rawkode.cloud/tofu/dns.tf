resource "cloudflare_dns_record" "rawkode_cloud_a" {
  zone_id = var.cloudflare_zone_id
  name    = "rawkode.cloud"
  type    = "A"
  content = scaleway_baremetal_server.control_plane.ipv4[0].address
  ttl     = 300
  proxied = false
}

resource "cloudflare_dns_record" "rawkode_cloud_aaaa" {
  zone_id = var.cloudflare_zone_id
  name    = "rawkode.cloud"
  type    = "AAAA"
  content = scaleway_baremetal_server.control_plane.ipv6[0].address
  ttl     = 300
  proxied = false
}
