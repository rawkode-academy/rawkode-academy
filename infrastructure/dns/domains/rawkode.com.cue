package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.com": zone.#CloudflareRegistrar & zone.#Gmail & {
	id: "fb9f87cd1b8267e6d0d3c2cf9298d970"

	gmail: domainKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoQzFkFcXxJ89NL4omfGZoTszjKVyABVC/sqa3LYHbk2v3G+0xaXyoGdI3CItOcjwuqmnDjyghgxlK961wmpKHLYVnQXIuZbhiY4uXzFcIISgnlxo7Ww5PX4nIGRjnZGZ/vDENfCFPqC1N4thtiMhQBY8kQuEoyKm2ZHa8nBw7cxROL/R6LW8fUwKxt2CJjqEcC4FzT5tR1+U6L3i0Yi1eh5vbvMJbFA45RAGD+RZtmERbOuLQeiJADZqXyjVrTV8OuGwKj5K5N4ua7jCNFjpjCNrTzpsyaOIYAUnXvnbQv9t3ushCtGJkpyHWw41lzRr/yofaP6YwpXi4yNhXkuzdQIDAQAB"

	mx: "@": "smtp.google.com": ttl: 3600
	txt: {
		"@": "google-site-verification": {value: "google-site-verification=tLlIPrsVkjMI2Klec6nYm_m6bNNwKOgvQZlyyxg0nBQ", ttl: 300}
		"_dmarc": dmarc: value: "v=DMARC1;  p=reject; rua=mailto:99440505e30f4c88b001ba54382a0a04@dmarc-reports.cloudflare.net"
	}
}
