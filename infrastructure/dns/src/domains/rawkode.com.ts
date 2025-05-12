import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.com",
		Registrar.Cloudflare,
	)
		.enableGSuite({
			domainKey:
				"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoQzFkFcXxJ89NL4omfGZoTszjKVyABVC/sqa3LYHbk2v3G+0xaXyoGdI3CItOcjwuqmnDjyghgxlK961wmpKHLYVnQXIuZbhiY4uXzFcIISgnlxo7Ww5PX4nIGRjnZGZ/vDENfCFPqC1N4thtiMhQBY8kQuEoyKm2ZHa8nBw7cxROL/R6LW8fUwKxt2CJjqEcC4FzT5tR1+U6L3i0Yi1eh5vbvMJbFA45RAGD+RZtmERbOuLQeiJADZqXyjVrTV8OuGwKj5K5N4ua7jCNFjpjCNrTzpsyaOIYAUnXvnbQv9t3ushCtGJkpyHWw41lzRr/yofaP6YwpXi4yNhXkuzdQIDAQAB",
		})
		.addTextRecord(
			"google-site-verification",
			"@",
			"google-site-verification=tLlIPrsVkjMI2Klec6nYm_m6bNNwKOgvQZlyyxg0nBQ",
		);

	return managedDomain;
};
