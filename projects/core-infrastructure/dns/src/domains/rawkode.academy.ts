import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.academy",
		Registrar.Cloudflare,
	);

	managedDomain
    .enableGSuite({
      domainKey:
        "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
      spfIncludes: [],
    })
    .addTextRecord(
      "google-site-verification",
      "@",
      "google-site-verification=dlh9jxVzubowYFoVO82naJOotuUwY8zNG2VYGWlDhsU",
    )
		.addCNameRecord("api", "api", "rawkodeacademy-api.hasura.app")
		.addCNameRecord("community", "community", "rawkode-academy.circle.so")
		.addCNameRecord("connect", "connect", "26236635.sites.hscoscdn-eu1.net.")
    .addCNameRecord("crm", "crm", "26236635.sites.hscoscdn-eu1.net.")
    .addTextRecord("_atproto", "_atproto", "did=did:plc:qtpysarntxepux4to4dr4hgr");

	return managedDomain;
};
