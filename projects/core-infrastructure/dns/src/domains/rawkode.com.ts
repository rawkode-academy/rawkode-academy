import { Construct } from "constructs";
import { ManagedDomain, Registrar } from "../dnsProvider";

export default (scope: Construct): ManagedDomain => {
	const managedDomain = new ManagedDomain(
		scope,
		"rawkode.com",
		Registrar.Gandi,
	);

	managedDomain.enableGSuite({
		domainKey:
			"p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiwh7x7EfNHJ+C/SD9nLT2G5ZkGpfgEnVziGaKA2EsoGOmFzv2VyYK1Bf5HTXSB8uSXWGhNSn0961STxDWv+Y966Cb9lqhwb53xpz0lV2RifkNmVUCk7IJW6TbDaFRvP89TaW/F5Z3OwZEJ7tZ1gsdMs0cj2ro1mGRuFU7BcNyHbQwGAfBap9U/eoG4JyD3kAnncRDJKRhbku91tPriMvmMwOrppti/Cp9ntUWppsnCCQNwegLM/uo9orWHteAXFYxC6kjwOVXSXQ8GddpwEQWTZtZtrYXD0QoZspDOeUrmoGKGu2hgjl1mvzALFSo8VV5kOyGLbK4oYA15k5F18vWwIDAQAB",
		spfIncludes: [],
	});

	return managedDomain;
};
