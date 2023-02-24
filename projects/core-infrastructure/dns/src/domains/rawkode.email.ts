import { Construct } from "constructs";
import { ManagedDomain, Account } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.email",
		Account.Academy,
	);

	managedDomain
		.enableGSuite()
		.addTextRecord(
			"@",
			"google-site-verification=MlYG-rApBrlb7DoYhwDMUtdlW37ndE_2y1vzcGsWFxI",
		)
		.addTextRecord(
			"google._domainKey",
			"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0htq+un78kY5mLFMLYmkb0Dl9uzX5P0RwhwY6ADVCpL+SI7zZYOyY4uPpRq44nm+H1iqet8wfjLlvnn1VrxB5ivwJisNsaleMZnkNPPXOZ+Y9lDFxqQLHUBzEB3dmHm7/HD2wcEHiConR2CFZ7888dDfMoBzpCifGdqDPsGJR2vCVNYHPDvd9fs6wwZQszJASWWxeMWV1U7rN9GqPHBMvgGJ4HfyWqOPrGEzWAdJ8+y98fhzDchejEnFOP7AtccqifoM7jpOwRDitjW+RL6gofYOJrJG48lSFSSEw25KWQ6yqEaT/Q1cXzIyOsvXuMNQ9UcPUpg8jDboor9vj852dwIDAQAB",
		)
		.addTextRecord("_pdcid", "uLwgMewHqrKXdnX6fI28WnPJCuMlt4fRx9eC5fve8qw76U_z")
		.addCNameRecord("pd1._domainkey", "pd1.pdserv.com")
		.addCNameRecord("pd2._domainkey", "pd2.pdserv.com");

	return managedDomain;
};
