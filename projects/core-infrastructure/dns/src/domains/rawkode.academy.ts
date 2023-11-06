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
    .addARecord("web", "@", "185.230.63.107")
    .addCNameRecord("www", "www", "pointing.wixdns.net")
    .addCNameRecord("beta", "beta", "pointing.wixdns.net")
    .addCNameRecord("beta-www", "www.beta", "pointing.wixdns.net")
    .addCNameRecord("wixdkim1", "sg", "sg.rawkode.academy.s011.ascendbywix.com")
    .addCNameRecord("wixdkim2", "s1._domainkey", "s1._domainkey.rawkode.academy.s011.ascendbywix.com")
    .addCNameRecord("wixdkim3", "s2._domainkey", "s2._domainkey.rawkode.academy.s011.ascendbywix.com")
    .addCNameRecord("wixdkim4", "sel1._domainkey", "sel1._domainkey.rawkode.academy.s011.ascendbywix.com")
    .addTextRecord("_atproto", "_atproto", "did=did:plc:qtpysarntxepux4to4dr4hgr");

	return managedDomain;
};
