import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"comtrya.dev",
		Registrar.Cloudflare,
	);

	managedDomain
		.discourageEmail()
		.addARecord("@1", "@", "104.18.3.117")
		.addARecord("@2", "@", "104.18.2.117")
		.addCNameRecord("www", "www", "hosting.gitbook.io")
		.addCNameRecord("get", "get", "get-comtrya-dev.onrender.com")
		.addPageRule("root", "comtrya.dev/*", {
			forwardingUrl: {
				url: "https://www.comtrya.dev/$1",
				statusCode: 301,
			},
		});

	return managedDomain;
};
